# MultiSplit

A Visual Studio Code extension that adds a context menu option to open multiple files in a grid layout. This extension was originally created to help the macOS ChatGPT app access the context of multiple files by opening them simultaneously.

## Features

This extension adds a context menu option when right-clicking on files or folders in the Explorer:

**Open in Split View**: Opens the selected file(s) in a grid layout in the current window. If a folder is selected, all files within that folder (including nested files) will be opened in a grid arrangement optimized for the number of files. The extension limits the maximum number of files to 16 to ensure good performance and usability.

## Requirements

- Visual Studio Code 1.38.0 or higher

## Usage

1. Right-click on a file or folder in the Explorer
2. Select "Open in Split View"

### Using .splitignore

You can create a `.splitignore` file in the root of your workspace to exclude certain files or folders from being opened in split view. The syntax is similar to `.gitignore`:

```
# Ignore all .log files
*.log

# Ignore the node_modules directory
node_modules/

# Ignore specific files
src/config.js
```

This is useful when working with folders that contain many files you don't want to open.

## Extension Settings

This extension does not add any settings.

## Known Issues

- The extension limits the number of files to 16 to maintain performance. Use `.splitignore` to filter unwanted files if you need to work with large directories.

## Development

### Testing

This extension includes both unit tests and integration tests:

- **Unit Tests**: Test individual components like the ignore pattern functionality
- **Integration Tests**: Test the extension in the current VS Code environment

To run the tests:

```bash
# Run unit tests
pnpm run test:unit

# Run integration tests in your current VS Code instance
pnpm run test
```

The integration tests run in your current VS Code instance, which makes testing faster and more reliable than downloading a separate VS Code instance.

## Release Notes

### 1.1.0

- Added support for `.splitignore` file to exclude files and folders
- Limited the maximum number of files to 16 for better performance

### 1.0.0

- Initial release of MultiSplit
