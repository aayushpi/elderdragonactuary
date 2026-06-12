# Elder Dragon Actuary — Monocled Dragon Eye

Slit-pupil dragon eye behind a monocle (dotted chain off the lower-right rim).
Canonical artwork lives on a 64-unit grid.

## Colors
| Token | On light | On dark |
|---|---|---|
| Ink (rim, eye, chain) | `#16161a` | `#fafafa` |
| Accent (pupil) | `#ea580c` (orange-600) | `#fb923c` (orange-400) |
| Tile background | — | `#0c0c0e` |

In-app, the mark inherits theme tokens instead: ink = `hsl(var(--foreground))`,
pupil = `hsl(var(--primary))` — it recolors automatically with the accent setting.
The live React source is `src/components/modern/LogoMark.tsx`; `LogoMark.jsx`
here is a framework-agnostic reference copy.

## Files
- `mark.svg` / `mark-dark.svg` — full mark with chain, for light / dark backgrounds
- `mark-mono.svg` — single-color (`currentColor`), for stamps, embossing, loading states
- `mark-small.svg` / `mark-small-dark.svg` — centered, chainless variant for < 24px
- `favicon.svg`, `favicon-32.png`, `favicon-16.png` — rounded dark tile, chainless
- `app-icon.svg` — full-bleed dark source tile (with chain) for the raster app icons
- `icon-1024 / 512 / 192.png`, `apple-touch-icon.png` — full-bleed app-icon tiles
  (no corner radius baked in; iOS/Android apply their own masks)
- `LogoMark.jsx` — theme-aware reference component (chain auto-drops below 24px)

## Rules
- **Minimum sizes:** 16px chainless, 24px with chain.
- **Clear space:** keep ≥ 25% of the mark's width clear on all sides.
- **Don't** rotate, add gradients, outline the pupil, or recolor the chain
  separately from the rim.

## HTML embed
```html
<link rel="icon" href="/logo/favicon.svg" />
<link rel="apple-touch-icon" href="/logo/apple-touch-icon.png" />
```
