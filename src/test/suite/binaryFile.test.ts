import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock the isBinaryFile function for testing
async function isBinaryFile(uri: vscode.Uri): Promise<boolean> {
    try {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        const sampleSize = Math.min(fileContent.length, 1000);
        const sample = fileContent.slice(0, sampleSize);

        let nonPrintableCount = 0;
        for (let i = 0; i < sample.length; i++) {
            const byte = sample[i];
            if (byte === 0 || (byte < 9 && byte !== 7) || (byte > 14 && byte < 32 && byte !== 27)) {
                nonPrintableCount++;
            }
        }

        return nonPrintableCount > sampleSize * 0.1;
    } catch (error) {
        console.error(`Error checking if file is binary: ${error}`);
        return false;
    }
}

import { suite, test, suiteSetup, suiteTeardown } from 'mocha';

suite('Binary File Detection Tests', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multisplit-tests-'));

    // Create test files before running tests
    suiteSetup(async () => {
        // Create a text file
        const textFilePath = path.join(tmpDir, 'text-file.txt');
        fs.writeFileSync(textFilePath, 'This is a text file with normal content.\n');

        // Create a binary file (using some non-printable characters)
        const binaryFilePath = path.join(tmpDir, 'binary-file.bin');
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD, 0xFC]);
        fs.writeFileSync(binaryFilePath, binaryData);
    });

    // Clean up test files after tests
    suiteTeardown(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('Should detect text files correctly', async () => {
        const textFilePath = path.join(tmpDir, 'text-file.txt');
        const textFileUri = vscode.Uri.file(textFilePath);

        const isBinary = await isBinaryFile(textFileUri);
        assert.strictEqual(isBinary, false);
    });

    test('Should detect binary files correctly', async () => {
        const binaryFilePath = path.join(tmpDir, 'binary-file.bin');
        const binaryFileUri = vscode.Uri.file(binaryFilePath);

        const isBinary = await isBinaryFile(binaryFileUri);
        assert.strictEqual(isBinary, true);
    });
});
