// Bundle src/app/main.js + styles.css + index.html body into single-file dists.
// dist/index.html    — full standalone document
// dist/artifact.html — body-content only (Claude Artifact adds the skeleton)
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');

const result = await esbuild.build({
  entryPoints: [join(root, 'src/app/main.js')],
  bundle: true, minify: true, format: 'iife', target: ['es2020'],
  write: false,
});
const js = result.outputFiles[0].text;
if (js.includes('</script>')) throw new Error('bundle contains </script>; inline embedding would break');

const css = read('styles.css');
const bodyMatch = read('index.html').match(/<!-- BODY-START -->([\s\S]*?)<!-- BODY-END -->/);
if (!bodyMatch) throw new Error('BODY markers missing in index.html');
const body = bodyMatch[1].trim();

const meta = '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">';
const inner = `<title>Point Defense</title>\n${meta}\n<style>\n${css}</style>\n${body}\n<script>${js}</script>`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n${meta}\n<title>Point Defense</title>\n<style>\n${css}</style>\n</head>\n<body>\n${body}\n<script>${js}</script>\n</body>\n</html>\n`);
writeFileSync(join(root, 'dist/artifact.html'), inner + '\n');

console.log(`built dist/index.html (${(js.length + css.length + body.length) >> 10} KB inlined)`);
