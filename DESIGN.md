# FINANCILY — Design System (DESIGN.md)

> Build guide produced BEFORE coding. All values are implemented as CSS variables in `index.html`; edit the `:root` block to retheme.

---

## 1. Palette

The brief said "keep same as previous version" but no hex values were provided, so I defined a futuristic fintech palette below. **Edit all colours in one place**: the `:root { ... }` block at the top of `index.html`.

| Role | Variable | Hex | Notes |
|-------|----------|-----|-------|
| Primary | `--primary` | `#4f46e5` | Indigo — brand, buttons, focus |
| Secondary | `--secondary` | `#7c3aed` | Violet — gradients, accents |
| Accent | `--accent` | `#06b6d4` | Cyan — glow, highlights, progress |
| Background | `--bg` | `#f4f5fb` | Very light, cool tinted |
| Surface / card | `--surface` | `#ffffff` | White cards |
| Text (body) | `--text` | `#14141a` | Near-black, high contrast |
| Headings | `--heading` | `#05050a` | Near-black |
| Muted text | `--muted` | `#3f3f48` | Must stay ≥ 4.5:1 on white |
| On-dark text | `--on-dark` | `#ffffff` | Pure white |

**Usage rules**
- Only these + their tints/shades (derived via `--p-600`, `--a-400`, etc.).
- Futuristic feel via soft gradients, glass cards (`backdrop-filter`), accent glow (`box-shadow` with `--accent`).
- CSS variables defined once on `:root`; light/dark share the same variables with overrides.

---

## 2. Type scale (Inter / Poppins fallback)

| Token | Size / Weight | Use |
|-------|---------------|-----|
| Display | clamp(2.5rem, 6vw, 4.5rem) · 800 | Hero headline |
| H2 | clamp(1.8rem, 3.5vw, 2.6rem) · 700 | Section titles |
| H3 | 1.25rem · 700 | Card titles |
| Body | 16px (1rem) · 500 · lh 1.6 | Default text |
| Small / helper | 14px · 500 | Labels, helper, placeholder (≥ 4.5:1) |
| Button | 0.95rem · 600 | Call-to-action |

- Body **≥ 16px**, line-height **1.6**. Headings 700–800, body 500.
- No opacity < 0.9 on text. Placeholders/labels/helper pass 4.5:1.

---

## 3. Spacing & layout
- Section padding: `clamp(4rem, 10vw, 8rem)` vertical.
- Grid gutters: 24px; card radius 20px; glass radius 24px.
- Max content width 1140px centered.

---

## 4. Motion rules
- **Easing**: `power3.out` (default), `expo.out` (hero/entrances), `elastic.out(1,0.5)` (playful pop), `bounce.out` (coin drop).
- **Durations**: 0.6–1.2s entrances; 0.3s micro-interactions; 2–3s loops.
- **Stagger**: 0.06–0.12 for lists; 0.03 for character splits.
- Animate **only transform/opacity**. Use `gsap.matchMedia()` to lighten on mobile (<768px) and for `prefers-reduced-motion` (stop loops → simple fades).
- 3D via CSS perspective/`preserve-3d`/`translateZ`/`rotateX/Y` ONLY (no 3D libs).

---

## 5. Contrast — non-negotiable decisions
- Text on light: `#14141a`/`#05050a` (≥ ~14:1). Muted `#3f3f48` ≈ 8:1 on white. ✅
- Text on dark/coloured: pure `#ffffff` (≥ 7:1 on indigo). ✅
- Never place text over animated "busy" objects — solid/high-opacity surface behind text.
- Buttons: white text on `--primary`; visible focus ring (`outline` + `box-shadow`).

---

## 6. Tools / skills used
- Installed & used: **scroll-craft** (scroll choreography: pinned timeline, scrub), **oil-ui** (cards/inputs/buttons/modals/toasts styling), **oil-motion** (easing/stagger rules), **Superdesign** (design-first: this DESIGN.md before build), **web-designer-plugin** (design discipline, pattern hygiene).
- No missing skills — all 5 were installed beforehand.
- GSAP 3.15 via cdnjs (exact version pin).
