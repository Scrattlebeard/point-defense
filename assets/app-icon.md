# App icon

`app-icon.svg` is the source; `icon-192.png` and `icon-512.png` are generated from
it and are what `manifest.webmanifest` points at (PNG, because manifest icon support
for SVG is uneven across the platforms that matter here).

The motif is the Point itself — the same concentric rings `render.js: drawTower`
draws, so the home-screen icon and the thing you defend are the same object.

**Regenerate** (no image tooling in this repo; Firefox is the rasteriser):

```sh
for sz in 192 512; do
  printf '<!doctype html><style>html,body{margin:0;background:#0a0d15}svg{display:block;width:%spx;height:%spx}</style>' $sz $sz > /tmp/icon-$sz.html
  sed 's/width="512" height="512"/width="100%" height="100%"/' assets/app-icon.svg >> /tmp/icon-$sz.html
  firefox --headless --screenshot "$PWD/assets/icon-$sz.png" --window-size=$sz,$sz "file:///tmp/icon-$sz.html"
done
```

The wrapper is load-bearing: `firefox --screenshot` on a bare SVG **crops** it to the
window instead of scaling, so a naive render produces a 192×192 corner of the artwork
(this happened on the first attempt). `test/pwa.test.mjs` reads the PNG headers and
fails if a file's real dimensions stop matching what the manifest declares.
