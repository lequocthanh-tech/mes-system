# Hallmark Design Rules for MES Production System (AGENTS.md)

All agents, subagents, and tools generating code for this project MUST strictly follow the Hallmark Design Rules documented below.

## 1. Core Mandate
Every UI component, CSS rule, and frontend page must avoid generic AI aesthetic tropes ("AI Slop") and adhere to the **Hallmark Industrial-Workbench** standard:
- **Genre**: `modern-minimal` (Industrial technical register: Space Grotesk / Inter display, Inter body, JetBrains Mono data).
- **No Italic Headers**: Display and heading type are strictly roman (`font-style: normal`). Never use italics in headlines or titles.
- **8-State Requirement**: Every interactive component (button, input, select, switch, tab) must implement all 8 states:
  1. Default
  2. Hover (`:hover`, `.is-hover`)
  3. Focus (`:focus-visible`, `.is-focus` with 2px offset outline)
  4. Active / Pressed (`:active`, `.is-active`)
  5. Disabled (`:disabled`, `aria-disabled="true"`)
  6. Loading (`[data-state="loading"]`, `.is-loading`)
  7. Error (`[data-state="error"]`, `aria-invalid="true"`)
  8. Success (`[data-state="success"]`, `.is-success`)
- **No Layout Shift**: Border thickness must remain constant across all states. Never change `border-width` on focus or hover.
- **Standardized Control Heights**: Input height must equal button height (`h-9` or `h-10` or `h-11`).
- **Locked Tokens**: Reference design tokens (`var(--color-*)` or Tailwind `industrial-*` / `status-*`). Never inline arbitrary hex codes or un-tokenized colors.
- **Forbidden Patterns**:
  - No purple/cyan gradients.
  - No card-in-card nesting without semantic hierarchy.
  - No gradient text (`background-clip: text`).
  - No fake UI window chrome or red/yellow/green browser dots.
  - No fabricated marketing metrics. Real telemetry or explicit placeholders (`--`) only.
- **Hallmark Metadata Stamp**: Include pre-emit critique stamp at the top of components:
  ```tsx
  /* Hallmark · component: <Name> · genre: modern-minimal · register: industrial-workbench
   * states: default · hover · focus · active · disabled · loading · error · success
   * contrast: WCAG AA Pass
   */
  ```
