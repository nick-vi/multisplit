import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';

/**
 * This is a simplified test runner that doesn't download a separate VS Code instance.
 * Instead, it runs the tests in the current VS Code instance.
 */
async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        console.log('Running tests in current VS Code instance...');
        console.log(`Extension development path: ${extensionDevelopmentPath}`);
        console.log(`Extension tests path: ${extensionTestsPath}`);

        // Use the VS Code CLI to run tests in the current instance
        const vscodeBin = process.env.VSCODE_BIN || 'code';

        const args = [
            '--extensionDevelopmentPath=' + extensionDevelopmentPath,
            '--extensionTestsPath=' + extensionTestsPath,
            '--disable-extensions'
        ];

        console.log(`Running command: ${vscodeBin} ${args.join(' ')}`);

        const result = cp.spawnSync(vscodeBin, args, {
            encoding: 'utf-8',
            stdio: 'inherit'
        });

        if (result.error) {
            console.error('Error running tests:', result.error);
            process.exit(1);
        }

        if (result.status !== 0) {
            console.error(`Tests failed with exit code: ${result.status}`);
            process.exit(result.status || 1);
        }

        console.log('Tests completed successfully');
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
