# Codemods — historical migration tooling

`ai-color-sweep.mjs` is the reusable TS-AST class-list rewriter
(`node scripts/codemods/ai-color-sweep.mjs <files> --map=<map.json> [--exact=…] [--write]`).
Map keys are `prop|value` (or `prop|light|dark` for collapsing a base +
`dark:` pair into one role utility); values are the replacement utility.

The `*.json` maps in this directory are **frozen artifacts of executed
migrations** (the 2026-07 design-token sweep and the token rename pass).
Both their keys and their replacement values reference token names as they
existed at the time — many have since been renamed (e.g. `ai-wash` →
`ai-hover`, `pro-old-blue` → `pro-accent`, `research-navy-soft` →
`research-heading`). **Do not re-run an old map**: it would emit class
names that no longer compile. Write a fresh map against the current theme
files instead, and verify with `verify-value-drift.mjs`.

`src/tailwind.css` excludes this directory from Tailwind source scanning
(`@source not '../scripts'`) so the class names in these maps never
generate CSS.
