import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(ROOT, 'js', 'game.bundle.js');

await build({
  absWorkingDir: ROOT,
  entryPoints: ['js/local-entry.js'],
  outfile,
  bundle: true,
  splitting: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  loader: {
    '.html': 'text',
    '.glb': 'base64',
  },
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});

const output = await stat(outfile);
console.log(`Standalone browser bundle: js/game.bundle.js (${Math.ceil(output.size / 1024)} KiB)`);
