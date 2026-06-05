# Hexlight

A fully client-side planner for hexagonal (honeycomb) LED bar lighting. Place hexes on a grid, get a live bill of materials (bars, connectors, power inputs), and check floor-level illuminance (lux) against EN 12464-1 targets. The interface is in Arabic (RTL).

## Live

https://147hex.pages.dev

## Features

- Two draw modes: Hex and Lines (8-direction) with legality checks (no crossing/overlap, junction angles limited to 90/120/180 degrees, max 4 bars per node).
- Live bill of materials: bars counted by length, automatic connector detection (I, L, V, Y, T, X), power inputs (max 420 W each), and an estimated price.
- Light check: lumen-method lux estimate (CU from room geometry x 0.80 maintenance factor / floor area) with a gauge and per-use-case targets.
- Standard T5 sizes: 30 / 45 / 60 / 90 / 120 cm (actual lengths measured including pins).
- LED colours: 6500K, 4000K, 3000K, and RGBIC (animated rainbow). The 30 cm bar is RGBIC-only.
- Ready-made templates, pan/zoom, drag-paint, undo/redo, and keyboard shortcuts.
- Arabic PDF export with the layout drawing.

## Stack

React 18, TypeScript, Vite, SVG, jsPDF + html2canvas, Cloudflare Pages.

## Run locally

```bash
npm install
npm run dev      # dev server
npm run build    # production build to dist/
npm run deploy   # deploy to Cloudflare Pages (needs wrangler + access)
```

## How it works

- Connectors: classified from the angles of bars at a node (dot < -0.99 -> I, ~0 -> L, otherwise V; 3 bars -> Y; 4+ -> X).
- Power: each connected component is a run; inputs = ceil(watts / 420), minimum 1.
- Lux: `lux = lumens x CU(RCR) x 0.80 / area`, where `RCR = 5 x cavity x (W + L) / area`. This is a +/-20% estimate.

## Developer

- Email: ualiamer@riseup.net
- GitHub: https://github.com/uAliAmer

## Note

A browser-side estimation tool. Not a substitute for a full photometric simulation, and not affiliated with any LED brand.
