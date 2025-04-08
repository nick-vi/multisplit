import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { suite, test, suiteSetup, suiteTeardown } from 'mocha';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting MultiSplit extension tests');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multisplit-tests-'));

    // Create test files before running tests
    suiteSetup(async () => {
        // Create a few test files
        for (let i = 1; i <= 5; i++) {
            const filePath = path.join(tmpDir, `test-file-${i}.txt`);
            fs.writeFileSync(filePath, `This is test file ${i}\n`);
        }

        // Create a .splitignore file
        const splitIgnorePath = path.join(tmpDir, '.splitignore');
        fs.writeFileSync(splitIgnorePath, 'test-file-5.txt\n');
    });

    // Clean up test files after tests
    suiteTeardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('nick-vi.multisplit'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('nick-vi.multisplit');
        if (!extension) {
            assert.fail('Extension not found');
        }

        await extension.activate();
        assert.strictEqual(extension.isActive, true);
    });

    test('Command should be registered', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('extension.openInSplitView'));
    });

    // Note: Testing the actual split view functionality is challenging in automated tests
    // as it requires manipulating the VS Code UI. These would be better tested manually
    // or with more advanced UI testing frameworks.

    test('Should handle non-existent files gracefully', async () => {
        const nonExistentUri = vscode.Uri.file(path.join(tmpDir, 'non-existent-file.txt'));

        // This should not throw an error
        await vscode.commands.executeCommand('extension.openInSplitView', nonExistentUri);

        // We can't easily assert the result, but at least we can verify it doesn't crash
        assert.ok(true);
    });
});
