# Hallmark UI & Component Design Rules

This rule is active for all frontend and UI development across the MES application.

## Rule Guidelines
1. **Never use italics in display headings**: Headings must be `font-style: normal`.
2. **Implement all 8 states on interactive components**:
   - `default`
   - `hover`
   - `focus` (`:focus-visible` with 2px solid outline and 2px offset)
   - `active`
   - `disabled` (with `aria-disabled="true"`)
   - `loading` (with `data-state="loading"`)
   - `error` (with `data-state="error"`, `aria-invalid="true"`, and descriptive text)
   - `success` (with `data-state="success"`)
3. **No layout shifts on interaction**: Constant border-width across all states.
4. **Input height equals button height**: Pair adjacent form elements with identical baseline heights.
5. **Locked design tokens**: Use Tailwind `industrial-*`, `status-*`, or CSS variables.
6. **No AI Slop patterns**: No purple gradients, no card-in-card nesting, no gradient text, no fake browser chrome dots.
7. **Stamp all generated UI components**:
   ```tsx
   /* Hallmark · component: <Name> · genre: modern-minimal · register: industrial-workbench
    * states: default · hover · focus · active · disabled · loading · error · success
    */
   ```
