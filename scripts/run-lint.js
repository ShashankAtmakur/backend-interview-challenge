#!/usr/bin/env node
const { ESLint } = require('eslint');

(async function main() {
  try {
    const eslint = new ESLint({
      overrideConfig: {
        parser: '@typescript-eslint/parser',
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: 'module',
        },
        env: { node: true, es2021: true },
        plugins: ['@typescript-eslint'],
        extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
        rules: {
          '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
          '@typescript-eslint/no-explicit-any': 'off',
        },
      },
      ignore: false,
    });

    // Collect .ts files under src manually to avoid ESLint ignore/glob rules interfering
    const fs = require('fs');
    const path = require('path');

    function collectTsFiles(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = [];
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          files.push(...collectTsFiles(full));
        } else if (ent.isFile() && full.endsWith('.ts')) {
          files.push(full);
        }
      }
      return files;
    }

    const filesToLint = collectTsFiles(path.join(process.cwd(), 'src'));
    if (filesToLint.length === 0) {
      console.log('No TypeScript files found to lint');
      process.exitCode = 0;
      return;
    }

    const results = [];
    for (const f of filesToLint) {
      const code = fs.readFileSync(f, 'utf8');
      const res = await eslint.lintText(code, { filePath: f });
      results.push(...res);
    }
    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);
    if (resultText) console.log(resultText);

    const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
    if (errorCount > 0) {
      console.error(`ESLint found ${errorCount} error(s)`);
      process.exitCode = 1;
    } else {
      console.log('ESLint passed');
      process.exitCode = 0;
    }
  } catch (err) {
    console.error('Failed to run ESLint:', err);
    process.exitCode = 2;
  }
})();
