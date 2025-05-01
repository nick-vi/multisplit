import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

async function getFilesRecursively(
  uri: vscode.Uri,
  ignoreFilter: IgnorePatterns | null = null,
  workspaceRoot: string = ''
): Promise<vscode.Uri[]> {
  const stat = await vscode.workspace.fs.stat(uri);

  if (stat.type === vscode.FileType.File) {
    // If we have an ignore filter and a workspace root, check if this file should be ignored
    if (ignoreFilter && workspaceRoot) {
      // Get the relative path from the workspace root
      const relativePath = path.relative(workspaceRoot, uri.fsPath);
      // Check if the file should be ignored
      if (ignoreFilter.ignores(relativePath)) {
        return [];
      }
    }
    return [uri];
  } else if (stat.type === vscode.FileType.Directory) {
    const entries = await vscode.workspace.fs.readDirectory(uri);
    const filePromises = entries.map(async ([name, type]) => {
      const childUri = vscode.Uri.file(path.join(uri.fsPath, name));

      // If we have an ignore filter and a workspace root, check if this directory should be ignored
      if (ignoreFilter && workspaceRoot && type === vscode.FileType.Directory) {
        const relativePath = path.relative(workspaceRoot, childUri.fsPath);
        if (ignoreFilter.ignores(relativePath)) {
          return [];
        }
      }

      if (type === vscode.FileType.Directory) {
        return getFilesRecursively(childUri, ignoreFilter, workspaceRoot);
      } else if (type === vscode.FileType.File) {
        // For files, we'll check in the recursive call
        return getFilesRecursively(childUri, ignoreFilter, workspaceRoot);
      }
      return [];
    });

    const nestedFiles = await Promise.all(filePromises);
    return nestedFiles.flat();
  }

  return [];
}

class IgnorePatterns {
  private patterns: string[] = [];

  constructor(patterns: string[]) {
    this.patterns = patterns
      .filter((pattern) => {
        // Remove empty lines and comments
        return pattern.trim() !== '' && !pattern.trim().startsWith('#');
      })
      .map((pattern) => pattern.trim());
  }

  public ignores(filePath: string): boolean {
    // Normalize path to use forward slashes
    const normalizedPath = filePath.replace(/\\/g, '/');

    for (const pattern of this.patterns) {
      // Handle directory patterns (ending with /) - match any file in that directory
      if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        if (
          normalizedPath.startsWith(dirPattern + '/') ||
          normalizedPath === dirPattern
        ) {
          return true;
        }
        continue;
      }

      // Handle wildcard patterns
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        if (regex.test(normalizedPath)) {
          return true;
        }
        continue;
      }

      // Exact match
      if (normalizedPath === pattern) {
        return true;
      }
    }

    return false;
  }
}

async function loadSplitIgnore(
  workspaceRoot: string
): Promise<IgnorePatterns | null> {
  try {
    const splitIgnorePath = path.join(workspaceRoot, '.splitignore');

    // Check if .splitignore file exists
    if (fs.existsSync(splitIgnorePath)) {
      const content = fs.readFileSync(splitIgnorePath, 'utf8');
      const patterns = content.split('\n');
      return new IgnorePatterns(patterns);
    }
    return null;
  } catch (error) {
    console.error(`Error loading .splitignore file: ${error}`);
    return null;
  }
}

async function isBinaryFile(uri: vscode.Uri): Promise<boolean> {
  try {
    const fileContent = await vscode.workspace.fs.readFile(uri);
    const sampleSize = Math.min(fileContent.length, 1000);
    const sample = fileContent.slice(0, sampleSize);

    let nonPrintableCount = 0;
    for (let i = 0; i < sample.length; i++) {
      const byte = sample[i];
      if (
        byte === 0 ||
        (byte < 9 && byte !== 7) ||
        (byte > 14 && byte < 32 && byte !== 27)
      ) {
        nonPrintableCount++;
      }
    }

    return nonPrintableCount > sampleSize * 0.1;
  } catch (error) {
    console.error(`Error checking if file is binary: ${error}`);
    return false;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    'Split View Extension'
  );

  function log(message: string) {
    console.log(message);
    outputChannel.appendLine(message);
  }

  const openInSplitViewDisposable = vscode.commands.registerCommand(
    'extension.openInSplitView',
    async (uriOrUris: vscode.Uri | vscode.Uri[], ...args: any[]) => {
      try {
        let uris: vscode.Uri[] = [];

        if (args.length > 0 && Array.isArray(args[0])) {
          try {
            const selectedUris = args[0];
            if (
              selectedUris.length > 0 &&
              typeof selectedUris[0].fsPath === 'string'
            ) {
              uris = selectedUris.map((item: any) =>
                vscode.Uri.file(item.fsPath)
              );
            }
          } catch (error) {
            log(`Error processing selected files: ${error}`);
          }
        }

        if (uris.length === 0) {
          if (!uriOrUris) {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
              vscode.window.showErrorMessage('No file selected');
              return;
            }
            uris = [activeEditor.document.uri];
          } else if (Array.isArray(uriOrUris)) {
            uris = uriOrUris;
          } else {
            uris = [uriOrUris];
          }
        }

        // Get the workspace root folder to use for .splitignore
        let workspaceRoot = '';
        if (
          vscode.workspace.workspaceFolders &&
          vscode.workspace.workspaceFolders.length > 0
        ) {
          workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        // Load .splitignore file if it exists
        const ignoreFilter = await loadSplitIgnore(workspaceRoot);
        if (ignoreFilter) {
          log('Found .splitignore file, applying ignore patterns');
        }

        let allFiles: vscode.Uri[] = [];
        for (const uri of uris) {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type === vscode.FileType.Directory) {
            const files = await getFilesRecursively(
              uri,
              ignoreFilter,
              workspaceRoot
            );
            allFiles = allFiles.concat(files);
          } else {
            // For individual files, check if they should be ignored
            if (ignoreFilter && workspaceRoot) {
              const relativePath = path.relative(workspaceRoot, uri.fsPath);
              if (!ignoreFilter.ignores(relativePath)) {
                allFiles.push(uri);
              } else {
                log(
                  `Ignoring file: ${uri.fsPath} (matched by .splitignore pattern)`
                );
              }
            } else {
              allFiles.push(uri);
            }
          }
        }

        if (allFiles.length === 0) {
          vscode.window.showInformationMessage('No files found to open');
          return;
        }

        const textFiles: vscode.Uri[] = [];
        for (const file of allFiles) {
          try {
            const isBinary = await isBinaryFile(file);
            if (!isBinary) {
              textFiles.push(file);
            }
          } catch (error) {
            console.log(`Skipping file ${file.fsPath}: ${error}`);
          }
        }

        if (textFiles.length === 0) {
          vscode.window.showInformationMessage('No text files found to open');
          return;
        }

        // Limit to 32 files maximum
        const MAX_FILES = 32;
        let files = textFiles;

        if (files.length < 2) {
          vscode.window.showWarningMessage(
            'Need at least 2 text files to open in split view.'
          );
          return;
        }

        if (files.length > MAX_FILES) {
          log(`Limiting to ${MAX_FILES} files (${files.length} found)`);
          files = files.slice(0, MAX_FILES);
          vscode.window.showWarningMessage(
            `Limited to ${MAX_FILES} files. Use .splitignore to filter unwanted files.`
          );
        }

        const fileCount = files.length;
        let cols = Math.ceil(Math.sqrt(fileCount));
        let rows = Math.ceil(fileCount / cols);

        await vscode.commands.executeCommand('vscode.setEditorLayout', {
          orientation: 0,
          groups: Array(rows)
            .fill(null)
            .map(() => ({
              groups: Array(cols)
                .fill(null)
                .map(() => ({ size: 1 })),
            })),
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        for (let i = 0; i < files.length; i++) {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const groupIndex = row * cols + col + 1;
          const viewColumn = groupIndex as vscode.ViewColumn;

          try {
            await vscode.window.showTextDocument(files[i], {
              viewColumn: viewColumn,
              preview: false,
              preserveFocus: false,
            });
          } catch (err) {
            log(`Error opening file in group ${groupIndex}: ${err}`);
          }
        }

        vscode.window.showInformationMessage(
          `Opened ${files.length} file(s) in split view`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error opening files: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  );

  context.subscriptions.push(openInSplitViewDisposable);
}

export function deactivate() {}
