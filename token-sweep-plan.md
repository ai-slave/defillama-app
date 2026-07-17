# Design-token quarantine — state & repoint playbook

The original multi-phase sweep plan that lived here was executed on the
`token-sweep` branch (2026-07-16); see that branch's commit messages for the
full record. What remains below is the part that still matters: where color
now lives, and how the remaining debt retires.

## Current state

Every color, shadow, and animation value in class names flows through one of:

- **Semantic tokens** (`src/styles/semantics.css`) — registered utilities
  (`text-primary`, `bg-surface`, `border-medium`, `text-error/success/warning`,
  `text-data-up/down`, elevation `shadow-*` tokens in `tailwind.css`).
- **Product themes** (standing products, value-frozen palettes; may never
  migrate and that's fine):
  - `--ai-*` (`styles/themes/llamaai.css`) — LlamaAI, pages/ai
  - `--sub-*` (`styles/themes/subscription.css`) — Subscription/Sheets/Account
  - `--pro-*`, `--sl-*` (`styles/themes/pro.css`) — ProDashboard, Investors
  - `--research-*`, `--callout-*` (`styles/articles.css`)
  - `tailwind.css` keeps only non-design-system app tokens: the single
    `--interim-brand-tint-hover` (ratcheted), the dlnews partner logo mark,
    and the documented apy/yield domain tiers
- **Deliberate exceptions**: hljs syntax palette, chain-brand card glows,
  MicaFinder category accents, media-overlay black/white alphas, ECharts hex
  configs (data, not CSS).

`bun run lint:tokens` ratchets raw values everywhere and treats product
tokens/utilities as core-leak detectors (products may grow their own themes); every count-changing PR runs `--update` in the same commit. Never
hand-edit the baseline. Codemods and their mapping tables live in
`scripts/codemods/` (`ai-color-sweep.mjs --map=… [--exact=…]`, verified with
`verify-value-drift.mjs`).

## If a product ever adopts the design system (optional, needs design review)

1. **Repoint, per surface**: edit its theme file's values to
   `var(--semantic-token)` equivalents, review visually, then codemod its
   utilities to the semantic ones, delete the file, and move the surface out
   of the ratchet's `EXCLUDED_PRODUCT_PREFIXES` so it's held to core standards.
2. **Type-ramp adoption**: ~950 `text-[10px]`/`text-[11px]` micro-labels in
   excluded surfaces — mapping them to `label-xs`/`body-xs` changes
   line-heights and weights; per-surface pass.
3. Known design-library gaps, all clearly namespaced away from the design
   system: `--interim-brand-tint-hover` (tailwind.css — the only `--interim-*`
   token, ratcheted so no more appear), Announcement's component-local
   `--announcement-bg`, and the link-tint/glass/switch values duplicated into
   the product themes that use them.

## Hard-won constraints

- `themes/pro.css` re-scopes `--pro-{app-bg,cards-bg,cards-border,
  form-control-border,old-blue,text-primary,text-secondary,text-tertiary,
  text-label,text-form}` inside `pro-dashboard` — never rewrite those names'
  callsites in ProDashboard/Investors/Downloads/AddToDashboard/pages-pro to
  semantic utilities; the alias→semantic identity does not hold there.
- Codemods use the TS AST, never regex over source.
- Watch for `*/` inside CSS comments and name collisions when adding vars
  (themes/subscription.css already had `--sub-text-muted`).
