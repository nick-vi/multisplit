#!/bin/bash

# Set the extension ID pattern to match any version of the extension
EXTENSION_ID_PATTERN="nick-vi.multisplit"
VSIX_PATTERN="multisplit-*.vsix"
VSIX_DIR="dist"

# Function to display colored output
function echo_color() {
    local color=$1
    local message=$2

    case $color in
        "green") echo -e "\033[0;32m$message\033[0m" ;;
        "blue") echo -e "\033[0;34m$message\033[0m" ;;
        "yellow") echo -e "\033[0;33m$message\033[0m" ;;
        "red") echo -e "\033[0;31m$message\033[0m" ;;
        *) echo "$message" ;;
    esac
}

# Function to uninstall all versions of the extension
function uninstall_extension() {
    echo_color "blue" "🔍 Finding installed extensions matching pattern: $EXTENSION_ID_PATTERN"

    # Get list of installed extensions matching the pattern
    installed_extensions=$(code --list-extensions | grep -i "$EXTENSION_ID_PATTERN" || true)

    if [ -z "$installed_extensions" ]; then
        echo_color "yellow" "ℹ️ No matching extensions found."
    else
        echo_color "yellow" "🗑️ Uninstalling extensions:"
        echo "$installed_extensions" | while read -r ext; do
            echo_color "yellow" "   - $ext"
            code --uninstall-extension "$ext" > /dev/null 2>&1
        done
        echo_color "green" "✅ Extensions uninstalled successfully."
    fi
}

# Function to clean up the workspace
function clean_workspace() {
    echo_color "blue" "🧹 Cleaning workspace..."

    # Delete the compiled output directory
    echo_color "yellow" "   - Removing compiled output"
    rm -rf out/

    # Delete any existing VSIX files
    echo_color "yellow" "   - Removing existing VSIX packages"
    rm -f $VSIX_PATTERN
    rm -f $VSIX_DIR/$VSIX_PATTERN

    echo_color "green" "✅ Workspace cleaned."
}

# Function to compile the extension
function compile_extension() {
    echo_color "blue" "🔨 Compiling extension..."
    pnpm run compile

    if [ $? -ne 0 ]; then
        echo_color "red" "❌ Compilation failed!"
        exit 1
    fi

    echo_color "green" "✅ Compilation successful."
}

# Function to package the extension
function package_extension() {
    echo_color "blue" "📦 Packaging extension..."

    # Create dist directory if it doesn't exist
    mkdir -p $VSIX_DIR

    # Get version from package.json
    VERSION=$(grep '"version":' package.json | head -1 | cut -d '"' -f 4)
    PUBLISHER=$(grep '"publisher":' package.json | cut -d '"' -f 4)
    NAME=$(grep '"name":' package.json | head -1 | cut -d '"' -f 4)

    # Expected output file
    OUTPUT_FILE="$VSIX_DIR/${NAME}-${VERSION}.vsix"

    echo_color "yellow" "Packaging version $VERSION to $OUTPUT_FILE"

    # Use a more direct approach with vsce
    pnpm exec vsce package --no-dependencies -o "$OUTPUT_FILE"

    if [ $? -ne 0 ]; then
        echo_color "red" "❌ Packaging failed!"
        echo_color "yellow" "Trying alternative packaging method..."

        # Try with --no-yarn option
        pnpm exec vsce package --no-dependencies --no-yarn -o "$OUTPUT_FILE"

        if [ $? -ne 0 ]; then
            echo_color "red" "❌ All packaging attempts failed!"
            exit 1
        fi
    fi

    # Verify the file exists
    if [ ! -f "$OUTPUT_FILE" ]; then
        echo_color "red" "❌ Failed to find packaged VSIX file: $OUTPUT_FILE"
        exit 1
    fi

    # Get the absolute path
    ABSOLUTE_PATH="$(cd "$(dirname "$OUTPUT_FILE")" && pwd)/$(basename "$OUTPUT_FILE")"

    echo_color "green" "✅ Extension packaged: $ABSOLUTE_PATH"
    # Return the absolute path
    echo "$ABSOLUTE_PATH"
}

# Function to install the extension
function install_extension() {
    local vsix_file=$1

    # Debug output
    echo_color "yellow" "Debug: Received VSIX file path: '$vsix_file'"

    # Make sure the VSIX file exists and is readable
    if [ ! -f "$vsix_file" ]; then
        echo_color "red" "❌ VSIX file not found: $vsix_file"
        echo_color "yellow" "Trying to find the VSIX file automatically..."

        # Try to find the VSIX file
        local found_vsix=$(find $VSIX_DIR -name "$VSIX_PATTERN" -type f -print -quit)

        # If not found in dist directory, try root directory as fallback
        if [ -z "$found_vsix" ]; then
            found_vsix=$(find . -name "$VSIX_PATTERN" -type f -print -quit)
        fi

        if [ -z "$found_vsix" ]; then
            echo_color "red" "❌ Could not find any VSIX file. Aborting."
            exit 1
        fi

        vsix_file="$(cd "$(dirname "$found_vsix")" && pwd)/$(basename "$found_vsix")"
        echo_color "green" "Found VSIX file: $vsix_file"
    fi

    echo_color "blue" "📥 Installing extension from $vsix_file..."

    # First make sure any existing extension is uninstalled
    uninstall_extension

    # Wait a moment to ensure VS Code has completed the uninstallation
    sleep 1

    # Try different installation methods
    if code --install-extension "$vsix_file" 2>/dev/null; then
        echo_color "green" "✅ Extension installed successfully."
        return 0
    fi

    echo_color "yellow" "First installation attempt failed, trying alternative method..."

    # Try with the absolute path using realpath if available
    if command -v realpath >/dev/null 2>&1; then
        if code --install-extension "$(realpath "$vsix_file")" 2>/dev/null; then
            echo_color "green" "✅ Extension installed successfully with realpath."
            return 0
        fi
    fi

    # Try a manual copy approach as a last resort
    echo_color "yellow" "Trying manual installation method..."

    # Get the extension ID from package.json
    local publisher=$(grep '"publisher":' package.json | cut -d '"' -f 4)
    local name=$(grep '"name":' package.json | head -1 | cut -d '"' -f 4)
    local ext_id="${publisher}.${name}"

    # Get VS Code extensions directory
    local ext_dir="$HOME/.vscode/extensions"
    if [[ "$(uname)" == "Darwin" ]]; then
        ext_dir="$HOME/.vscode/extensions"
    elif [[ "$(uname)" == "Linux" ]]; then
        ext_dir="$HOME/.vscode/extensions"
    elif [[ "$(uname)" == "MINGW"* ]] || [[ "$(uname)" == "MSYS"* ]]; then
        ext_dir="$APPDATA/Code/User/extensions"
    fi

    # Create a temporary directory
    local temp_dir=$(mktemp -d)
    echo_color "yellow" "Extracting VSIX to $temp_dir"

    # Extract the VSIX (it's just a zip file)
    if unzip -q "$vsix_file" -d "$temp_dir"; then
        # Create the extension directory
        mkdir -p "$ext_dir/$ext_id"

        # Copy the extension files
        cp -R "$temp_dir/extension"/* "$ext_dir/$ext_id/"

        # Clean up
        rm -rf "$temp_dir"

        echo_color "green" "✅ Extension manually installed to $ext_dir/$ext_id"
        return 0
    else
        rm -rf "$temp_dir"
        echo_color "red" "❌ All installation attempts failed!"
        exit 1
    fi
}

# Function to reload the VS Code window
function reload_window() {
    echo_color "blue" "🔄 Reloading VS Code window..."
    code -r .
}

# Main function to handle command line arguments
function main() {
    local command=$1

    case $command in
        "clean")
            uninstall_extension
            clean_workspace
            ;;
        "build")
            clean_workspace
            compile_extension
            ;;
        "package")
            clean_workspace
            compile_extension
            package_extension
            ;;
        "install")
            uninstall_extension
            clean_workspace
            compile_extension
            # Run package_extension and save its output to a temporary file
            package_extension > /tmp/vsix_output.txt
            # Get the last line which should contain the VSIX path
            vsix_file=$(tail -n 1 /tmp/vsix_output.txt)
            install_extension "$vsix_file"
            # Clean up
            rm -f /tmp/vsix_output.txt
            ;;
        "reload")
            reload_window
            ;;
        "dev")
            uninstall_extension
            clean_workspace
            compile_extension
            # Run package_extension and save its output to a temporary file
            package_extension > /tmp/vsix_output.txt
            # Get the last line which should contain the VSIX path
            vsix_file=$(tail -n 1 /tmp/vsix_output.txt)
            install_extension "$vsix_file"
            # Clean up
            rm -f /tmp/vsix_output.txt
            reload_window
            ;;
        *)
            echo_color "yellow" "Usage: $0 [command]"
            echo "Commands:"
            echo "  clean    - Uninstall extension and clean workspace"
            echo "  build    - Clean and compile the extension"
            echo "  package  - Build and package the extension"
            echo "  install  - Build, package, and install the extension"
            echo "  reload   - Reload the VS Code window"
            echo "  dev      - Full development cycle: clean, build, package, install, and reload"
            ;;
    esac
}

# Execute the main function with all arguments
main "$@"
