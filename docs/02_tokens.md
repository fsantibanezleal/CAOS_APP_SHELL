# 02 Tokens

Every value a product might want to repeat is a custom property in `styles.css`, listed in `SHELL_TOKENS` (a unit
test keeps the list equal to the stylesheet). A product names a token (`var(--rail-w)`) instead of writing the number;
the template's web-baseline guard fails a `var(--x)` that neither the shell nor the product defines, because an
undefined token renders as nothing, silently. A canvas or WebGL renderer cannot read custom properties: it takes
`useThemeTokens()` (the colours resolved for the active theme) or `resolveToken(name)`.

## Colours

Keyed on `data-theme` on `<html>`, set before the first frame by `THEME_BOOT_SCRIPT`.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--color-bg` | `#0d1117` | `#f6f8fa` | the page |
| `--color-surface` | `#161b22` | `#ffffff` | cards, the rail, plot cards, the footer |
| `--color-surface-2` | `#1c2230` | `#f0f3f6` | raised parts: callouts, verdicts, chips' hover, inputs |
| `--color-border` | `#30363d` | `#d0d7de` | borders, grid lines |
| `--color-fg` | `#c9d1d9` | `#1f2328` | text |
| `--color-fg-subtle` | `#9aa6b2` | `#57606a` | secondary text, axis labels |
| `--color-fg-faint` | `#828b97` | `#656d77` | captions, units, footer, notes |
| `--color-accent` | `#58a6ff` | `#0969da` | links, the selected tab, the first series |
| `--color-accent-fg` | `#0d1117` | `#ffffff` | text on the accent |
| `--color-accent-soft` | `#132036` | `#ddf4ff` | the selected tab's background |
| `--color-accent-2` | `#3fb1c8` | `#0a7886` | real-data badges, a second accent |
| `--color-magenta` | `#f778ba` | `#b93785` | synthetic-data badges, a series |
| `--color-good` | `#3fb950` | `#197c36` | tones, the live lane |
| `--color-warn` | `#d29922` | `#946300` | tones, caveats, marks |
| `--color-bad` | `#f85149` | `#cf222e` | tones, errors |
| `--color-shadow` | (a shadow) | (a shadow) | card shadow |

**Every text colour reads at WCAG AA (4.5:1) on `bg`, `surface`, `surface-2` and the `accent-soft` highlight in both
themes**, and the accent-fg on the accent too (`test/base08.test.tsx` computes all of them). Until 0.8.0 the faint text
read 3.49:1 on the dark raised surface and 4.08:1 on the light one; `fg-faint`, the light `accent-2` and the light
`warn` were moved the least distance that clears 4.5:1. In 0.9.1 the light `good` and `magenta` moved the same way, so
a selected row can carry its tone text on the highlight (CAOS_Fragmenta's table read 4.46:1). G13 measures every
rendered text the same way.

## Type, space, radii

| Token | Value | | Token | Value | | Token | Value |
|---|---|---|---|---|---|---|---|
| `--text-xs` | 0.74rem | | `--space-1` | 0.25rem | | `--radius-sm` | 6px |
| `--text-sm` | 0.84rem | | `--space-2` | 0.5rem | | `--radius-md` | 8px |
| `--text-md` | 0.92rem | | `--space-3` | 0.75rem | | `--radius-lg` | 10px |
| `--text-base` | 0.98rem | | `--space-4` | 1rem | | `--radius-pill` | 999px |
| `--text-lg` | 1.08rem | | `--space-5` | 1.5rem | | | |
| `--text-xl` | 1.3rem | | `--space-6` | 2.25rem | | | |
| `--text-2xl` | 1.7rem | | | | | | |

`--font-sans` and `--font-mono` are the system stacks. The gate's wide-font pass replaces `--font-sans` with
`Verdana, "DejaVu Sans", sans-serif` to render every page as a reader with wider fonts sees it (07 The gate).

## Layout, icons, z-order

| Token | Value | What it sizes |
|---|---|---|
| `--maxw` | 1200px | the document column |
| `--maxw-wide` | 100% | the workbench and the surface |
| `--measure` | 70ch | the `.measure` column and the lede |
| `--measure-text` | 78ch | the longest line of a text block inside a document |
| `--header-h` | 56px | the header row (52 px at 760 px and below) |
| `--rail-w` | `clamp(248px, 19vw, 340px)` | the workbench rail and the focus rail |
| `--fade` | 28px | the faded end of a scrolling row |
| `--icon-sm`, `--icon-md`, `--icon-lg` | 14, 16, 18px | icons (06 Icons and numbers) |
| `--z-header`, `--z-focus`, `--z-modal` | 50, 100, 1000 | the sticky header, the focus frame, dialogs |
