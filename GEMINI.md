# Hallmark Design Rules for MES Production System

This file defines the mandatory design, component, and CSS rules for all frontend UI work in the MES (Manufacturing Execution System) project. All UI code, React components, Tailwind styling, and CSS generated MUST strictly adhere to the Hallmark design philosophy.

---

## 1. Core Philosophy: Eliminating "AI Slop"

Hallmark exists to eradicate the generic, recognizable hallmarks of AI-generated user interfaces. Every UI view must possess an intentional, distinctive architectural point of view:
- **Genre for MES**: `modern-minimal` with the `industrial-workbench` technical register (Space Grotesk / Inter Tight display + Inter body + JetBrains Mono metrics, cool engineered paper, electric signal accents, crisp hairlines, and strict state discipline).
- **No generic AI templates**: Avoid purple-to-pink gradients, unmotivated card-in-card nesting, Inter-only monotony, 3-column identical feature cards with icons floating above headings, and fake UI chrome.

---

## 2. Six Disciplines Enforced on Every Output

These disciplines apply universally across all UI components, pages, and stylesheets:

### 1. Typography Purity — NO Italic Headers
- Headings and display text (`h1`, `h2`, `h3`, `h4`, display badges) are **always roman (`font-style: normal`)**.
- **NEVER** use italic emphasis inside a headline (e.g. `Real-time <em>Telemetry</em>` or `font-italic` on headings) — this is a primary AI tell.
- Emphasis on headings must be achieved solely through font weight, accent color, or a subtle underline. Italic is permitted exclusively for contextual body-copy emphasis inside paragraphs.
- **2+1 Font Discipline**:
  - Display face: Sharp, tight-tracking geometric sans (`Space Grotesk` or `Inter Tight`).
  - Body face: High-legibility neutral sans (`Inter`).
  - Monospace / Data face: Technical tabular numbers and code (`JetBrains Mono` or `ui-monospace`).
- **Solid Ink Only**: Never apply gradient fills (`background-clip: text`) to headings or labels.

### 2. Locked Tokens — Zero Mid-Render Improvisation
- All colors and styling primitives must reference defined design tokens (`var(--color-paper)`, `var(--color-ink)`, `var(--color-accent)`, or Tailwind `industrial-*` / `status-*` tokens).
- Never inline raw arbitrary hex (`#845ef7`), uncalibrated `rgb()`, or ad-hoc OKLCH values in components.
- If a new functional color is needed, declare it in the token block first, then reference it.

### 3. Forbidden Redrawn Chrome
- Do **not** hand-code decorative fake browser titlebars (mock URL pills, red/yellow/green traffic-light dots), fake mobile frames, or fake IDE window chrome.
- Content must stand on its own or use genuine system chrome and semantic containers (`<figure>`, `<section>`, `<fieldset>`).

### 4. Honest Copy & Real Telemetry — No Fabricated Metrics
- In an industrial MES, telemetry and metrics represent physical plant conditions.
- Never invent marketing fluff (*"99.9% uptime"*, *"trusted by 50,000+ teams"*, *"10× faster"*).
- When a live sensor value is unavailable or disconnected, display explicit engineering placeholders (`--`, `0.0`, or `[DISCONNECTED]`) with stale data indicators (`quality: Bad`).

### 5. Mobile & Viewport Safety
- Verified across viewports: `320px`, `375px`, `414px`, `768px`, and desktop `1280px+`.
- Root `overflow-x: clip` on `html` and `body` (never `hidden`).
- Clickable targets (buttons, nav items) must maintain at least `44×44px` hit target.
- Avoid two-line text wrapping on interactive buttons and actions.
- Grid tracks bearing data or charts must use `minmax(0, 1fr)`.

### 6. Pre-Emit Self-Critique & Hallmark Stamp
- Before emitting component or page code, evaluate on the 6 Hallmark axes (Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety) with scores ≥ 3/5.
- Stamp components with the official Hallmark metadata comment:
  ```tsx
  /* Hallmark · component: <Name> · genre: modern-minimal · register: industrial-workbench
   * states: default · hover · focus · active · disabled · loading · error · success
   * contrast: WCAG AA Pass
   */
  ```

---

## 3. Component Scope: Strict 8-State Requirement

Every interactive element (Button, Input, Select, Switch, Tab, Modal action) **MUST** implement and support all **8 states**:

| State | Trigger | Required Styling Treatment |
| :--- | :--- | :--- |
| **1. Default** | Rest state | Base paper background, crisp border, solid ink typography |
| **2. Hover** | Pointer over (`@media (hover: hover)`) | Subtle background shift (4–6% tint) or 1px translate. Border width unchanged. |
| **3. Focus** | Keyboard focus (`:focus-visible`, `.is-focus`) | `outline: 2px solid var(--color-focus); outline-offset: 2px;` Never `outline: none` without replacement. |
| **4. Active** | Pressed (`:active`, `.is-active`) | Subtle inset shift: `transform: translateY(1px)` or slightly darkened fill. |
| **5. Disabled** | Inactive (`:disabled`, `aria-disabled="true"`) | `opacity: 0.5; cursor: not-allowed; pointer-events: none;` |
| **6. Loading** | Async in-flight (`[data-state="loading"]`) | Inline spinner, label remains legible, button interactive state locked. |
| **7. Error** | Validation failed (`[data-state="error"]`, `aria-invalid="true"`) | `border-color: var(--color-error);` paired with error text and warning icon (never color alone). |
| **8. Success** | Operation completed (`[data-state="success"]`) | Subtle emerald confirmation border/indicator, auto-clearing if re-edited. |

### The No-Layout-Shift Rule
- **Border thickness remains constant across all states** (always 1px or 2px).
- Focus and error indicators must use `outline`, `box-shadow`, or background shifts — **never increase `border-width` on focus/hover**, which causes jarring layout shifts.
- **Input Height = Button Height**: Standardize control heights across rows (e.g. `h-9` (36px) or `h-10` (40px) or `h-11` (44px) touch floor).

---

## 4. Specific Anti-Patterns Strictly Banned

1. **The Purple/Cyan Gradient Hero**: Banned. Use a single restrained accent or neutral tinted paper.
2. **Card-in-Card Nesting**: Banned. Do not nest borders within borders unless there is a strict semantic hierarchy.
3. **The 3-Column Identical Feature Grid**: Banned. Break symmetric cards using metric strips, asymmetrical master-detail panels, or technical workbench tables.
4. **Asymmetric Thick Stripe Cards**: Banned. Never use thick 4–6px colored left borders on cards. Use clean hairlines or status dots.
5. **Glassmorphism / Heavy Backdrop Blurs**: Banned. Industrial controls require solid, legible, high-contrast surfaces.
6. **Pure #000000 / Pure #FFFFFF Floods**: Use tinted neutrals (`#F8FAFC`, `#0F172A`, `#1E293B`, `oklch(98% 0.005 240)`).

---

## 5. MES Design System Token Specification

When creating CSS or Tailwind classes, conform to the canonical palette:
- **Surface / Paper**: `--color-paper` (`#F8FAFC` / `industrial-50`), `--color-surface` (`#FFFFFF`), `--color-surface-hover` (`#F1F5F9`).
- **Ink / Typography**: `--color-ink` (`#0F172A` / `industrial-900`), `--color-ink-muted` (`#64748B` / `industrial-500`).
- **Hairlines / Rules**: `--color-rule` (`#CBD5E1` / `industrial-300`), `--color-rule-subtle` (`#E2E8F0`).
- **Focus Ring**: `--color-focus` (`#0284C7` / Sky-600 or `#334155`).
- **Industrial Status (ISA-101)**:
  - Normal / Running: `--color-status-good` (`#16A34A` / Emerald-600)
  - Alarm / Fault / Offline: `--color-status-bad` (`#DC2626` / Rose-600)
  - Warning / In-Progress: `--color-status-warning` (`#D97706` / Amber-600)
