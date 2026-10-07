# Design — MES Production System

Locked design system following Hallmark principles. Future agent runs and UI generations read this file first; all pages and components defer to it.

## System
- Genre · `modern-minimal` (Industrial Workbench register)
- Macrostructure · `Workbench / Bento Grid` (Instrument panel, live telemetry, high-density industrial control)
- Theme · `Cobalt / Industrial-101` (Cool near-white paper, slate neutrals, electric cobalt signal accents, ISA-101 status indicators)
- Axes · Cool engineered paper / Crisp geometric display / Single signal accent (ISA-101 status mapped)

## Tokens (Canonical)
```css
:root {
  /* Paper / Surface Scales (OKLCH & Industrial Muted) */
  --color-paper:          #F8FAFC; /* industrial-50: canvas background */
  --color-paper-2:        #F1F5F9; /* industrial-100: table headers / card hover */
  --color-surface:        #FFFFFF; /* clean control surface */
  --color-surface-hover:  #F8FAFC;

  /* Ink / Typography Scales */
  --color-ink:            #0F172A; /* industrial-900: primary text & values */
  --color-ink-2:          #334155; /* industrial-700: secondary headers */
  --color-ink-muted:      #64748B; /* industrial-500: captions & units */

  /* Hairlines & Structural Rules */
  --color-rule:           #CBD5E1; /* industrial-300: crisp dividing borders */
  --color-rule-subtle:    #E2E8F0; /* industrial-200: subtle cell dividers */

  /* Signal Accents & Focus */
  --color-accent:         #0284C7; /* Sky-600 / Cobalt: active selection */
  --color-accent-ink:     #0369A1;
  --color-focus:          #0284C7; /* High contrast keyboard focus ring */

  /* Industrial Status (ISA-101 compliant) */
  --color-status-good:    #16A34A; /* Emerald-600: Normal running / Good quality */
  --color-status-good-bg: #F0FDF4;
  --color-status-bad:     #DC2626; /* Rose-600: Alarm / Fault / Bad quality */
  --color-status-bad-bg:  #FEF2F2;
  --color-status-warn:    #D97706; /* Amber-600: Advisory / In-progress */
  --color-status-warn-bg: #FFFBEB;

  /* Typography Scale */
  --font-display:         "Space Grotesk", "Inter Tight", "Inter", sans-serif;
  --font-body:            "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:            "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  /* 8-State Geometry */
  --border-width-base:    1px; /* Constant across all states to prevent layout shift */
  --radius-control:       4px; /* Crisp industrial 4px radius */
  --radius-card:          6px;
  --radius-pill:          9999px;
  --control-height:       36px; /* Standardized height for inputs and buttons */

  /* Transitions */
  --ease-industrial:      cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast:             150ms;
  --dur-base:             200ms;
}
```

## CTA & Control Voice
- Primary Action · Solid Dark Slate (`bg-slate-900 text-white hover:bg-slate-800`) or Cobalt Accent · `h-9` (36px) · 4px radius.
- Secondary Action · Crisp Outlined Paper (`bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400`).
- Industrial Danger / Emergency · High-visibility Red (`bg-rose-600 text-white hover:bg-rose-700`).

## Interactive 8-State Contract
Every interactive component (buttons, inputs, dropdowns, switches, tabs) must implement:
1. `default`: Standard paper fill, 1px border.
2. `hover`: Subtle tint shift (`bg-slate-50`), border width unchanged.
3. `focus`: `outline: 2px solid var(--color-focus); outline-offset: 2px;` via `:focus-visible`.
4. `active`: 1px translateY push down, slightly deeper fill.
5. `disabled`: `opacity: 0.5; cursor: not-allowed; pointer-events: none;`
6. `loading`: Spinner indicator in place of icon, interactive lock.
7. `error`: Constant 1px border colored red (`var(--color-status-bad)`), paired with error message text.
8. `success`: Subtle green confirmation badge or border.

## Anti-Patterns Strictly Banned
- No italic headers (`font-style: normal` always on headings).
- No purple-to-pink gradient backgrounds or gradient text.
- No card-in-card visual clutter.
- No fake browser window dots.
- No layout shift on focus/hover (border-width never changes).
