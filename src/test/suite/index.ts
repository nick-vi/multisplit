import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 60000 // Longer timeout for VS Code extension tests
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise<void>(async (resolve, reject) => {
		try {
			// The glob function now returns a Promise in newer versions
			const files = await glob('**/**.test.js', { cwd: testsRoot });

			// Add files to the test suite
			files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

			try {
				// Run the mocha test
				mocha.run((failures: number) => {
					if (failures > 0) {
						reject(new Error(`${failures} tests failed.`));
					} else {
						resolve();
					}
				});
			} catch (error: unknown) {
				console.error(error);
				reject(error);
			}
		} catch (error: unknown) {
			console.error(error);
			reject(error);
		}
	});
}
