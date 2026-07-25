// Bundle src/app/main.js + styles.css + index.html body into single-file dists.
// dist/index.html    — full standalone document
// dist/artifact.html — body-content only (Claude Artifact adds the skeleton)
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
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
// Installability rides on the FULL document only — the artifact build is body-only
// and its viewer's CSP blocks sibling files anyway (README "Deployment").
const pwaHead = '<link rel="manifest" href="manifest.webmanifest">\n'
  + '<meta name="theme-color" content="#0a0d15">\n'
  + '<link rel="apple-touch-icon" href="icon-192.png">';
const inner = `<title>Point Defense</title>\n${meta}\n<style>\n${css}</style>\n${body}\n<script>${js}</script>`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n${meta}\n${pwaHead}\n<title>Point Defense</title>\n<style>\n${css}</style>\n</head>\n<body>\n${body}\n<script>${js}</script>\n</body>\n</html>\n`);
// dist/ is no longer one file: the manifest and its icons ship beside it
copyFileSync(join(root, 'manifest.webmanifest'), join(root, 'dist/manifest.webmanifest'));
for (const png of ['icon-192.png', 'icon-512.png']) {
  copyFileSync(join(root, 'assets', png), join(root, 'dist', png));
}
writeFileSync(join(root, 'dist/artifact.html'), inner + '\n');

console.log(`built dist/index.html (${(js.length + css.length + body.length) >> 10} KB inlined) + manifest + icons`);
