import * as assert from 'assert';

// Import the IgnorePatterns class
// Note: We need to make the class accessible for testing
// This will require a small modification to the extension.ts file

// Since we can't directly import the IgnorePatterns class yet, we'll recreate it for testing
class IgnorePatterns {
    private patterns: string[] = [];

    constructor(patterns: string[]) {
        this.patterns = patterns.filter(pattern => {
            // Remove empty lines and comments
            return pattern.trim() !== '' && !pattern.trim().startsWith('#');
        }).map(pattern => pattern.trim());
    }

    public ignores(filePath: string): boolean {
        // Normalize path to use forward slashes
        const normalizedPath = filePath.replace(/\\/g, '/');

        for (const pattern of this.patterns) {
            // Handle directory patterns (ending with /) - match any file in that directory
            if (pattern.endsWith('/')) {
                const dirPattern = pattern.slice(0, -1);
                if (normalizedPath.startsWith(dirPattern + '/') || normalizedPath === dirPattern) {
                    return true;
                }
                continue;
            }

            // Handle wildcard patterns
            if (pattern.includes('*')) {
                const regexPattern = pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*/g, '.*');
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

import { describe, it } from 'mocha';

describe('IgnorePatterns Tests', () => {
    it('Should ignore exact file matches', () => {
        const ignorePatterns = new IgnorePatterns(['file.txt', 'another/file.js']);

        assert.strictEqual(ignorePatterns.ignores('file.txt'), true);
        assert.strictEqual(ignorePatterns.ignores('another/file.js'), true);
        assert.strictEqual(ignorePatterns.ignores('not-ignored.txt'), false);
    });

    it('Should ignore directory patterns', () => {
        const ignorePatterns = new IgnorePatterns(['node_modules/', 'dist/']);

        assert.strictEqual(ignorePatterns.ignores('node_modules'), true);
        assert.strictEqual(ignorePatterns.ignores('node_modules/file.js'), true);
        assert.strictEqual(ignorePatterns.ignores('dist/bundle.js'), true);
        assert.strictEqual(ignorePatterns.ignores('src/file.js'), false);
    });

    it('Should ignore wildcard patterns', () => {
        const ignorePatterns = new IgnorePatterns(['*.log', 'temp/*', '*.min.*']);

        assert.strictEqual(ignorePatterns.ignores('error.log'), true);
        assert.strictEqual(ignorePatterns.ignores('temp/file.txt'), true);
        assert.strictEqual(ignorePatterns.ignores('script.min.js'), true);
        assert.strictEqual(ignorePatterns.ignores('normal.js'), false);
    });

    it('Should handle empty lines and comments', () => {
        const ignorePatterns = new IgnorePatterns([
            '',
            '# This is a comment',
            'file.txt',
            '',
            '# Another comment',
            '*.log'
        ]);

        assert.strictEqual(ignorePatterns.ignores('file.txt'), true);
        assert.strictEqual(ignorePatterns.ignores('error.log'), true);
        assert.strictEqual(ignorePatterns.ignores('# This is a comment'), false);
    });
});
