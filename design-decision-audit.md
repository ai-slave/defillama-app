# Design Decision Audit

This file tracks design-system audit notes before code changes are made.

## How To Use

- Add one entry per pointed-out component, state, or page area.
- Document what is visually off, what Figma/source context was checked, and what decision is needed.
- Before proposing a fix, map every shared component usage and note special cases.
- Call out surrounding components that may need to move with the change.
- Prefer layout decisions based on grid, padding, gaps, and min-size floors; flag hardcoded heights, margins, and one-off hacks.
- Keep implementation status separate. This file is for observations, context, risks, and decisions.

## Entry Template

### Area

- Route/page:
- Component/file:
- Figma node(s):
- Current issue:
- Shared usage/context:
- Special cases:
- Surrounding layout impact:
- Grid/flex/layout notes:
- Hardcoded hacks to remove:
- Decision needed:
- Proposed direction:
- Verification needed:

## Notes

### Post-Merge Finalization Note — 2026-07-09

- The route-family sweep is merged. Follow-up work must start with a current-code review;
  historical checklist entries alone are insufficient evidence for a visual change.
- Search and Metrics use the shared dialog surface contract. No follow-up is scheduled;
  reopen them only for a reproducible regression, not a second shell migration.
- Segmented controls now have a shared keyboard-complete radio-group primitive. Real
  page-navigation tablists remain separate because they own tab/panel semantics.
- DOM mini-chart tooltip/crosshair chrome is centralized without changing chart series,
  axes, data, dimensions, or ECharts canvas options.
- The token ratchet separates core application debt from explicitly excluded product
  debt, so excluded work cannot mask core regressions. No excluded-product visuals were
  changed during this finalization pass.

### Token Namespace End-State (post-merge proposal, deferred)

- Current issue: The new tokens carry an `--ld-` prefix only because legacy variables
  squat on the clean names (`--text-primary`, `--bg-surface`, …), and legacy names are
  not visually identifiable as legacy (`text-disabled` utility vs `text-(--text-disabled)`
  legacy var resolve to different things).
- Inventory: 58 non-`--ld-` custom props defined in `src/tailwind.css`. Three subsets:
  (a) legacy color/surface tokens to rename (`--text-*`, `--bg-*`, `--cards-*`, `--btn*`,
  `--link*`, `--primary(-hover)`, `--form-control-border`, `--switch-*`, `--divider`,
  `--old-blue`, `--blue`, `--app-bg`, `--bg-main`, …); (b) sanctioned feedback tokens to
  PROMOTE into semantics.css instead of renaming (`--success`, `--error`, `--warning`);
  (c) runtime/layout vars that are not tokens and stay as-is (`--direction`, `--gap`,
  `--drawer-*`, `--popover-anchor-width`, `--dialog-width`, `--sticky-shadow`,
  `--vf-header-scroll-left`, `--rl-size`, `--speed`, `--star-*`).
- Proposed post-merge direction, strictly ordered:
  1. Rename subset (a) to `--legacy-*` everywhere (definitions + consumers). Pure
     mechanical codemod (~7–9k occurrences, mostly excluded surfaces); zero visual
     change since aliases are preserved. Hand-check the JS string reads:
     `MarketMakers/RadarChart.tsx` reads `--text-tertiary` via getComputedStyle;
     `SparklineChart` takes variable names as params; excluded-surface reads stay
     as-is with their surfaces.
  2. Drop the `--ld-` prefix from primitives/semantics/chart tokens and the ~170
     references (tailwind.css @theme registrations, semantics.css, chartTheme.ts,
     6 component arbitrary values) so the design system owns the clean names.
  3. Historical wart: `text-(--text-label)` used to appear in summary metric-card
     recipes, but it is only a legacy alias of text-secondary. Current recipes use
     `text-secondary`; do not carry `--text-label` forward.
  4. New ratchet in `lint:tokens`: `--legacy-` consumer count must not increase.
- Quarantined per-product namespaces (`--pro-*`, `--sub-*`, `--sl-*`, `--signin-*`)
  are already unambiguous and live in deletable legacy-\*.css files; do not rename.
- Status: this rename remains deferred. If it is later approved, run it as a focused
  rename-only branch with both-mode screenshot verification rather than mixing it into
  visual stabilization.

### Resolved Owner Decisions From 2026-07-07

- Keep `Panel` as a separately named contract for true titled chart/table shells: surface, header, divider, body/chart slot, 32px controls, and no chart visual changes. Do not collapse every panel into a generic card.
- Use fixed `Card` outer chrome: `bg-surface border-subtle rounded-[8px]`. Repeated/directory tiles use the same subtle page-surface stroke as protocol/detail cards; `border-medium` is reserved for control/elevated chrome.
- Require explicit `Card`/`Panel` padding at every call site. Density is intentional (`none`, `sm`, `md`, or Card `strip`), not hidden behind primitive defaults.
- Keep the title-strip primitive phased. Current adopters include protocol TVL, Treasury, Active Loans, Forks, CEX assets/stablecoins, chain overview empty/title shell, bridge protocol overview, and LiquidationsV2 summary. Review unlocks/governance/LST separately because they need extra metadata/action slots.
- Use 32px toolbar controls. Use 6px inside dense chart/table toolbar control clusters; use 8px for toolbar padding, page/panel/card gaps, and between larger control groups.
- Keep `PanelHeader` as the taller Figma-derived titled-panel header. Add/use a separate compact chart/table toolbar recipe for route-specific inline chart controls.
- Historical chart decision, now superseded: grid inset changes required screenshots/pixel checks. The landed chart-theme/geometry pass performed that review and established the shared 8px visual-inset contract documented below.
- Multi-select popover rows use compact 14px checkbox boxes in both states: filled blue when selected, empty `border-strong` when unselected. Single-select rows show only the selected check mark and no empty box/circle.
- Dense-card secondary actions can remain compact, for example 24px CSV buttons inside stat cards, while chart/table/action toolbars use 32px controls.
- Refine the current structural `<p>` to `<div>` work rather than reverting: data-card wrappers stay `div`; empty/error/status shells get inner text semantics and `role="status"`/`role="alert"` where appropriate.

### Mobile Dialog Behavior Decision

- Owner decision 2026-07-08: mobile dialogs below `sm` should use bottom-sheet behavior
  rather than centered modal behavior.
- `sm+` behavior stays centered modal unless a route-specific dialog already has a
  different proven pattern. Do not extend dialog bottom-sheet behavior to `lg`.
- Mobile implementation target: portal to the viewport, anchor to the bottom edge,
  round only the top sheet corners, animate with a smooth slide up/down, and keep long
  dialog content scrolling inside the sheet so the underlying page/table is not visible
  below the dialog.
- Implemented in the focused DialogShell pass for the shared recipe and clear in-scope
  adopters. Future dialog migrations should preserve the same boundary: do not reuse
  popover drawer helpers for task dialogs; share dialog chrome through `src/ui/Dialog.tsx`.

### Shared Control API Explicitness Audit

- Route/page: Shared controls used across dense pages, route-family shells, filters, and
  excluded/quarantined products.
- Component/file: `src/components/Filters/FilterBetweenRange.tsx`,
  `src/ui/Status.tsx`, `src/ui/Checkbox.tsx`, `src/ui/EntityTitleStrip.tsx`,
  `src/ui/IconHitTarget.tsx`, `src/ui/Button.tsx`,
  `src/components/Select/types.ts`, `src/components/TagGroup.tsx`,
  `src/components/Select/Select.tsx`, and
  `src/components/Select/SelectWithCombobox.tsx`.
- Figma node(s): Not a new visual decision. This is an API-contract cleanup following the
  Card/Panel decision that surface density and chrome choices should be explicit.
- Current issue: Several shared controls still hide meaningful styling or semantic
  choices behind defaults, while a few expose props that are dead or unused. This creates
  future drift similar to the old Card border/padding default.
- Shared usage/context:
  - `FilterBetweenRange` has a dead `name` prop, local trigger style variants, default
    `variant="primary"`, and default `size="sm"`.
  - `PanelStatus` defaults to `variant="empty"` even though empty/error status behavior
    changes text color and ARIA.
  - All audited `Checkbox` callers already pass `variant`, and the indicator style map
    duplicates the same class for every variant.
  - `EntityTitleStrip` exposes `titleClassName`, but migrated strip callers do not use it.
  - `IconHitTarget` as a component is unused; only `tableIconHitTargetStyles` is imported
    once.
  - `Button` has many valid `variant="secondary"` defaults, but `size` is nearly always
    explicit and can be tightened first.
  - `selectTriggerStyles` still defaults both `variant` and `size` for direct helper
    calls.
  - `TagGroup` defaults `variant` and `size` across most callers and redundantly redeclares
    a local `style` prop type already provided by `React.ComponentProps<'div'>`.
  - `Select` / `SelectWithCombobox` have the largest blast radius and include excluded
    surfaces; tighten in-scope call sites before changing global prop types.
- Special cases: Do not sweep ProDashboard, LlamaAI, Yields, account/subscription,
  Articles, Downloads, investor dashboards, or other quarantined products as a side
  effect. Shared component prop tightening that would type-break those products needs a
  separate compat/pinning step first.
- Surrounding layout impact: The intended follow-up should be behavior-neutral. It should
  add explicit props or remove dead props without changing trigger classes, popover
  placement, mobile drawer behavior, status panel dimensions, or chart/table layout.
- Grid/flex/layout notes: This is not a layout redesign. The cleanup should preserve
  existing class recipes while making density/variant choices visible at call sites.
- Hardcoded hacks to remove later: Local trigger class maps in `FilterBetweenRange` if they
  can be replaced by `selectTriggerStyles`; duplicate checkbox indicator maps; unused
  title/icon-hit-target API.
- Decision: Keep this out of the dense Card/Panel branch. Use a dedicated
  `shared-control-api-tightening` branch so review can focus on explicitness and
  excluded-surface boundaries.
- Proposed direction:
  1. `FilterBetweenRange`: remove dead `name`; require `variant` and `size`.
  2. `PanelStatus`: require `variant`.
  3. `Checkbox`: require `variant`; collapse duplicate indicator styles.
  4. `EntityTitleStrip`: remove unused `titleClassName`.
  5. `IconHitTarget`: delete the unused component or migrate the single style-string
     caller.
  6. `Button`: require `size`; defer requiring `variant`.
  7. `selectTriggerStyles`: require `variant` and `size`.
  8. `TagGroup`: require `variant` and `size`; remove redundant local `style` prop.
  9. `Select` / `SelectWithCombobox`: make in-scope callers explicit first, then tighten
     shared types only after excluded surfaces are pinned.
- Verification needed: Typecheck after each tightening step, then lint and token lint for
  any class-string changes. Review excluded-surface compile impact before making shared
  `Select` / `SelectWithCombobox` props required.
- Implementation status 2026-07-09: `FilterBetweenRange`, `PanelStatus`, `Checkbox`,
  `EntityTitleStrip`, `IconHitTarget`, `Button`, `selectTriggerStyles`, and `TagGroup`
  are tightened on `mintdart/shared-control-api-tightening`. In-scope `Select` /
  `SelectWithCombobox` callers are pinned explicitly, but the shared prop types stay
  optional until excluded ProDashboard, LlamaAI, Yields, and related surfaces are pinned
  or intentionally migrated.
- Follow-up status 2026-07-09: `FilterBetweenRange` / `TVLRange` no longer expose unused
  `triggerClassName` plumbing, `AvailableRange` no longer has a redundant `variant`, and
  `Card` no longer has `interactive`; clickable card call sites carry
  `.hover-wash-card cursor-pointer` directly.

### Panel vs Card vs Entity Title Strip Decision

- Route/page: `/protocol/tvl/:protocol`, `/protocol/:protocol`, `/protocol/unlocks/:protocol`, `/unlocks/:protocol`, CEX asset/stablecoin protocol-like pages, and any page using a titled chart/table shell.
- Component/file: Current candidates include `src/ui/Panel.tsx`, `src/ui/Card.tsx`, protocol TVL/Treasury/Active Loans/Forks title strips, unlocks `TokenHeader`, CEX title strips, and protocol/chain header cards.
- Figma node(s): `6183:148797` for the titled chart panel; `6183:148786` for the entity title strip. User also linked protocol page nodes `6183:148773` and `6183:312589` as reference pages.
- Current issue: The distinction between Card and Panel was not sufficiently documented when `EntityTitleStrip`, the early Card border variant, and icon hit-target helpers were introduced. This note records the resolved boundary so later migrations do not broaden those primitives beyond their intended contexts.
- Figma evidence checked:
  - `6183:148797` panel: `bg-surface`, `border-subtle`, 8px radius, clipped shell; a real header row with `px-4 py-3`, `border-very-subtle`, 18/22 semibold title, and 32px header controls. Code reconciles the header control cluster to the app-wide 6px dense toolbar gap; chart slot is a separate body area.
  - `6183:148786` entity title strip: `bg-surface`, `border-subtle`, 8px radius, `p-2`; 28px logo, 12px icon/title gap, 20/28 semibold title; no panel header row or chart slot.
- What is not proven yet: A generic app-wide “Card vs Panel” rule for every surface. The Figma evidence proves a titled chart/table panel and an entity title strip are different. It does not by itself prove that every local shell should immediately move to `Panel`.
- Shared usage/context:
  - `Panel` currently encodes chart/table shell behavior.
  - `Card` currently encodes repeated content/data surfaces with fixed `border-subtle`.
  - Many current page files still hand-roll `rounded/border/bg/padding` shells, and those need mapping before adding or changing primitives.
  - Unlocks title/header is not just logo + title; it can include token price, percent change, and a separate stats strip.
  - Treasury and CEX asset headers can include an action/toggle on the right.
- Special cases: Do not touch ProDashboard, investor relations dashboard surfaces, LlamaAI, yields, or account/subscription while this audit is open. Token-rights shell, typography, spacing, and metadata are in scope; keep token-rights green/warning pills and warning cards visually stable unless explicitly reviewed. Raises/investor list-like pages remain in scope unless a route-specific dashboard quarantine says otherwise.
- Surrounding layout impact: A title primitive must support optional right-side actions and inline metadata without forcing all title strips into one rigid layout. A panel primitive must not alter chart canvas placement as a side effect.
- Grid/flex/layout notes: Title strips are candidates for a grid/flex primitive with slots: icon, title, inline metadata, actions. The implementation should be driven by the audited usages, not by a generic assumption that every header is identical.
- Hardcoded hacks to remove later: Repeated local shells using `rounded-lg`/legacy border variables once their contexts are confirmed. Do not remove them until the replacement primitive covers their actual children/actions.
- Decision: Keep `Panel` as the chart/table shell contract, keep `Card` as the fixed subtle content/detail surface, and keep title strips as separate standalone title surfaces. `Panel` is only for titled chart/table shells with header/body behavior.
- Proposed direction: Continue targeted migrations through the existing primitives. Do not broaden `Panel` into non-chart title/detail cards, and do not migrate unlocks/governance/LST until their extra metadata/action slots are validated.
- Verification needed: For each candidate route, capture current live dimensions, Figma node context if available, children/actions, text semantics, and whether a shared primitive would change chart/card surrounding layout.

### Initial Raises Chart Shell And ChartPanel Extraction

- Route/page: `/raises`, `/raises/:investorName`, protocol overview, and chain overview.
- Component/file: `src/containers/Raises/index.tsx`,
  `src/containers/Raises/Investor.tsx`,
  `src/containers/ProtocolOverview/ProtocolChartPanel.tsx`,
  `src/containers/ChainOverview/ChainChartPanel.tsx`, and `src/ui/ChartPanel.tsx`.
- Figma node(s): Uses the existing chart/table panel recipe already documented from
  `6183:148797`.
- Current issue: Lazy-loaded chart shells need to reserve the toolbar plus 360px chart body
  height so the panel does not shift when the chart module resolves. Protocol and chain
  overview repeated the same panel/body shell locally, which made future chart-panel
  reservations easier to drift.
- Shared usage/context: `MultiSeriesChart2` and `PieChart` already own their internal
  export header and 360px plot body. Protocol/chain overview own route-specific toolbar
  controls, metric dialogs, Add to Dashboard config, failed-data popovers, and chart
  query state.
- Special cases: Do not extract chart data fetching, metric toggles, URL state, export
  metadata, or failed-data handling into the shared shell. Do not change ECharts grid
  insets or the 360px plot height.
- Decision: Use a small `src/ui/ChartPanel.tsx` shell/helper layer. `ChartPanel` owns the
  `Panel padding="none"` wrapper, `ChartPanelBody` owns the 360px chart-body reservation,
  `ChartPanelBodyFallback` owns inner chart loading reservation, and
  `ChartPanelExportShellFallback` owns full lazy chart reservation at 400px when the
  chart component renders its own title/export toolbar.
- Verification needed: Leave visual verification to the owner unless screenshots are
  explicitly requested.

Follow-up status:

- Superseded by the 2026-07-09 broad `ChartPanel` shell migration note below. Standard
  in-scope chart shells moved onto the shared helper layer. The later closure review
  confirmed that custom/dynamic-height, mixed chart/table, table-only, and excluded
  surfaces are intentional owners rather than remaining chart work.

### Title Strip Usage Map

- Route/page: Protocol TVL/Treasury/Active Loans/Forks, CEX assets/stablecoins, unlocks protocol pages, governance/liquidations pages, and comparable entity/title surfaces such as RWA asset, DAT company, LST, oracles, protocol taxonomy, and bridges.
- Component/file: `src/ui/EntityTitleStrip.tsx` is the shared primitive. Some current candidates are migrated, while richer headers remain hand-written until their slots are checked.
- Figma node(s): `6183:148786` is the canonical TVL entity title strip inside the `/protocol/tvl/:protocol` frame. `6183:148773` shows that strip followed by real `Panels` instances for titled charts. `6183:312589` shows the protocol overview page where the left protocol summary is a larger data card and the right chart area uses 32px toolbar controls.
- Current issue: Similar-looking title strips currently use different padding, radius, tokens, logo sizes, and heading utilities. Some are true page-level strips, while others are in-card headers or table/panel headers and should not be migrated blindly.
- Figma evidence checked:
  - TVL title strip `6183:148786`: `bg-surface`, `border-subtle`, 8px radius, 8px padding, 28px logo, 12px logo/title gap, 20/28 semibold title, 44px total height.
  - TVL page `6183:148773`: the title strip is separate from the chart panels; the chart panels are `Panels` instances with a header and chart slot.
  - Protocol page `6183:312589`: the protocol summary is a larger data card with the protocol header inside it; the chart area beside it has a 32px toolbar row and should not be reduced to the same primitive as a standalone title strip.
- Current title-strip adopters:
  - `src/pages/protocol/tvl/[protocol].tsx`, `src/pages/protocol/treasury/[protocol].tsx`, `src/pages/protocol/active-loans/[protocol].tsx`, and `src/pages/protocol/forks/[protocol].tsx`.
  - `src/pages/cex/assets/[cex].tsx` and `src/pages/cex/stablecoins/[cex].tsx`.
  - `src/containers/ChainOverview/index.tsx`, `src/containers/Bridges/BridgeProtocolOverview.tsx`, and `src/containers/LiquidationsV2/Summary.tsx`.
- Historical page-level title-strip candidates at this point in the audit (the final
  sweep review accepted their current richer compositions; no migration remains pending):
  - `src/containers/Unlocks/EmissionsByProtocol.tsx`: page-level token title strip plus inline token price/change metadata; the primitive would need metadata slots rather than only `icon + title`.
  - `src/containers/Governance/GovernanceProject.tsx`: page-level project title strip plus filter/action slot.
  - `src/containers/LST/index.tsx`: title strip with title and right-aligned aggregate value; no logo, so this is likely a generic title strip variant rather than an entity-logo variant.
- Near-misses that should not be forced into the title-strip primitive:
  - `src/containers/ProtocolOverview/index.tsx`: protocol name/logo is inside the larger protocol summary card, not a standalone page title strip.
  - `src/containers/ChainOverview/Stats.tsx` and the chain empty-state shell in `src/containers/ChainOverview/index.tsx`: entity header lives inside a stats/data card; share icon hit-target treatment later, but not necessarily the title-strip shell.
  - `src/containers/DAT/Company.tsx`, `src/containers/ProtocolTaxonomy/index.tsx`, and `src/containers/Oracles/OracleOverview.tsx`: headers live inside larger summary/data cards with metric rows; these may share card/header slots, not the page title-strip surface.
  - `src/containers/ProtocolTaxonomy/CategoriesPage.tsx`: table/panel header with filters, not an entity title strip.
  - Protocol route variants such as fees/dexs/options/perps/bridge-aggregators render a protocol heading inside a protocol-specific page body; audit against their Figma context before migrating them.
- Shared usage/context: The existing primitive needs to stay slot-driven: `icon`, `title`, optional inline metadata, optional right actions, optional right text, and no-logo generic title cases. If that becomes too broad, split into `EntityTitleStrip` and `PageTitleStrip` rather than one over-flexible component.
- Special cases: ProDashboard, investor relations dashboard surfaces, LlamaAI, yields, account/subscription, and legacy quarantines remain excluded from migration unless separately reviewed. Token-rights shell, typography, spacing, and metadata are in scope while green/warning pills and warning cards remain guarded. Raises/investor list-like pages remain in scope unless separately quarantined.
- Surrounding layout impact: Moving these to a shared primitive will change vertical density on protocol TVL/active-loans/forks from current `p-3`/24px-logo to Figma's `p-2`/28px-logo. That keeps the title strip at 44px, but text and logo alignment will shift. CEX pages will also migrate off legacy card tokens if approved.
- Grid/flex/layout notes: This primitive should be layout-slot driven. A simple grid like `auto minmax(0,1fr) auto` can support icon/title/actions without `mr-auto` hacks; inline metadata can sit in the title row only where needed.
- Hardcoded hacks to remove later: Repeated `rounded-md`/`rounded-lg`, `border-(--cards-border)`, `bg-(--cards-bg)`, ad hoc `p-3`, `mr-auto`, and inconsistent `text-xl font-bold` vs `heading-sm` once the primitive is agreed.
- Decision: Existing title-strip adopters should stay on `EntityTitleStrip` and be live-verified route by route. No-logo generic strips and richer unlocks/governance/LST headers stay out until their slots are checked.
- Proposed direction: Continue focused migration from Figma `6183:148786`: support optional icon, title, right action/right text, and avoid turning the primitive into a catch-all card header.
- Verification needed: For each migrated route, live-measure title strip height 44px, 8px padding, 8px radius, subtle border, 28px logo where present, 12px logo/title gap, and no layout regression in right-action/right-text variants.

### Paragraph Tags Used As Structural Surface Wrappers

- Route/page: In-scope examples already touched include borrow/MiCA empty states, Bridges form alert, Equities empty state, protocol warning banners, RWA stat/property cards, and MCP note. Downloads modal footer and article admin/editor empty/error states were historical examples from earlier sweeps and are now excluded/deferred with their product surfaces.
- Component/file: The structural-status cleanup changed multiple files from structural
  `<p>` wrappers to `<div>` wrappers. This needs review before further changes.
- Figma node(s): Not a Figma visual issue by itself; this is semantic HTML and component-contract cleanup.
- Current issue: A simple `<p>` to `<div>` replacement can be incomplete or pointless if the wrapper exists to style text and no inner semantic text element is restored. The right fix depends on context:
  - Stat/data cards with nested spans, links, tooltips, or multiple blocks should not be `<p>`.
  - Empty/error/status text inside a visual shell may need a structural wrapper plus an inner `<p>` with the text style.
  - Alerts/statuses may need `role="alert"` or `role="status"` depending on whether the message is assertive or passive.
- Shared usage/context: The same visual state patterns repeat across panels/cards. A proper cleanup may require tiny components like `EmptyState`, `ErrorState`, or panel body/status primitives, not broad tag swapping.
- Special cases: Excluded surfaces still contain structural `<p>` matches and were intentionally left untouched. Do not use this audit item to sweep yields, ProDashboard, LlamaAI, account/subscription, Downloads, Articles/research/authors/newsletters/reports, or investor-relations dashboard surfaces.
- Surrounding layout impact: Adding inner `<p>` elements can affect default margins unless reset by utility classes. Any semantic wrapper fix must explicitly set text utility/margins so it is visually identical.
- Grid/flex/layout notes: Wrapper owns layout/surface (`flex`, `grid`, border, bg, radius, padding). Inner text element owns typography (`body-sm`, `text-secondary`, `text-data-down`, etc.). Do not combine both roles on a paragraph if the content is not a single paragraph.
- Hardcoded hacks to remove later: Local duplicated empty/error shell classes once a shared status/empty component is agreed.
- Decision: Refine the current p-to-div changes rather than reverting them wholesale. Data-card wrappers stay `div`; empty/error/status shells need inner text semantics and `role="status"`/`role="alert"` where appropriate.
- Proposed direction: Audit each changed instance and classify it as data-card, empty-state, error-alert, warning-banner, or footer note. Then add the appropriate inner text/ARIA semantics in one focused pass.
- Verification needed: Diff review plus DOM inspection for every changed instance; confirm no default paragraph margins, no layout shifts, and correct semantics for alerts/status text.

Current classification of the in-flight pass:

| File/context                                                                         | Classification                                 | Keep wrapper as `div`? | Inner text/ARIA fix                                                                          |
| ------------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `src/containers/RWA/index.tsx` overview stat cards                                   | Data cards with multiple child nodes           | Yes                    | No inner `<p>`; `div` is the semantic fix                                                    |
| `src/containers/RWA/Asset.tsx` stat/property cards and Tooltip render hosts          | Data/property cards with nested links/tooltips | Yes                    | No inner `<p>`; `div` is the semantic fix                                                    |
| `src/containers/RWA/Perps/Dashboard.tsx` `StatCard`                                  | Data card with multiple child nodes            | Yes                    | No inner `<p>`                                                                               |
| `src/containers/RWA/Asset.tsx` `Primary` badge                                       | Inline badge                                   | Use `span`             | No inner `<p>`                                                                               |
| `src/pages/borrow.tsx` loading/error shells                                          | Status/error shell                             | Yes                    | Add inner `<p>`; loading wrapper can be `role="status"`, error wrapper can be `role="alert"` |
| `src/pages/mica.tsx` empty shell                                                     | Empty-state shell                              | Yes                    | Add inner `<p>`                                                                              |
| `src/containers/Articles/*` empty/error shells                                       | Excluded/deferred historical example           | Yes                    | Do not sweep unless separately scoped                                                        |
| `src/containers/Bridges/Transactions.tsx` form error                                 | Error alert with icon                          | Yes                    | Add `role="alert"` and inner `<p>`                                                           |
| `src/containers/Equities/OnchainTables.tsx` `EmptyState`                             | Empty-state shell                              | Yes                    | Add inner `<p>` around children                                                              |
| `src/containers/Downloads/MultiMetricModal.tsx` preview footer note                  | Excluded/deferred historical example           | Yes                    | Do not sweep unless separately scoped                                                        |
| `src/containers/MCP/index.tsx` note callout                                          | Note/callout shell                             | Yes                    | Add inner `<p>`                                                                              |
| `src/containers/ProtocolOverview/Layout.tsx` active-loans notice and warning banners | Warning/info callout shells                    | Yes                    | Add inner `<p>`; leave visual tokens unchanged                                               |
| `src/containers/RWA/Perps/Dashboard.tsx` forex information callout                   | Informational callout shell                    | Yes                    | Add inner `<p>`                                                                              |

### Protocol-Family Loading And Error Panels

- Route/page: `/protocol/tvl/:protocol`, `/protocol/treasury/:protocol`, `/protocol/stablecoins/:protocol`, `/protocol/active-loans/:protocol`, `/protocol/forks/:protocol`, plus CEX assets/stablecoins as the adjacent legacy family.
- Component/file: `Panel` usages in protocol subpages; CEX assets/stablecoins title/status shells now use shared primitives.
- Figma node(s): Protocol TVL reference page `6183:148773`; panel reference `6183:148797`.
- Current issue: Some previous scripted edits left invalid `className="-1"` fragments and mixed error/no-data text styles. The TVL loading/error panel should expand with `flex-1` like main branch behavior, and text should use semantic typography/color utilities rather than old local label/error tokens.
- Search evidence: In-scope `className="-1"` search now returns no matches. Protocol-family status panels now use `flex-1` placement where applicable. TVL/Treasury/Forks/Stablecoins error text uses `body-sm text-data-down`; active-loans no-data text uses `body-sm text-secondary`.
- Shared usage/context:
  - TVL and Treasury have chart-grid error states and should use `col-span-full` to avoid `col-span-2` assumptions.
  - Stablecoins is a single-content page inside `ProtocolOverviewLayout`; its failed state should still expand via `flex-1`.
  - Forks has a simple failed state before the nested `ForksByProtocol` content.
  - CEX assets/stablecoins title, loading, empty, and stablecoin metric-summary shells have been migrated in a focused CEX shell pass; chart bodies should be verified when that route family is touched again.
- Special cases: Yields remain excluded. Token-rights shell, typography, spacing, and metadata are in scope, while green/warning pill/card output stays guarded. CEX migration is allowed because user confirmed it should use the new protocol-like shells, but any remaining CEX chart/market-shell work should be done as a focused panel migration with live checks.
- Surrounding layout impact: `flex-1` belongs on the panel surface, while text styles belong on the inner paragraph. Avoid putting fixed heights on wrapper rows to solve empty/error states.
- Grid/flex/layout notes: Use `col-span-full` for chart-grid-wide states so the markup survives responsive grid changes. Single-page states can rely on `flex-1`.
- Hardcoded hacks to remove later: remaining CEX market/date-filter legacy `rounded-md border-(--cards-border) bg-(--cards-bg)` shells once that route-family migration is scoped.
- Decision: Small fix pass only for broken/inconsistent protocol-family loading/error/no-data states, followed by a focused CEX assets/stablecoins shell pass.
- Proposed direction: Keep `Panel` for protocol status shells and use `EntityTitleStrip`/`PanelStatus`/`PanelLoadingStatus`/`Card` for the migrated CEX assets/stablecoins shell pieces.
- Verification needed: Format/type verification now; live checks still required for the broader panel/title-strip migrations and CEX chart/market shell pieces.

### Home Include In TVL Popover Outer Padding

- Route/page: `/` home page, top-right `Include in TVL` filter popover.
- Component/file: Trigger is the metric filters control used by the protocol rankings table; popover styling traces to shared select/popover recipes, especially `src/components/Select/Select.tsx` and `src/ui/Popover.ts`.
- Figma node(s): Not checked for this note yet. User screenshot shows the current live surface has outer vertical padding from `py-3`.
- Current issue: The popover surface has vertical padding on the outer wrapper. The desired behavior is no vertical padding on the wrapper; vertical rhythm should be driven by list/action rows themselves.
- Shared usage/context: The same default `popoverSurfaceStyles` is used by `Select`, `SelectWithCombobox`, `MultiSelectCombobox`, bridge selectors, calendar filters, token usage filters, and other default popover surfaces. Changing the shared recipe would affect all of these, not just `Include in TVL`.
- Special cases: Legacy/excluded popover variants have separate style constants and should not be swept casually. Select-with-search popovers also have a search wrapper (`px-3 pb-3`) and an action bar, so removing outer `py-3` may require confirming top/bottom spacing in both search and no-search variants.
- Surrounding layout impact: Removing wrapper padding will make the first row/action bar sit flush to the rounded border unless the row/action components own their own vertical spacing and radius/hover treatment. Need check hover backgrounds against rounded corners at the top/bottom of the surface.
- Grid/flex/layout notes: This is not a flex-vs-grid issue; it is a containment recipe issue. The surface should own border/radius/background/overflow, while rows own padding/min-height.
- Hardcoded hacks to remove: `py-3` on the shared default popover surface appears to be the specific source of the extra top/bottom padding. If the decision applies globally, update the recipe and comment so future popovers do not re-add wrapper padding.
- Decision: Default popover/menu surfaces should not have vertical padding on the wrapper. Surface owns background, border, radius, and overflow; rows/search/action/footer own vertical spacing.
- Proposed direction: Make the default popover/menu surface paddingless and rely on row, search wrapper, action bar, footer, and see-more recipes for vertical spacing. Verify default, combobox, menu, and mobile drawer contexts before changing shared recipes.
- Verification needed: Live check `/` `Include in TVL`, at least one regular `Select`, one `SelectWithCombobox` with search, one menu using `menuSurfaceStyles`, and mobile drawer behavior. Inspect computed surface padding, first/last row hover clipping, row heights, and rounded-corner interaction states.

### Home Include In TVL Popover Checkbox State

- Route/page: `/` home page, top-right `Include in TVL` filter popover.
- Component/file: Checkbox indicator is rendered by shared select helpers in `src/components/Select/Select.tsx` / `src/components/Select/SelectWithCombobox.tsx`, styled through `popoverMultiSelectCheckStyles` / `popoverSingleSelectCheckStyles` in `src/ui/Popover.ts`.
- Figma node(s): `6183:293491`; user screenshot shows selected row currently has a small check mark inside an outlined circle.
- Current issue: Selected checkbox indicator should be filled with the primary/brand blue background and use a white check, rather than only an outlined indicator/check.
- Shared usage/context: The compact popover check helpers are shared by default `Select` and `SelectWithCombobox` popover rows. Changing them affects Include-in-TVL filters, column selectors, calendar/type filters, token usage filters, bridge selectors, and other default select rows. Legacy/excluded variants use separate `legacyPopoverSelectCheckStyles`.
- Special cases: Single-select rows also render `SelectItemCheck`, but they must remain check-only. Filled/empty checkbox treatment applies only to multi-select checkbox-style rows.
- Surrounding layout impact: Filled indicator must preserve current row height and right alignment. Check icon should remain optically centered inside the indicator and not increase row min-height.
- Grid/flex/layout notes: Indicator sizing should come from a fixed square size plus row padding/gap, not extra row height or margins.
- Hardcoded hacks to remove: Avoid one-off row-specific blue classes in the home filter. If this is a design-system rule, move it into the shared popover/select-check recipe.
- Decision: Multi-select popover rows use a compact 14px rounded checkbox footprint for both selected and unselected rows: selected is `bg-brand border-brand` with a white check, unselected is an empty `border-strong` box. Single-select rows render no empty box/circle; the selected row shows only a blue check mark at the same compact visual size. Select/Deselect action rows are multi-select only.
- Proposed direction: Split multi-select checkbox visuals from single-select selected-check visuals in the shared recipe while preserving alignment and row padding.
- Verification needed: Live check selected and unselected states in `/` `Include in TVL`, a `SelectWithCombobox` column selector, and a single-select popover to ensure multi-select unchecked rows show empty boxes, single-select checks do not unintentionally become checkbox-style, and single-select unselected rows do not show empty circles.

### Shared Select Combobox Popover Layout

- Route/page: `/` home rankings table `Columns` popover, and every `SelectWithCombobox` using the default popover recipe.
- Component/file: `src/components/Select/SelectWithCombobox.tsx`, `src/ui/Popover.ts`, and the `customFooter` passed from `src/containers/ProtocolRankings/Table.tsx`.
- Figma node(s): Shared popover/search/select/check nodes still need a focused pull: `6183:293478`, `6183:293504`, `6183:293480`, `6183:293485`, `6183:293491`, `6183:293514`.
- Current issue: The live `Columns` popover showed wrapper vertical padding and extra spacing around the search/action stack. The old code had `popoverSurfaceStyles` / `menuSurfaceStyles` with `py-3`; `SelectWithCombobox` default `searchWrapperStyles` as `relative px-3 pb-3`; action bar as `sticky top-0 ... flex items-center justify-between gap-1`; and the table custom footer passed a bordered `Add Custom Column` button.
- Desired behavior: Popover wrapper should have no vertical padding. Search input/search block owns its full inset padding, including bottom padding even when the Select/Deselect row follows. Select/Deselect should sit in normal flow, not as an isolated padded/sticky block, and its two buttons should occupy equal halves of the row with centered labels. `Add Custom Column` at the bottom should not have its own border.
- Current Select/Deselect map: In scope, this action row appears in `src/components/Select/Select.tsx` and `src/components/Select/SelectWithCombobox.tsx`, each in both nested-menu and regular-popover render paths. The label is either fixed `Select All` or `Select shown` for search-scoped combobox results. Outside these shared components, matching strings are mostly tests or excluded/special surfaces such as Downloads/Yields with their own toggle-all flows.
- Shared usage/context: `SelectWithCombobox` backs table columns, calendar/type filters, token usage filters, bridge selectors, chart metric selectors where not using Dialog, and other select/search popovers. Changing the shared recipe can improve consistency but needs checks across default and legacy/excluded variants.
- Special cases: Legacy/excluded surfaces should stay visually stable unless explicitly migrated. Downloads/Yields toggle-all controls are not part of this popover action-row change. Some popovers have no search field, no action row, or no footer; the spacing rules need conditional variants so removing `py-3` does not collapse those layouts.
- Surrounding layout impact: Removing wrapper padding makes first/last rows touch the rounded surface. Row/action/footer hover backgrounds and borders must clip cleanly against the 12px surface radius. The scrollbar gutter should not visually add fake padding.
- Grid/flex/layout notes: Surface owns background/border/radius/overflow/scroll height; Ariakit wrapper props own below-`sm` fixed-bottom placement; shared drawer popovers portal by default (`portal={false}` is the explicit opt-out) so fixed placement is viewport-based; `sm+` popovers stay anchored to their trigger. Drawer utilities own the animated transform. Do not put `transform-none` on animated drawer surfaces to fight Floating UI placement. Search block owns its inset padding whenever it renders. Select/Deselect uses a normal-flow two-column grid with no outer horizontal padding; each button owns its padding and centers its label. Range/date footer actions such as Clear/Apply must stay contained by the popover width with `min-w-0`/flex or grid sizing. Regular list rows own `px-3 py-2`; nested-menu drawer rows own `px-4 py-2.5` and fixed right icon/check columns. Footer/reset actions own row padding, not an extra nested bordered button.
- Hardcoded hacks to remove: Shared popover/menu surfaces and default search/action recipes now use named paddingless/conditional helpers; keep auditing direct popover copies for old wrapper padding and nested bordered footer actions.
- Decision: For shared `Select` / `SelectWithCombobox` popovers only, Select/Deselect should be normal flow. Do not touch Downloads/Yields toggle-all flows. If a future shared popover truly needs sticky behavior, it should use a separate explicit sticky action-bar recipe.
- Proposed direction: Keep the recipes split by responsibility: paddingless `popoverSurfaceStyles`; search-block recipes with full search padding; normal-flow two-column action bars for Select/Deselect; row recipes for regular and nested menu rows; and borderless/footer-contained action styles for Clear/Apply/reset/download rows.
- Verification needed: Live `/` `Columns` popover: wrapper padding 0, search block has top/x/bottom padding, Select/Deselect row in flow with two equal-width non-wrapping buttons, rows still 40-ish px with clean dividers, `See more...` spacing, `Add Custom Column` no border. Also verify a range/date filter popover has no horizontal Clear/Apply overflow, a no-search select, a search-without-action popover, mobile drawer, and an excluded/legacy popover remains unchanged.

### Home Top Controls Row

- Route/page: `/` home page and `/chain/:chain` top desktop control row.
- Component/file: Page shell/top controls around global search, Ask LlamaAI, and metric filter trigger. Search uses shared input/search recipes; Ask LlamaAI uses a CTA button surface; `Include in TVL` uses the metric filter select trigger.
- Figma node(s): `6183:292122` inside `6183:292119`.
- Current issue: Live screenshot shows the top row laid out with an 8px `gap-2` between search and Ask LlamaAI, while Figma has a 12px gap between the search input and Ask LlamaAI button. The TVL filter is right-aligned on the same 32px row.
- Measured Figma details: top row height 32px; search width 617px, height 32px, `bg-page`, `border-medium`, 8px radius, 12px left padding, 4px right padding, 4px icon/text gap, 16px search icon, placeholder `body-sm` 12/16 `text-tertiary`; Ask LlamaAI button height 32px, 8px radius, 12px horizontal padding, 4px icon/text gap, 16px icon, 12/16 medium label, black fixed text over gradient; `Include in TVL` trigger height 32px, `bg-surface`, 6px radius, 8px padding, 8px label/value gap, 12/16 text, selected value in link/brand blue, 16px chevron.
- Shared usage/context: Global search/Ask LlamaAI/header controls are shared across home-like layouts; TVL filter trigger also appears in table/filter contexts. A global trigger change may affect table filter rows and popover alignment.
- Special cases: The top row may be an intentional 12px exception while the page stack below uses 8px. Do not blindly change all `gap-2` control groups to 12px.
- Surrounding layout impact: If the search/Ask gap becomes 12px, verify the search width, Ask LlamaAI width, and right filter still fit the 1172px desktop content area without truncation. On narrower desktop widths, wrapping/collapse behavior needs a separate check.
- Grid/flex/layout notes: This row is currently a good candidate for grid: `grid-template-columns: minmax(0, auto) auto` or a left/right grid split can preserve the right-aligned filter without relying on flex growth surprises.
- Hardcoded hacks to remove: Avoid fixed row heights except the established 32px min-height floor; spacing should come from the row gap and button/input padding.
- Decision: Top controls use the Figma 12px horizontal gap as a specific exception; the rest of the home page stack can standardize around 8px.
- Proposed direction: Keep 32px controls and implement a top-controls-only 12px gap without changing generic control group gaps.
- Verification needed: Live desktop `/`, `/chain/ethereum`, and a narrow desktop viewport. Measure row height 32px, search/Ask gap 12px if chosen, TVL trigger padding/radius/colors, and placeholder vertical centering.

### Home Page Vertical Rhythm And Section Gaps

- Route/page: `/` home page and `/chain/:chain`.
- Component/file: `src/containers/ChainOverview/index.tsx` plus the parent page shell that wraps search, announcement, browse/search metrics toolbar, row links, stats/chart cards, Llama app links, newsletter strip, and rankings table.
- Figma node(s): `6183:292119` metadata plus child nodes `6183:292122`, `6183:292131`, `6183:292135`, `6183:292146`, `6183:292190`, `6183:292218`.
- Current issue: The app has mixed spacing sources (`gap-2`, `gap-1`, component padding, card padding, table-toolbar padding). User wants all layout gaps between search components, cards, and tables to read as a uniform 8px rhythm.
- Measured Figma details: `6183:292119` places top controls at y=12, announcement at y=50, metrics browse toolbar at y=84, row links at y=122, stat/chart cards at y=160. That yields raw vertical gaps of 6px, 6px, 8px, and 8px between these blocks.
- Shared usage/context: The home/chain overview shares much of the route surface with protocol overview patterns, but the home page also has announcement and Llama app link strips that are not universal.
- Special cases: The raw Figma frame has two 6px vertical gaps, but the user preference is to simplify to 8px. This should be treated as an intentional product/design reconciliation, not a missed extraction.
- Surrounding layout impact: Changing page stack rhythm affects the first viewport density: search/header, banner, row links, stat card, chart, and table all move together. Verify the next section remains visible on desktop and mobile.
- Grid/flex/layout notes: Prefer one page-level grid/flex column gap for the stack, with components owning only their internal padding. Avoid stacking `mt-*`/`mb-*` offsets on children.
- Hardcoded hacks to remove: Look for child components carrying vertical margins to compensate for parent rhythm. Those should move to parent `gap` or component padding/min-height.
- Decision: Override the raw Figma 6px block gaps and use 8px for the home page's major vertical/layout rhythm.
- Proposed direction: Standardize the home page stack to 8px gaps, while keeping the top-controls 12px horizontal spacing as a separate exception.
- Verification needed: Live `/` and `/chain/ethereum`; inspect computed vertical gaps between top controls, announcement, metrics browse toolbar, row links, stat/chart cards, Llama links, newsletter, and rankings table.

### Home Metrics Browse Toolbar

- Route/page: `/` home page browse/search metrics strip.
- Component/file: `src/components/Metrics.tsx`, rendered as the metrics browse/search toolbar above RowLinksWithDropdown.
- Figma node(s): `6183:292135`.
- Current issue: User reports the metrics toolbar padding looks inconsistent in code, and the selected metrics component pill has the wrong border/radius. Current code uses `buttonStyles({ variant: 'filter', size: 'sm' })`, which produces a full-radius pill with a solid brand border. Figma's selected `Overview` pill is not that recipe: it has a dashed brand border, 6px radius, and brand-transparent fill.
- Measured Figma details: wrapper is `bg-surface`, 1px `border-brand`, 8px radius, 8px padding, 32px total height. Inner group uses a 12px gap between the "New" marker and the browse/search group. The "New" marker uses 16px icon, 2px icon/text gap, 12/16 regular text with blue-to-light gradient. Selected "Overview" pill is 24px high, 6px x padding, 4px y padding, 6px radius, dashed brand border, brand-transparent background, 12/16 medium label. Search hint uses a 16px icon, 4px icon/text gap, 12/16 regular tertiary text.
- Shared usage/context: This resembles a compact filter/search strip, not a table filter band. Its selected pill also resembles a small filter button but has a dashed border and brand-transparent background.
- Special cases: This toolbar is decorative/discovery-oriented. Do not automatically apply table filter band rules if the browse/search affordance needs a different visual treatment.
- Surrounding layout impact: Its outer 8px padding and 32px height must align with the row links and top controls. If the page stack is standardized to 8px, the toolbar should not add extra outer margins.
- Grid/flex/layout notes: Centered inner content could be grid-centered while the full strip remains a simple panel. Avoid absolute centering hacks.
- Hardcoded hacks to remove: Do not keep borrowing the generic `filter` button if this toolbar pill is a different component state. Any arbitrary border/radius/gradient values should move into a recipe if this pattern repeats.
- Decision: The dashed 6px-radius `Overview` pill is a dedicated metrics-browse toolbar treatment, separate from generic `Button filter` and metrics-directory category pills.
- Proposed direction: Add a small named recipe for this toolbar-selected pill. Keep wrapper `p-2`, 8px radius, brand border, 12px inner group gap, and 12px text.
- Verification needed: Live `/` in light/dark, including computed selected-pill border style `dashed`, radius 6px, height 24px, padding 6px x / 4px y, wrapper padding 8px, 16px search icon, and focus/hover on the selected pill and search/browse affordance.

### Home RowLinksWithDropdown Chain Row

- Route/page: `/` home page and `/chain/:chain`, plus RWA taxonomy pages that reuse `RowLinksWithDropdown`.
- Component/file: `src/components/RowLinksWithDropdown/index.tsx`, `src/components/RowLinksWithDropdown/LinksWithDropdown.tsx`, `src/components/RowLinksWithDropdown/OtherLinks.tsx`.
- Figma node(s): `6183:292146` inside `6183:292119`; earlier linked component node `6183:291265` still needs a full traversal before code changes.
- Current issue: Row chip spacing and typography need a deliberate decision. Figma uses 10px chip text, but user wants 12px retained because 10px is too small. Current code has wrapper `border-subtle bg-surface rounded-lg`, inner `p-1 gap-1`, chip `px-2 py-1 body-sm`, active `bg-brand`. User also notes the current hover color feels too gray and may need a more blue-tinted hover later.
- Measured Figma details: wrapper `bg-surface`, `border-subtle`, 8px radius, 4px padding, 30px total height. Chip group gap is 4px. Chips are 22px high with 8px horizontal padding, 4px vertical padding, 4px radius. Active chip uses `bg-interactive` + white; inactive chips use `bg-brand-transparent` + branded/link text. Figma text is 10px, 14px line-height for inactive body-xs; active is label-xs 10/12. `Others` trigger uses elevated surface, 6px radius, left padding 8px, right padding 4px, 2px icon/text gap, 12px chevron.
- Shared usage/context: Used by home/chain overview, protocol taxonomy, and multiple RWA pages. A typography or row-height change will affect all these rows and their overflow measurement logic.
- Special cases: Mobile renders `OtherLinks` as a full-width dropdown. The desktop overflow measurement caches link widths and gap/padding, so any spacing/typography change can affect when links collapse into the dropdown.
- Surrounding layout impact: Row height should remain stable and should not introduce a second-row sliver. If text stays 12px, the row may need the current 24px-ish control floor instead of the Figma 22px chip height.
- Grid/flex/layout notes: The visible chip row is a single-row overflow system, so flex is doing real measurement work here. Do not convert this part to grid unless the overflow algorithm is redesigned.
- Hardcoded hacks to remove: `max-h-8` and measurement constants should be rechecked after any row-height decision; avoid solving overflow with extra hidden margins.
- Decision: Keep RowLinksWithDropdown text/height as-is for now rather than squeezing toward Figma's 10px/22px chips.
- Proposed direction: Keep 12px text, 4px wrapper padding, 4px chip gap, 8px wrapper radius, 4px chip radius. Defer hover color choice; later compare current grayish hover against a more brand-blue hover tint.
- Verification needed: Live `/`, `/chain/ethereum`, an RWA page using the component, and a narrow desktop width that forces overflow into `Others`.

### Home Stat Cards And Key Metrics

- Route/page: `/` home page stat card grid.
- Component/file: `src/containers/ChainOverview/Stats.tsx`, `src/containers/ChainOverview/KeyMetrics.tsx`, `src/containers/ChainOverview/SmolStats.tsx`, and eventual `Card` adoption.
- Figma node(s): `6183:292190`.
- Current issue: Figma stat cards use 12px vertical padding and 8px horizontal padding, but the desired direction is to make these cards use 8px padding all around for consistency. Key metrics row text was kept larger than Figma and should remain 14px.
- Measured Figma details: card surface `bg-surface`, `border-subtle`, 8px radius, `px-8px py-12px`, `justify-between`. Top content gap is 24px between the headline metric block and key metrics block. Title is `body-sm` 12/16 tertiary with dotted underline. Main value is mono bold 24/24. 24h change row uses 4px gap, mono 12/16 green and body 12/16 tertiary. Key Metrics header is label-sm 12/16. Key metric rows are 24px high, row gap 4px, label/icon gap 2px, 16px helper icons, faint 1px `border-very-subtle` row dividers, values are mono bold 12/16. CSV button is 24px high, 6px radius, 12px x padding, 4px icon/text gap, 12px icon, 10px label in Figma.
- Shared usage/context: Similar dense stat cards appear in chain, protocol, metrics, unlocks, and dashboard surfaces, but ProDashboard, investor relations dashboard surfaces, yields, and account/subscription areas are excluded for now. Raises/investor list-like pages remain in scope unless separately quarantined.
- Special cases: The user explicitly wants data rows at 14px even where Figma shows 12px. This is consistent with `design.md`'s card data row 14px floor.
- Typography decision: These cards contain two content types. Standalone headline metrics use the stablecoins reference pattern (`text-secondary` label + `font-jetbrains text-2xl font-semibold` value). Secondary metric rows inside the same card stay row-scale (`MetricRow`, `body-md`/`body-sm` secondary labels, and `mono-md`/`mono-md-bold` or `font-jetbrains` values). Do not flatten all rows to the headline style.
- Surrounding layout impact: Reducing vertical padding from 12px to 8px changes card height and could change chart/table first-viewport composition. Ensure adjacent chart panel still lines up visually.
- Grid/flex/layout notes: These cards should be grid/padding driven. Avoid fixed heights for rows except a min-height/floor if needed for alignment.
- Hardcoded hacks to remove: The current stat card shell has `px-2 py-3`; if the decision is all-8px, `py-3` is design debt. Do not replace with arbitrary `py-[8px]`; use `p-2` or the Card primitive.
- Decision: Dense home/stat cards should use 8px padding on all sides, intentionally overriding Figma's 12px vertical / 8px horizontal card padding.
- CSV button decision: Do not blindly promote the stat-card CSV action to 32px just because toolbar buttons are 32px. This button lives inside a dense card, not a toolbar; Figma has it at 24px, and a 32px button may dominate the card footer and fight the 8px padding. Preferred rhythm is contextual: toolbar controls 32px, dense-card secondary actions can stay 24px if they align with the card's compact density.
- Proposed direction: Use Card primitive with an 8px dense padding variant or add that variant if missing; keep key metric labels/values at 14px card-data row size; keep the stat-card CSV action compact unless live comparison shows it feels too small.
- Verification needed: Live `/` in light/dark: card padding, row dividers, title/value type, CSV button alignment at 24px vs any 32px experiment, and equal height with the chart card.

### Home Llama App Links Strip

- Route/page: `/` home page only when viewing `All`.
- Component/file: `linksToOtherLlamaApps` strip in `src/containers/ChainOverview/index.tsx`.
- Figma node(s): Needs exact node extraction from the home frame if this strip has a linked child node; user screenshot shows the current strip and notes the Figma gap is 8px.
- Current issue: Current code uses `gap-1` on the horizontal strip, which creates a 4px gap between Llama app cards. User notes this is visibly too tight and Figma uses 8px.
- Shared usage/context: The card content is local to the home page, but the visual card recipe should not diverge from `Card` if these become reusable app-link tiles.
- Special cases: First card is logo-only DefiLlama Research; other cards have icon, title, description, and external-arrow. Cards scroll horizontally and have fixed min/max widths.
- Surrounding layout impact: Increasing the gap to 8px changes the scroll width and visible count. Verify it does not hide too much content on common desktop widths.
- Grid/flex/layout notes: Horizontal overflow is appropriate here. The row gap should be the single source of spacing between cards; individual cards own only internal padding/gap.
- Hardcoded hacks to remove: Card colors currently use legacy `--cards-*` variables in this strip. Migration should use the Card recipe and semantic tokens, excluding ProDashboard, investor relations dashboard surfaces, yields, and account/subscription areas.
- Decision needed: Should the app-link cards move to `Card` now, or should this note wait until the broader home card pass?
- Proposed direction: Change the strip gap to 8px during the home layout pass and consider Card adoption only if it does not churn the media/logo sizing.
- Verification needed: Live `/` desktop and narrow desktop horizontal scroll; measure card gap 8px, no text overlap, arrow alignment, and logo-only card sizing.

### Home Chart Toolbar And Export Controls

- Route/page: `/` and `/chain/:chain` chart card/panel.
- Component/file: `src/containers/ChainOverview/ChainChartPanel.tsx`, `src/components/ECharts/MultiSeriesChart2/index.tsx`, `src/components/ECharts/ChartHeader.tsx`, `src/ui/Button.tsx`, `src/ui/MetricChip.tsx`.
- Figma node(s): Chart panel is `6183:292218` in `6183:292119`; metadata shows chart header children `6183:292219` through `6183:292226`. Related tab/switch component checked at `6183:312702`.
- Current issue: User wants chart/table toolbar controls to feel consistent when segmented/tab controls sit beside buttons. Existing design-system rule says panel/chart toolbar controls are 32px (`Button` md, `MetricChip` 32px). Figma home metadata shows 24px button instances in the home chart frame, while Figma `6183:312702` shows a segmented/tab switch that is 32px total because it wraps 28px tab items in 2px outer padding.
- Measured Figma details: chart card `6183:292218` is 779x262. Header starts at x=8 y=12, height 24. Left control group has two 24px-high buttons, positions x=0 and x=92, so the group gap is 8px. Right export group has 24px, 53px, and 53px buttons at x=0, x=28, and x=85, so export-button gaps are 4px. Chart plot begins at y=50. Segmented/tabs `6183:312702` uses wrapper `bg-surface`, `border-medium`, 8px radius, 2px padding, 2px item gap; normal tab items are 28px tall from 12/16 text with `px-2 py-1.5`, selected `bg-brand-transparent` + branded text; wrapper total height is 32px.
- Shared usage/context: Chart header/control patterns are shared across chain, protocol, token, DAT, RWA, cex, and many ECharts wrappers. Changing Button md or MetricChip would ripple widely.
- Historical special case: Chain/Protocol chart toolbars were already verified at 32px; the later route-family sweep completed/reviewed the token, DAT, and RWA-Perps surfaces under the same control-height contract.
- Surrounding layout impact: Moving chart controls from 32px to 28px or 24px changes panel header height, vertical chart position, and alignment with Add Metrics/metric chips/export controls.
- Grid/flex/layout notes: Chart header action groups are better as grid/flex rows with size recipes, gap tokens, and padding/min-height floors. Toolbar rows themselves should not hardcode `h-8`; their height should emerge from the controls inside plus row padding/alignment.
- Hardcoded hacks to remove: Do not make button height conditional on adjacent siblings through `:has()` or child inspection. That would hide layout rules in CSS and make toolbar behavior depend on incidental composition. Avoid fixed `h-*` on toolbar wrappers and page files; use primitive sizes like padding plus `min-h` floors where a control needs a stable target.
- Decision: Keep chart toolbar buttons/controls at a 32px outer target when they share a row with segmented/tab controls, but make that target padding/min-height driven inside primitives, not fixed-height wrapper driven. Dense adjacent controls use 6px gaps; larger groups and toolbar padding use 8px.
- Proposed direction: Keep `Button md` / chart toolbar controls as the 32px outer baseline for chart panels. Implement it through named toolbar-control primitives or recipes (`px/py`, text line-height, icon size, `min-h-8`) and keep segmented controls as `p-0.5` wrapper + 28px inner items. If a truly compact toolbar is needed later, add a separate explicit compact recipe; do not auto-detect from adjacent components.
- Verification needed: Live `/`, `/chain/ethereum`, `/protocol/uniswap`, and one smaller viewport. Measure standalone controls 32px from primitive min-height/padding, segmented wrapper 32px, inner tab items 28px, 6px dense control gaps, 8px group gaps/padding, chart plot top offset, and export button alignment.

### Protocol Rankings Table Toolbar

- Route/page: `/` home rankings table and `/chain/:chain` rankings table.
- Component/file: `src/containers/ProtocolRankings/Table.tsx`, `src/components/TagGroup`, `src/components/Select/SelectWithCombobox.tsx`, `src/components/Filters/TVLRange.tsx`, `src/components/ButtonStyled/CsvButton`.
- Figma node(s): Table area is inside `6183:292119`; exact toolbar child needs a focused Figma pull before code changes because the full home metadata output truncates near the table.
- Current issue: User notes the filter buttons above the table are too small at 24px and now prefers 32px toolbar buttons for consistency with chart toolbars and adjacent segmented/tab controls. Earlier docs had the table filter band at `p-3`; the current canonical recipe is `p-2`, title `label-md`, 32px controls, 6px dense control gaps, and 8px group gaps.
- Current code context: `ChainProtocolsTable` toolbar now uses the shared `TableToolbar`; category/period controls are `TagGroup variant="responsive" size="md"` so they match chart toolbar segmented controls; Columns/TVL Range/.csv use md 32px controls.
- Shared usage/context: `ChainProtocolsTable` is also imported by compare/protocol-related pages. `TagGroup size="sm"` and `Button sm` are shared by many table/filter bands outside home.
- Special cases: Table filter bands were intentionally denser than chart panel toolbars per earlier hard rule. Moving them to 32px/8px is a design-system rule change, not a home-only tweak.
- Surrounding layout impact: Taller filter controls can increase table header height and push rows below the fold. Wider gaps can wrap controls sooner on tablet widths.
- Grid/flex/layout notes: The toolbar could eventually be a grid with title and control area columns to reduce wrapping hacks. Keep row height padding-driven: wrapper padding/gap sets the band rhythm, while each control owns its own padding/min-height.
- Hardcoded hacks to remove: Avoid per-control fixed `h-*` overrides and wrapper height hacks. Use a named 32px toolbar-control recipe / existing `Button md` baseline instead of height tweaks in page files.
- Decision: Move table toolbar controls to a 32px outer target, implemented through primitive padding/min-height rather than fixed wrapper height. Use 6px inside dense control clusters and 8px between larger groups / for toolbar padding. Table toolbar segmented controls should use the standard tinted segmented recipe, matching chart period/denomination controls; the solid joined-toggle recipe is only for explicit scope-switch exceptions such as the metrics header.
- Proposed direction: Use the same explicit 32px toolbar-control baseline as chart toolbars where these controls are toolbar peers. Segmented controls remain 32px outer / 28px inner and use `bg-brand-muted text-link` when selected. Do not auto-detect based on adjacent components.
- Verification needed: Live `/`, `/chain/ethereum`, `/compare-protocols` if it reuses `ChainProtocolsTable`; measure toolbar padding 8px, dense gaps 6px, group gaps 8px, control heights 32px, wrapping, and table header alignment.

### Protocol Info Action Controls

- Route/page: `/protocol/:protocol`, especially the protocol information/metadata area above Methodology.
- Component/file: Protocol overview/info section action controls: category link, audit select, website/GitHub/Twitter/external-link buttons, and related shared button/select primitives.
- Figma node(s): Protocol overview nodes previously listed by user: `6183:312589`, `6183:311951`, plus related child nodes in the protocol info section. User screenshot confirms the live `/protocol/:protocol` controls already look 32px and match Figma's 32px direction.
- Current issue: These controls are another anchor for the 32px design-system rhythm. They are not chart controls, but they sit in a button/select action area and should follow the same outer control target. Figma `6183:312146` also shows metadata as tertiary labels without colons, with the category action rendered as a neutral 32px secondary button below the label rather than an inline blue link.
- Shared usage/context: The same button/select primitives are reused in protocol, cex-like protocol pages, stablecoin asset info, chain, and toolbar rows. This supports treating 32px as the standard action-control size outside dense cards/popover rows.
- Special cases: Dense card secondary actions, popover list rows, table row icon hit targets, and metrics browse selected pill can remain their own compact recipes. Do not use this entry to inflate every tiny inline action.
- Surrounding layout impact: Keeping these at 32px preserves the current protocol-page composition and aligns category/audit/select/external links without adding per-row fixed heights.
- Grid/flex/layout notes: The section can remain gap/padding driven. Buttons/selects should own their 32px outer target through primitive padding/min-height, not a hardcoded row height.
- Hardcoded hacks to remove: Avoid source-file `h-8` clones around these controls if the primitive already provides the target. Avoid one-off protocol-page padding classes where `Button md` / select-trigger variants can encode the size.
- Decision: Protocol/stablecoin info action controls should stay 32px and count as part of the shared toolbar/action-control rhythm. Metadata labels in these detail cards use `label-md text-tertiary` without a colon; values/body text stay `text-primary`; external actions use neutral `Button md`/`buttonStyles({ size: 'md' })`, not outline-blue action styling.
- Proposed direction: Document 32px `Button md` / select trigger as the standard for protocol/stablecoin info action rows, chart toolbars, and table toolbar controls. Keep dense-card buttons compact unless a live comparison shows they need promotion.
- Verification needed: Live `/protocol/uniswap` and at least one cex-like protocol page: category link, audit select, website/GitHub/Twitter/external buttons are 32px from primitive sizing, with consistent radius, padding, icon size, and gaps.

### Protocol Rankings Table Row Icon Hit Areas

- Route/page: `/` home rankings table and `/chain/:chain` rankings table.
- Component/file: `src/containers/ProtocolRankings/Table.tsx` name and TVL cells; `src/components/Bookmark.tsx`; `src/components/QuestionHelper.tsx`.
- Figma node(s): Table area is inside `6183:292119`; row/icon hit-area details need a focused table node pull before code changes.
- Current issue: Bookmark, accordion/expand, and question-mark helper icons in protocol table cells are visually 16px icons with little or no padding, making the clickable/hover target too tight. User wants padding around the icon but an equal negative margin on all sides so the visual icon stays aligned while the hit area grows.
- Current code context: The expand/collapse button is `className="absolute -left-0.5"` and renders a 16px chevron with no padding. The fallback bookmark renders `<Bookmark readableName={value} data-lgonly data-bookmark />`; `Bookmark` itself has generic positioning baked in via `-left-0.5` and `data-[bookmark=true]:absolute ...`, also with no padding. `ProtocolTvlCell` renders `<QuestionHelper />` directly in `className="flex items-center justify-end gap-1"`, and `QuestionHelper` is just a 16px `help-circle` icon wrapped by `Tooltip`.
- Shared usage/context: `Bookmark` and `QuestionHelper` are used outside this table, including chain/protocol action rows, info sections, select options, and income statement rows. A hit-area fix should either be table-specific via `className` or split generic icon-trigger styling from placement. Do not enlarge every Bookmark/QuestionHelper if it breaks dense layouts.
- Special cases: The table name cell uses absolute positioning for the left icon and row index/logo alignment. Padding must not push the row number, logo, or protocol link out of alignment.
- Surrounding layout impact: Equal padding and negative margin, for example `p-1 -m-1`, expands the click target without changing layout size. If the icon remains absolutely positioned, the negative margin must be accounted for so the hit target does not overlap the row index too aggressively.
- Grid/flex/layout notes: The visual column should remain aligned by the table cell layout; hit area should be an interaction wrapper around the icon, not extra spacer columns.
- CSS selector question: Prefer an explicit reusable class/primitive over broad CSS selectors. Selectors like `.table td svg` or `[data-bookmark] svg` would be brittle because icons appear in many table contexts with different alignment needs. A named class such as `tableIconHitTargetStyles` or a tiny `IconHitTarget`/`TableIconButton` makes the padding/negative-margin contract visible at the call site.
- Hardcoded hacks to remove: Avoid hidden table-placement behavior inside the generic `Bookmark` component. Consider moving `data-[bookmark=true]:absolute` / left offsets to the table call site or a named table-row icon button class. Avoid descendant selectors that style all helper SVGs implicitly.
- Decision: Keep the hit-area rollout table-only for now, but create a tiny reusable style/helper (`IconHitTarget` or `tableIconHitTargetStyles`) because the same pattern will likely be reused later.
- Proposed direction: Use an explicit table-local shared helper for all three icon families: 16px icon, `p-1 -m-1`, center alignment, focus-visible/hover treatment if accepted, and preserve current visual x/y alignment. Keep the abstraction tiny and avoid broad CSS selectors.
- Verification needed: Live `/` table rows with bookmarked, expandable, and question-helper protocols: click/hover target visibly/factually larger, icon visual position unchanged, row number/logo/value spacing unchanged, keyboard focus ring not clipped, no overlap with horizontal scroll edge, tooltip still anchors to the expanded hit target.

### Protocol And Chain Card Icon Hit Areas

- Route/page: `/protocol/:protocol` info/stat card headers and `/chain/:chain` stat cards.
- Component/file: Protocol overview card/header actions, chain overview stat cards, shared `Bookmark`, link/copy/external-link icon actions, and any eventual tiny `IconHitTarget` helper.
- Figma node(s): Protocol overview nodes `6183:312589`, `6183:311951`; chain/home stat card node `6183:292190`; focused header icon nodes still need extraction before implementation.
- Current issue: Protocol-page card header link and bookmark icons, and similar chain-page stat-card icons, should use the same expanded hit-target approach as table bookmark/accordion/helper icons. The visual icon should stay aligned, but the clickable/focusable area should be larger.
- Shared usage/context: These icons appear in card headers rather than table cells, so the same low-level hit-target style can be shared, but placement should remain context-specific. A generic `IconHitTarget` or `iconHitTargetStyles` can handle `p-1 -m-1`; card/table placement classes should stay at call sites.
- Special cases: Do not globally change every `Bookmark` or every inline link icon without checking dense rows, popovers, and excluded surfaces. ProDashboard, investor relations dashboard surfaces, LlamaAI, yields, and account/subscription remain untouched.
- Surrounding layout impact: `p-1 -m-1` should expand click/focus target while preserving icon position and not changing card header spacing. Focus rings must not be clipped by card overflow or the adjacent chart/card border.
- Grid/flex/layout notes: Keep the card header layout padding/gap driven. The hit-target wrapper should not become an extra grid/flex spacer; it should wrap the icon action.
- Hardcoded hacks to remove: Avoid copying `p-1 -m-1` into many files if the pattern repeats. Also avoid hiding placement or absolute offsets inside generic icon components.
- Decision: Extend the hit-target pattern beyond tables to protocol card header icons and chain stat-card icons.
- Proposed direction: Create a tiny reusable hit-target style/helper that is context-neutral for icon actions, then apply it explicitly in table rows, protocol card headers, and chain stat-card headers as each surface is audited.
- Verification needed: Live `/protocol/lido` and `/chain/ethereum`: link/bookmark icons have larger click/focus target, visible icon position unchanged, no layout shift, no clipped focus ring, tooltips/popovers still anchor correctly.

### Metrics Directory Filter Card And Pills

- Route/page: `/metrics`.
- Component/file: Metrics directory filter shell, joined switch, search, and category filter pills.
- Figma node(s): `6183:354500`, `6183:354640`, `6183:354509`, `6183:354516`, `6183:354517`, `6183:354650`, `6183:354658`.
- Current issue: User previously called out that metrics pill border radius and the top filter border radius next to the header seem off. Existing `design-sweep-todo.md` says the extracted top filter shell is `bg-surface`, `border-subtle`, 8px radius, `p-3`, `gap-3`; joined switch is 24px high, 6px radius; category pill `6183:354658` is 24px, full-radius, brand outline, 8px x-padding, 2px content gap.
- Shared usage/context: Metrics pills currently map to the `Button` `filter` variant and chart-dialog option pills map to `metricOptionChipStyles`. Selected chart-toolbar chips remain separate `MetricChip` at 32px.
- Special cases: User wants uniformity, but there are intentionally two pill families: metrics-directory filter pills at 24px/full radius and chart selected metric chips at 32px/full radius.
- Surrounding layout impact: Changing pill radius/height affects filter-card wrapping and alignment with the search/switch row.
- Grid/flex/layout notes: The metrics filter card should remain padding/gap driven. Avoid hardcoded fixed heights; use primitive floors.
- Hardcoded hacks to remove: Any metric page one-off radius or `text-[10px]` should be replaced by existing `Button filter`, `TagGroup`, `Input`, or a documented new primitive variant.
- Metrics card-grid evidence checked:
  - `6183:354679` card grid: horizontal and vertical card gaps are 8px; card padding is 12px; internal card gap is 6px; radius is 8px; title/count/body are all 12/16; arrow icon is 16px.
  - `6183:354745` category section: title row is 20px high, grid begins at y=32, so title-to-grid gap is 12px.
  - User read the gap between repeated groups as 22px; treat category-to-category spacing as a 22px rhythm pending live measurement.
- Decision: Keep the card grid itself at 8px gaps. Use 12px between each category heading row and its grid. Use 22px between repeated metric category groups.
- Proposed direction: Keep the existing card component typography/spacing for now because it already matches the 12px Figma card text and 8px grid gap; adjust only the category rhythm in `src/components/Metrics.tsx`. Re-open pill radius only after the filter-card node is measured live.
- Verification needed: Live `/metrics` in both modes: filter shell radius/padding/border, selected/unselected pill radius, search placeholder centering, switch height, card hover/focus states, 8px card gaps, 12px heading-to-grid gap, and 22px section gap.

### Global Search Result Typography

- Route/page: Desktop and mobile global search.
- Component/file: `src/components/Search/index.tsx`.
- Figma node(s): User screenshot and search overlay context; exact Figma search-result node still needs a focused pull if deeper layout changes are made.
- Current issue: Result type tags such as `Chain`, `Protocol`, `Stablecoin`, and `Metric` were using `label-xs` (10px), and result text inherited `body-sm` (12px). User wants tags at 12px and actual result names/subnames at 14px.
- Shared usage/context: `SearchItem` is shared by desktop default results, desktop typed results, mobile default results, mobile typed results, and recent-search rows. Changing the shared item fixes both desktop and mobile.
- Special cases: The recent-clock icon is not text and can remain 12px unless the full row/icon Figma node says otherwise. Search input placeholder remains `body-sm` per the existing input recipe.
- Surrounding layout impact: Increasing result text to 14px can increase row height if content wraps. Keep row padding and icon sizes unchanged for now, then live-check the popover scroll height and row hover state.
- Grid/flex/layout notes: Row layout remains flex because result names, optional subname breadcrumbs, right labels, and recent icons wrap responsively.
- Hardcoded hacks to remove: Avoid `text-[14px]` or `text-[12px]`; use `body-md` for result text and `label-sm` for type labels.
- Decision: Use `body-md` for global search result rows and `label-sm` for result type tags.
- Proposed direction: Apply in `SearchItem` only; do not touch local page-specific comboboxes in this pass.
- Verification needed: Live desktop and mobile global search: result names/subnames 14px, type labels 12px, row hover/focus still spans full width, recent rows still align, and no text overlap with the scrollbar.

### RWA Filter Rows And Table Toolbar Drift

- Route/page: `/rwa`, `/rwa/chains`, `/rwa/categories`, `/rwa/asset-groups`, `/rwa/platforms`, RWA Perps pages, and RWA table sections.
- Component/file: `src/containers/RWA/Filters.tsx`, `src/containers/RWA/AssetsTable.tsx`, `src/containers/RWA/Categories.tsx`, `src/containers/RWA/AssetGroups.tsx`, `src/containers/RWA/Chains.tsx`, `src/containers/RWA/Platforms.tsx`, and RWA Perps toolbar/filter components.
- Figma node(s): RWA-specific filter frames were not provided; apply the global toolbar/filter/checkbox decisions unless a route-specific Figma node overrides them.
- Current issue: RWA pages had drift between checkbox and switch controls, right-aligned page filter rows on some subpages, a centered table search field, and a filter trigger that could grow taller than its 32px peers because of the active-count badge.
- Shared usage/context: RWA filter rows sit in table/action toolbar contexts and should follow the shared toolbar rhythm. Do not use the Switch primitive for Stablecoins/Governance/RWA-Perps inclusion filters; they are checkbox filters.
- Surrounding layout impact: The active filter count badge belongs inside a 32px trigger without increasing button height. RWA table search belongs with the right-side table controls, not as a centered pseudo-title. Page-level RWA inclusion filters should left-align like `/rwa` home so subpages do not drift.
- Grid/flex/layout notes: Use `gap-2` for page-level filter-row groups and `gap-1.5` inside dense toolbar clusters. Avoid `justify-end` on the page-level inclusion row unless the surrounding layout explicitly requires a right action group.
- Decision: RWA Stablecoins/Governance/RWA-Perps filters use `Checkbox variant="filter"` with the 14×14 checkbox box. RWA inclusion rows are left-aligned. RWA table search joins the right toolbar controls. The RWA filter trigger remains a 32px `Button md`; internal badges must not increase the trigger height.
- Verification needed: Live `/rwa`, `/rwa/chains`, `/rwa/categories`, `/rwa/asset-groups`, `/rwa/platforms`, and one RWA Perps route: checkbox size/state, left-aligned filter row, 32px filter/reset/docs buttons, table search right alignment, wrapping on narrow desktop, and no query/filter semantics changed.

### Cross-Page Panel/Card/Table Propagation

- Route/page: Home/chain, protocol overview/subpages, cex assets/stablecoins, stablecoins, bridges, DAT, token, RWA, LST, liquidations, adapter metrics, oracles, markets, MCP, governance, unlocks.
- Component/file: `src/ui/Panel.tsx`, `src/ui/Card.tsx`, `src/components/Table/TableWithSearch.tsx`, `src/containers/ChainOverview/ChainChartPanel.tsx`, `src/containers/ProtocolOverview/ProtocolChartPanel.tsx`, `src/containers/Cexs/CexChartPanel.tsx`, and route-local chart/stat/table shells.
- Figma node(s): Home/chain `6183:292119`, protocol `6183:312589/311951`, protocol TVL `6183:153039/148773/148797/148781`, unlocks `6298:54868/6183:355432`, plus route-family frames still queued in `design-sweep-todo.md`.
- Current issue: The same visual layout language appears across many pages, but code is split between `Panel`, `Card`, and local shells using `rounded-md border border-(--cards-border) bg-(--cards-bg)`, `rounded-lg border-subtle bg-surface`, `p-3/gap-3`, or fixed/min-height hacks. Future changes should propagate through shared recipes instead of re-solving home/protocol in isolation. Figma-backed decision: `Card` and `Panel` share the same `bg-surface border-subtle rounded-[8px]` outer chrome; `Panel` is for chart/table structure, not a stronger border.
- Already aligned: Protocol tab chart pages mostly use `Panel` (`protocol/tvl`, `treasury`, `fees`, `dexs`, `options`, `perps`, `active-loans`, `forks`, `stablecoins`, aggregator tabs), governance project and unlock emissions use `Panel`, CEX chart cards use `CexChartPanel` which wraps `Panel`, and DAT overview/by-asset have partial `Panel` adoption.
- Shared source to update first: `TableWithSearch` now routes through shared table
  header/toolbar paths, so remaining table-toolbar drift should be fixed by tightening
  shared toolbar recipes and call-site group wrappers instead of reintroducing local
  `gap-3 p-3` shells. Desired table recipe: wrapper padding 8px, dense control gap 6px,
  group gap 8px, controls 32px from primitives, no fixed wrapper height, and heading
  chosen by page context: page-primary tables use `PanelHeader` + `PanelTitle as="h1"`,
  pages with an existing h1/hero use compact titleless `TableToolbar`, and secondary/
  embedded tables use compact `label-md` title text or no visible title.
- Must-migrate route bucket: Stablecoin overview/by-chain pages, Bridges overview/protocol/transactions, Token overview/markets/borrow/yields/liquidations, RWA asset/perps/dashboard/overview charts, LST, LiquidationsV2, AdapterMetrics, Oracles, Markets, MCP, and DAT Company still have local shells or legacy `--cards-*` surfaces. These are similar enough to inherit the same panel/card/table rules and should be updated, not left as acceptable one-off implementations. Do the work in route-sized chunks with live checks because several combine stats, charts, tables, tabs, and mobile-specific layouts.
- Shared abstraction boundary: Avoid a giant generic "analytics page shell" abstraction. Prefer a small set of concrete primitives/composites: `Panel` for chart/table panels, `Card` for stat/detail cards, a shared chart-toolbar recipe/composite, `TableWithSearch` for table shells/toolbars, and tiny icon hit-target helpers. If a route has a repeated chart+stats shape, migrate it to those primitives or a narrowly named route-family wrapper like `CexChartPanel`, not another local `div` shell. `border-medium` belongs to controls, inputs, popovers/dialogs, chips/badges, nav dividers, and tooltip/elevated chrome; normal page cards/panels stay subtle.
- Special cases: ProDashboard, investor relations dashboard surfaces, LlamaAI, yields, account/subscription remain untouched. Raises/investor list-like pages are in scope unless separately quarantined. Token-rights shell, typography, spacing, and metadata can modernize when green/warning pills and warnings remain pixel-identical. Dense card secondary actions and popover rows stay compact even when surrounding toolbar controls are 32px.
- Surrounding layout impact: Changing shared table or chart shell padding will move many first-viewport layouts. The safe model is: page stack `gap-2`; panel/card surfaces `rounded-[8px] border-subtle bg-surface`; dense toolbar/header rows use `p-2`, 6px control gaps, and 8px group gaps; `PanelHeader` remains for true titled chart/table panels and page-primary table h1s; controls are 32px by primitive min-height/padding; stat/data cards use `p-2`; protocol overview info/methodology detail cards use `Card padding="sm"` with `gap-3`; only explicitly roomy route-specific detail cards use `p-4`.
- Grid/flex/layout notes: Prefer page-level grids with `gap-2` for card/table/chart placement. Use flex inside toolbars only for wrapping and overflow behavior; avoid margin-driven vertical rhythm. Convert obvious two-column shell layouts to grid where it reduces manual `mr-auto`/`ml-auto` placement, but do not rewrite overflow measurement components like `RowLinksWithDropdown`.
- Hardcoded hacks to remove: Local `rounded-md border border-(--cards-border) bg-(--cards-bg)` panel clones, leftover table-toolbar clones that bypass `TableToolbar`, fixed `h-*` wrappers that are not lazy-load reservations, per-page `min-h-[46px]` filter bars, `mt-2` spacing between sibling panels, and legacy hover colors like `hover:bg-(--link-hover-bg)` on in-scope cards/rows.
- Decision: The home/protocol layout decisions must propagate to similar in-scope analytics pages through shared primitives and route-family sweeps, not only the exact home/protocol files. New or touched in-scope pages should not add hand-rolled card/panel/table shells when an existing primitive can express the same surface.
- Proposed direction: Keep `design.md` current before each implementation pass: 8px page/card/table gaps, 8px dense-card padding, table/chart/action toolbar controls at 32px from primitive sizing, table toolbar gap/padding 8px, context-aware heading hierarchy, and no wrapper fixed heights. Then implement through shared primitives/recipes, `TableWithSearch`, chart panel/toolbar helpers, and route-sized migrations for stablecoins/bridges/token/RWA/liquidations/adapter/oracles/markets/MCP. Each migration should delete or isolate local shell class strings instead of copying them forward.
- Verification needed: For each implementation chunk, run live desktop/mobile checks on one representative route per family: `/`, `/chain/ethereum`, `/protocol/uniswap`, `/protocol/tvl/uniswap`, `/cex/assets/binance`, `/stablecoins/usdt`, `/bridges/wormhole`, `/token/ethereum:0x...` or a live token route, `/rwa`, `/liquidations`, `/oracles`, `/mcp`. Measure outer gaps, toolbar padding/gap/control height, card padding, header type, row hover, and no chart visual regression.

### Global Spacing Rule Conflicts To Resolve

- Route/page: Cross-page design-system decision.
- Component/file: `design.md`, `src/ui/Button.tsx`, `src/ui/MetricChip.tsx`, `src/ui/Panel.tsx`, `src/components/TagGroup`, `src/containers/ProtocolRankings/Table.tsx`, chart header components.
- Figma node(s): Home `6183:292119`, metrics `6183:354500/354640`, protocol overview and chart nodes listed in `design-sweep-todo.md`.
- Current issue: Earlier design-system reconciliation said: control group gap 8px, filter-bar controls 6px, dense card padding 8px x / 12px y, table filter band `p-3`, chart toolbars 32px. The resolved rule is stronger uniformity: 8px layout gaps, 8px card padding, 8px toolbar padding/group gaps, 6px dense toolbar control gaps, and toolbar controls that are visually consistent while remaining padding/min-height driven rather than wrapper-height driven.
- Shared usage/context: These are primitive-level choices. A change here touches home, chain, protocol, cex chart shells, metrics, table toolbars, and future page sweeps.
- Special cases: Excluded/quarantined surfaces remain pro dashboard, investor relations dashboard surfaces, LlamaAI, yields, account/subscription. Raises/investor list-like pages are in scope unless separately quarantined. Token-rights shell, typography, spacing, and metadata may modernize while preserving green pills/warnings pixel-identically.
- Surrounding layout impact: Unifying everything to 8px could make the UI calmer, but it may reduce intentional density differences between table filters, chart toolbars, popovers, and card internals.
- Grid/flex/layout notes: Prefer page/component grids with declared gaps over nested flex rows with local margin hacks. Use flex only where intrinsic wrapping/overflow behavior is actually needed, such as RowLinks overflow measurement and toolbar wrapping.
- Hardcoded hacks to remove: Fixed wrapper heights, arbitrary margins, page-level one-off padding, and per-file color/spacing classes should be replaced by primitives/recipes after the decision is made. Component min-height floors are acceptable when they encode an interaction size; page wrappers should not fake control height with `h-*`.
- Decision: True global rules are 8px layout gaps, 8px dense-card padding, 32px toolbar/action controls, 6px dense toolbar control gaps, 8px toolbar padding and group gaps, and padding/min-height driven sizing. Page-specific exceptions remain explicit recipes, such as the 12px home top-controls gap, RowLinks retained 12px text, compact dense-card secondary actions, and chart grid insets.
- Proposed direction: Keep a small number of named recipes: top-controls row, table-filter band, chart-toolbar, dense-card, row-links. Do not collapse them into one generic "8px everything" recipe.
- Verification needed: After decisions, update `design.md`, then verify representative pages live: `/`, `/chain/ethereum`, `/metrics`, `/protocol/uniswap`, `/protocol/tvl/uniswap`, and one cex chart page.

### Protocol Overview And TVL Page Surfaces

- Route/page: `/protocol/:protocol` and `/protocol/tvl/:protocol`.
- Component/file: `src/pages/protocol/tvl/[protocol].tsx`, `src/containers/ProtocolOverview/index.tsx`, `src/containers/ProtocolOverview/ProtocolChartPanel.tsx`, `src/containers/ProtocolOverview/KeyMetrics.tsx`, `src/containers/ProtocolOverview/AdditionalInfo.tsx`, `src/containers/ProtocolOverview/IncomeStatement.tsx`, `src/ui/Panel.tsx`, `src/ui/Card.tsx`.
- Figma node(s): TVL title strip `6183:148786`; TVL page frame `6183:148773`; TVL panel instance `6183:148797`; protocol overview page frame `6183:312589`.
- Current issue: The `/protocol/tvl/:protocol` title strip should remain a standalone title surface, not `PanelHeader`. Figma `6183:148786` is a standalone title card: 8px surface radius, `bg-surface`, `border-subtle`, `p-2`, 28px logo, 12px logo/title gap, and a 20px/28px semibold title. `PanelHeader` is for chart/table panels: it adds a bottom divider and uses `PanelTitle` at 18px/22px.
- Current TVL panel status: The TVL title strip is migrated to `EntityTitleStrip`, and the TVL breakdown chart cards are migrated to `Panel`, `PanelHeader`, and `PanelTitle`, which matches Figma `6183:148797` for true chart panels. Keep that direction. The remaining TVL questions are live title-strip verification, panel grid gaps, and chart body padding/height verification.
- Current protocol overview status: The summary/key-metrics card, the chart card wrapper, the mobile header/key-metrics wrappers, and `IncomeStatement` still use local `rounded-lg border border-subtle bg-surface p-*` shells. They are not all the same component. The left summary/key-metrics surface is a dense card; the main chart area is a chart-card shell with an inline toolbar; `AdditionalInfo` sections have been migrated to `Card padding="sm"` with tertiary no-colon metadata labels and neutral md action buttons; `IncomeStatement` is closest to a panel/table section with a header/control row.
- Shared usage/context: The same title-card/header-card pattern appears on multiple protocol subpages, CEX pages, bridge protocol overview, chain overview, and LiquidationsV2 summary. Remaining local `rounded-lg border border-subtle bg-surface` shells on other analytics pages should be mapped to primitives/composites rather than patched per file.
- Special cases: ProDashboard, investor relations dashboard surfaces, LlamaAI, yields, account/subscription stay untouched. Raises/investor list-like pages are in scope unless separately quarantined. Token-rights remains a special pixel-stability surface. Dense card secondary actions can stay compact; chart/table/protocol action controls stay 32px.
- Surrounding layout impact: The TVL title strip target is 44px with `p-2`/28px logo and needs live verification. Migrating overview shells to primitives can change internal gaps because current overview cards use large `gap-6` stacks inside `p-2` surfaces.
- Grid/flex/layout notes: The TVL page frame shows chart panel columns with 16px horizontal gaps and 12px vertical gaps, while the current code uses `gap-2` and the broader owner decision prefers 8px analytics-page rhythm unless a page-specific visual check proves the wider Figma spacing is needed. The protocol overview main grid already uses `gap-2`; internal card stacks should be audited so `gap-6` is intentional content grouping, not a shell-spacing substitute. Figma `6183:312146`, `6183:312158`, and `6183:312167` use an 8px card inset with a 12px internal stack for protocol/detail cards, including 12px gaps before action rows; this is a card-internal rule, not a page-grid rule.
- Hardcoded hacks to remove: Continue removing hand-rolled title-card classes where `EntityTitleStrip` covers the slot. Replace repeated protocol overview card shells with `Card` or narrowly named composites. Avoid using `Panel` for non-panel title/detail cards just because the border/radius/background match.
- Decision: Use the standalone `EntityTitleStrip`/`PageTitleStrip` primitive instead of forcing title strips into `Panel`. It encodes 8px radius, `border-subtle`, `bg-surface`, `p-2`, 28px logo support, 12px media/title gap, and a 20px/28px heading.
- Decision: Use fixed `Card` chrome so protocol/detail surfaces can migrate without keeping local shell classes.
- Decision: Keep TVL panel grid at the global 8px analytics-page rhythm for now. The Figma `16px` column / `12px` row spacing is documented, but should not be adopted without live comparison.
- Decision: Protocol overview main chart card should become a chart-card composite or use a `Card` shell plus chart-toolbar recipe. It should not become `PanelHeader`, because the overview chart toolbar is inline above the chart rather than a titled panel header.
- Decision: Protocol header action icons should use the same explicit icon hit-target helper as table/card icons. Current website/bookmark actions use small `p-0.5` padding; the desired pattern is visually aligned icons with a larger hit area, likely `p-1 -m-1`, applied at the action site.
- Proposed direction: Keep `/protocol/tvl/:protocol` title strip on `EntityTitleStrip`; keep TVL chart panels on `Panel`; then migrate protocol overview in chunks: summary/key-metrics dense card, overview chart card shell/toolbar, and `IncomeStatement` panel/table shell. `AdditionalInfo` detail cards are now on the `Card padding="sm"` recipe and need live verification rather than another shell migration.
- Verification needed: Live `/protocol/tvl/lido` and `/protocol/lido` in dark/light if practical. Measure title strip height 44px, padding 8px, logo 28px, title 20px/28px, border/radius colors, panel headers 56px with 32px controls, overview chart toolbar controls 32px, card/header icon hit targets, and loading/error panel flex expansion.

### Chart Panel Padding And Toolbar Control Gaps

- Route/page: Cross-page chart panels: `/`, `/chain/:chain`, `/protocol/:protocol`, `/protocol/tvl/:protocol`, CEX chart pages, stablecoins, bridges, RWA, LST, liquidations, adapter metrics, oracles, markets, token pages.
- Component/file: `src/components/ECharts/ChartContainer.tsx`, `src/components/ECharts/ChartHeader.tsx`, `src/components/ECharts/MultiSeriesChart2/index.tsx`, `src/components/ECharts/PieChart/index.tsx`, `src/components/ECharts/useDefaults.tsx`, `src/containers/ChainOverview/ChainChartPanel.tsx`, `src/containers/ProtocolOverview/ProtocolChartPanel.tsx`, `src/ui/Panel.tsx`, `src/components/Select/types.ts`, `src/ui/Button.tsx`, `src/ui/MetricChip.tsx`.
- Figma node(s): Home chart/control areas `6183:292218`; protocol chart controls `6183:312702`; protocol TVL panels `6183:148797`.
- Current issue: Toolbar control gaps are not consistently defined. Several modern chart toolbars use `gap-2` (8px), which can feel too loose when every control is already 32px. Older or table-like areas use `gap-1.5` (6px) or route-local `gap-1`/`gap-3`. Separately, chart panel padding is easy to double-count because chart headers use DOM padding while line/bar chart plot insets come from ECharts grid settings.
- Current shared chart behavior: `ChartContainer` is only a wrapper; it does not add padding. `MultiSeriesChart2` and `PieChart` render their optional `ChartHeader` with `p-2 pb-0`, so header rows get 8px top/side padding and no bottom padding. The chart itself gets its visual inset through ECharts grid options, usually 12px in modern chain/protocol charts and 20px in older `useDefaults` charts. This means adding DOM body padding around those charts can create double spacing.
- Current panel behavior: `PanelHeader` uses `px-4 py-3`, a 56px/titled-panel recipe extracted from protocol TVL panel Figma. Its control cluster now uses the reconciled 6px dense toolbar gap while preserving the taller titled-panel padding. This is still different from the compact "toolbar above chart" pattern used by home/chain/protocol overview chart cards.
- Current code examples: `ChainChartPanel` has a route-local chart card with `px-2 pt-3 pb-0` on the toolbar row and `gap-2`; `ProtocolChartPanel` has a toolbar row `gap-2` above a chart body; shared `ChartHeader` defaults to `mb-2 ... gap-2 px-2` but `MultiSeriesChart2` overrides it to `p-2 pb-0`; `chartSegmentedControlGroupStyles`, `buttonStyles({ size: 'md' })`, and `metricChipStyles` all target 32px controls.
- Audit pass: Read-only subagent audits confirmed the split. Shared chart bodies are intended to be flush: `Panel` has no body padding and `ChartContainer` has no padding. Cartesian chart inset mostly comes from ECharts grid values of 12px, not DOM padding. Non-cartesian charts vary: treemap has explicit chart CSS padding, pie uses grid 0 plus legend/center math, and sankey does not follow the same grid model.
- Audit pass: `PanelHeader` adopters share the titled-panel recipe: CEX chart panels, protocol TVL, treasury, active loans, DAT overview/by-asset, and unlock emission panels inherit `px-4 py-3` and now use 6px dense control gaps.
- Audit pass: Route-local toolbar shells frequently already use the desired no-bottom-padding structure but drift in values: stablecoins and bridges mostly use `p-2 pb-0 gap-2`; RWA/RWA Perps and markets often use `p-3` or `p-3 pb-0`; AdapterMetrics has one `gap-1`; `TableWithSearch` is a shared table source with `gap-3 p-3`.
- Shared usage/context: Some chart panels have no DOM header at all and only render the chart; some have export buttons/title inside shared `ChartHeader`; some have a richer route-specific toolbar with Add Metrics, metric chips, segmented controls, embeds, CSV, and PNG. The padding rule must distinguish these contexts.
- Special cases: Pie/treemap/sankey charts may not use a normal ECharts grid inset, so they need route-by-route visual verification before assuming the same body-padding rule. Excluded surfaces remain ProDashboard, investor relations dashboard surfaces, LlamaAI, yields, account/subscription.
- Surrounding layout impact: Reducing toolbar control gaps from 8px to 6px while keeping controls 32px improves density without changing button hit targets. Changing panel padding can move chart plots and dataZoom ranges, so chart visual output must be checked live and not adjusted through ECharts option churn unless the chart itself is wrong.
- Grid/flex/layout notes: Use 8px for panel/card/page outer spacing and header row padding. Use no bottom padding on chart toolbar rows when the chart/plot immediately follows. Let the chart grid or chart-specific layout own the 8-12px plot inset. Use 6px as the default for dense control-to-control gaps inside chart/table toolbars; keep 8px for separating control groups or page sections.
- Hardcoded hacks to remove: Route-local `p-3 pb-0`, `gap-3`, `gap-1`, and fixed `h-*` toolbar wrappers should migrate to named chart-toolbar recipes. Do not add body `p-2` around `MultiSeriesChart2` just to force 8px DOM padding; that duplicates the chart grid inset.
- Decision: Dense chart/table toolbar control clusters standardize on 6px gaps with 32px controls, while page/panel/card spacing and larger group spacing remains 8px.
- Decision: `PanelHeader` remains the 56px titled-panel recipe, with 6px gaps between dense header controls. A separate `ChartToolbar`/`ChartPanelToolbar` recipe still exists for route-specific inline chart controls that need 8px toolbar padding and no bottom padding. The Figma-derived `PanelHeader` is a different context from inline chart toolbars, but its control spacing should not drift wider.
- Historical decision (superseded by the landed chart-theme/geometry reconciliation below): do not change cartesian ECharts grid inset without screenshots/pixel checks. That visual review later occurred and established the shared 8px visual-inset contract.
- Decision: Generic `CSVDownloadButton` may default to 24px (`size="sm"`), but chart/table toolbar usage should explicitly pass `size="md"` or use chart export wrappers so mixed-height controls do not return. Dense-card secondary actions may remain 24px.
- Proposed direction: Add documented primitives/recipes: `ChartPanelToolbar` for route-specific chart toolbars (`px-2 pt-2 pb-0`, no bottom padding, 32px controls), `ChartPanelControlGroup` for dense internal 6px control clusters, and leave `PanelHeader` as the titled-panel recipe. Keep chart-only surfaces body-flush and avoid DOM body padding around grid-based charts.
- Verification needed: Live visual/measured checks on `/`, `/chain/ethereum`, `/protocol/lido`, `/protocol/tvl/lido`, `/cex/assets/binance`, stablecoins, bridges, RWA, liquidations, adapter metrics, and one token chart section. For each, measure toolbar row padding, control gap, control height, chart top spacing, left/right plot inset, bottom dataZoom spacing, and whether removing/adding DOM padding changes chart visuals.

#### Chart Panel Audit Buckets (closed)

- Standard in-scope external-toolbar and full-lazy chart panels moved to `ChartPanel`, `ChartPanelToolbar`, `ChartPanelBody`, `ChartPanelBodyFallback`, and `ChartPanelExportShellFallback` instead of local `Panel padding="none"` chart chrome.
- Titled `PanelHeader` context, not inline-toolbar context: protocol titled subpage panels, token PnL, allocation/events panels, and similar title/header sections keep `PanelHeader` while their chart body fallback can still use the 360px body helper when the header is outside Suspense.
- Custom/dynamic chart cases remain explicit: treemap/candlestick/HBar branches, market mini charts, table-shaped reservations, and surfaces whose height depends on active view or row count.
- Mixed chart/table panels are complete broader data surfaces rather than incomplete `ChartPanel` migrations.
- The closure review found no pending shared-grid, dataZoom, legend, plot-height, or shell migration in these buckets.

### 2026-07-07 Follow-Up Implementation Notes

- `PaginatedTable` now supports `shell="none"` for embedded tables. Use this when the parent already provides the `Panel`/`Card` border so Equities, Token, and RWA detail tables do not double-border. Standalone paginated tables keep the default shell.
- Bridges overview/protocol pages now use segmented toolbar controls for chart/table switches, 32px select/export controls, and shared chart-toolbar spacing for Bridge Volume. The Large Txs tab no longer shows a search box that does not affect the table.
- Equities list/ticker/filings/onchain/financial surfaces moved toward `Panel`/`Card`/`TableToolbar`; Equities filter dialog moved to shared dialog/popover/card recipes. Remaining Equities debt is inside the financial table cell styling and any live route-specific spacing checks.
- MarketMakers drawer chrome moved to shared surface/backdrop/close-button semantics, and the refine timeframe control now uses the segmented-control recipe. Documentation content still has old prose/table tokens and should be a separate content-layout pass.
- Top metric cards on Token overview, RWA, Hacks, Raises, Bridges, Chain overview, Equities, AdapterMetrics, and Extra TVL now follow the two-content rule: standalone headline metrics use `text-secondary` labels and `font-jetbrains text-2xl font-semibold` values, while secondary rows stay compact row content (`body-md`/`body-sm` labels with `mono-md`/`mono-md-bold` values). Do not promote secondary rows to the headline style.
- Token/unlocks and RWA notes-prose cards are the same detail-card family as protocol/stablecoin information and methodology cards: `Card padding="sm"`, 12px internal stack, `heading-xs`, and readable `body-md text-primary` body/list content.
- Unlocks allocation/events follow the Figma titled-panel split from `6291:39042` and `6291:39214`: section headings stay in `PanelHeader`, content lives in a compact 12px padded slot, and pagination/content is not allowed to add vertical wrapper padding around the cards. The event card itself follows `6298:39347` and is the current documented `Card radius="large"` exception: 12px radius, 16px padding, subtle border, body-md primary lines, body-sm secondary lines, compact countdown pill, and preserved countdown/calendar behavior. Allocation rows keep the app's readable floor (body-md labels, mono-md percentages, 6px progress bars) while preserving existing category colors.

### 2026-07-09 ChartPanel Shell Migration Notes

- `ChartPanel` now covers the broad in-scope standard chart-shell pass: raises, protocol/chain overview, DAT, RWA, stablecoins, bridges/bridged TVL, forks, oracles, protocol taxonomy, protocol metric pages, adapter metrics, token overview, token usage toolbar usage, hacks, unlocks, banks, NFTs, compare routes, LST, governance, CEX chart helper, ETF, liquidations, and equities ticker chart shells.
- The shared min-height constants were not kept as exported values. Call sites import the helper component that matches their chart shape instead: `ChartPanelBodyFallback` for an already-mounted toolbar plus 360px chart body, and `ChartPanelExportShellFallback` for a lazy chart component that renders its own 40px title/export header plus the 360px chart body.
- Intentional leftovers are documented exceptions, not missed blanket replacements: mixed chart/table panels, row-count table placeholders, treemap/candlestick/HBar/custom-height branches, market mini charts, and excluded products.

### 2026-07-09 Table Heading And Toolbar Hierarchy Notes

- Primary table pages should promote existing visible table title text to `h1` instead
  of adding a new heading. Use `PanelHeader` + `PanelTitle as="h1"` directly, or
  `TableWithSearch headingAs="h1"` when the table uses that helper. Current audited
  examples include Governance, Bridge Chains, RWA Assets, and `/protocols` Protocol
  Rankings.
- Pages that already have a real h1/hero above the table should not add another table
  title. The table uses compact `TableToolbar` with search/filters/actions only.
  `/unlocks` is the model here: its page h1 remains the page title, and the table toolbar
  has no local "Token Unlocks" title.
- Secondary and embedded tables use compact `TableToolbar` plus an existing `label-md`
  title only when the surrounding section does not already label the table; otherwise
  omit the visible title. Equities Financials is a secondary-table example.
- All chart/table toolbar controls are md/32px in these contexts. This includes table
  search, column selectors, TVL/range filters, selects, CSV/download actions, countdown
  chips, and calendar icon actions. Dense-card secondary actions and popover rows remain
  separate compact recipes.
- Remaining work is route-family adoption and live verification, not a new rule debate:
  find hand-rolled `px-2 py-1.5 text-xs`, implicit/default `sm`, local table toolbar
  shells, and duplicated h1/table-title situations as each route family is touched.

### 2026-07-09 Status Shell Helper Notes

- `PanelStatus` / `PanelLoadingStatus` remain the full standalone panel state helpers.
- `SurfaceBodyStatus` / `SurfaceBodyLoadingStatus` exist for states inside an existing
  `Panel` or `Card` body where adding another surface shell would create a double border
  or different padding recipe. The helper owns reservation/centering/semantics; callers
  own body padding such as `p-2`.
- `ChartPanelBodyFallback` remains the chart-body reservation helper. Do not replace chart
  Suspense reservations with generic status helpers unless the surrounding chart shell is
  not a `ChartPanelBody`.
- First high-confidence adopters: NFT royalties, trending contracts, CEX markets,
  ChainsByCategory shared chart state, token overview chart-body states, investor
  relations gated state, borrow, compare placeholders, watchlists, and LiquidationsV2
  access-gate states.
- Same-branch ARIA-only follow-up: visible chart/status loaders and errors in
  AdapterMetrics protocol/chain charts, Markets mini charts, and standalone `/chart/*`
  pages can gain `role="status"` / `role="alert"` without changing shell ownership or
  chart height. Blank Suspense reservation divs are not status messages.
- Deferred status-role targets: global Search popover rows, Add to Dashboard dashboard
  list loader, MarketMakers rank table states, and shared select/combobox empty-row
  semantics need focused follow-up because they touch shared popover/table/product
  behavior.

### 2026-07-09 Residual Chart / Componentization Handoff (chart portion closed)

- The formerly residual chart shells were reviewed after the geometry pass. Mixed
  chart/table panels, table-shaped reservations, treemap/candlestick/HBar branches,
  custom 480/533/600px charts, market mini charts, and excluded/quarantined products are
  intentional owners of their current composition; no `ChartPanel` migration is pending.
- Chart visual debt is not shell debt. The axis-label, gridline, tooltip,
  candlestick, legend, dataZoom, and geometry work later landed in the focused
  chart-theme pass with visual checks. The post-landing code review found no remaining
  shared chart migration; custom surfaces are intentional owners, not a follow-up queue.
- Exported style-string candidates: `IconHitTarget` is small, `MetricChip` option chips
  are medium, `SegmentedControl` and `SearchField` are broad, and `Popover.ts` style
  exports should stay until there is a dedicated Ariakit abstraction pass.

### 2026-07-09 Overlay Surface Split (popovers/tooltips/dialogs white in light mode)

- Route/page: all floating overlays — shared popovers/menus/selects, tooltips/hovercards,
  search palettes, content dialogs, toasts, DOM chart tooltips.
- Component/file: `src/ui/Popover.ts`, `src/ui/Dialog.tsx`, `src/ui/ChartTooltip.ts`,
  `src/ui/FailedDataPopover.tsx`, `src/styles/semantics.css`, plus direct callsites
  (Search palette, IconsRow hovercard, Unlocks tooltips/hovercards, CustomColumnModal
  autocomplete, Toast).
- Current issue: overlays used `bg-surface-elevated-1` (#eee light). A
  darker-than-surroundings overlay reads recessed/disabled in light mode (light
  elevation = shadow; dark elevation = surface lift); #eee vs #f7f7f7 page barely
  separates; white inputs inside gray overlays inverted the hierarchy; the blue
  hover-row tint muddied on gray; `border-divider` (#eee) was invisible on it.
- Decision (owner, 2026-07-09): new semantic `--ld-bg-overlay` / `bg-overlay` —
  light `#ffffff`, dark `#181a1b` (equals dark elevated-1, so dark mode is
  pixel-identical by construction). Overlay recipes gain a shared elevation shadow
  `shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]`.
- Figma divergence: the library maps overlays to `Background/bg-surface-elevated1`;
  library update requested (add a `bg-overlay` semantic or repoint overlay components).
  Annotated in `semantics.css` following the `text-tertiary` precedent.
- Special cases:
  - **Canvas** dialogs/drawers hosting white `bg-surface` cards keep
    `bg-surface-elevated-1` via new `dialogCanvasSurfaceStyles`: Metrics dialog;
    MarketMakers detail drawer (unchanged). All 17 other `dialogSurfaceStyles`
    dialogs are content dialogs and moved to `bg-overlay`.
  - Sticky dialog footers were `bg-surface` (white band on gray) → now `bg-overlay`
    (opaque, matches surface; `border-t border-subtle` separates).
  - Emphasis boxes inside content dialogs (`AddToDashboardModal` warning box,
    `CustomColumnModal` field chips) `bg-surface` → `bg-surface-elevated-1`.
  - Dashed empty-state wells (RWA/Perps/Equity filter dialogs) `bg-surface` → `bg-page`.
  - `bg-page` inputs/pills on the now-white dialogs need no change — same
    input-on-card combination used on white cards across the app.
  - `UnconstrainedSmolLineChart` tooltip dropped its `dark:bg-surface-elevated-1`
    mode fork → single `bg-overlay`.
  - Legacy/excluded compat styles in `Popover.ts` (ProDashboard/Yields/LlamaAI) and
    all `Downloads/*` overlays intentionally untouched (excluded surfaces).
  - ECharts-native tooltips rendered near-white through the library default at this
    point in the audit. The later chart-theme pass moved their background, border, and
    text onto the overlay/stroke/text chart tokens.
- Drift found during the same audit (fixed in branch):
  - Home-page product-link cards (`ChainOverview/index.tsx`) were interactive Cards
    with no hover affordance → `hover-wash-card` per the Card rule.
  - `RowLinksWithDropdown/OtherLinks` "Others" trigger rested on
    `bg-surface-elevated-2` + `hover-wash` (heaviest neutral, mixed hover
    mechanisms) → `bg-surface-elevated-1` resting, `hover/focus-visible:
bg-surface-elevated-2` opaque step per the documented Select-trigger exception.
- Verification needed: owner visual check in both modes — chain dropdown,
  Include-in-TVL popover, `(?)` tooltip, desktop ⌘K palette, mobile search sheet,
  Add to Dashboard, chart-metrics dialogs, Metrics dialog (must be unchanged),
  toast, unlocks hovercards. Dark mode should be pixel-identical everywhere.

### 2026-07-09 Tooltip/Hovercard Affordance Sweep

- Route/page: app-wide floating hover content; branch `mintdart/tooltip-popover-sweep`.
- Decisions (owner, 2026-07-09):
  - Tooltip radius is 6px (`rounded-md`, new `tooltipSurfaceStyles`) — radius follows
    component size and must not exceed content inset; popovers/menus/dialogs/hovercards
    stay 12px. No Figma tooltip spec was available; raised as a design ask to confirm.
  - Structured hover content moves from `<Tooltip>` to the new shared `ui/Hovercard`
    (hoverable, Escape-dismissable, keyboard-reachable via HovercardDisclosure):
    Tokens `RightsPopover` panel, FullOldViewButton feature list, DAT/Treasuries
    breakdown bars, two RWA AssetsTable cells, InsidersTable allocation breakdown,
    and the 7 copy-pasted `ProtocolChainsComponent` sites (now shared
    `ProtocolChainsHovercard`; arbitrary-font-size debt 40 → 34).
  - Missing affordances filled: RWA Perps category columns, NFT marketplace names
    (also dropped a misleading `hover:underline` on a non-link), RWA fallback
    branches, Correlations add-token buttons, expenses/token-rights source links,
    SelectWithCombobox custom-column buttons, `MetricSection` definitions (now
    matches `MetricRow`), Mcap/TVL & LST column help.
- Known limitation (updated 2026-07-09, second pass): the shared Hovercard anchor now
  also opens on tap/click (`showOnClick`, default on) — the DAT/Treasuries bars had no
  click action of their own, so all span/bar hovercards are touch-reachable. The only
  remaining touch gap is FullOldViewButton (`showOnClick={false}`: its click creates a
  dashboard), which still needs a separate info affordance on touch.
- Later resolution: the ProtocolRankings accessor returns `null` for sorting on formula
  errors, while the cell renderer evaluates separately and exposes `Err` with the error
  tooltip. The earlier “dead badge” finding no longer applies.

### 2026-07-09 Token Hygiene (branch `mintdart/token-hygiene`)

- Decisions (owner, 2026-07-09):
  - `text-data-up-alt`/`down-alt` gain dark overrides (#4b86db / #a674ec, AA on dark
    surfaces) — interim owner values, TODO(design) filed; chart fills stay on the 500s.
  - `--ld-bg-screen-dim` gains a dark override (#090b0c99); light unchanged.
  - `border-divider`/`text-divider` retired into the alpha stroke ramp
    (`border-subtle` / new `text-border-subtle`) — the opaque values matched
    elevated-1/-2 exactly and vanished on elevated surfaces.
  - Focus: the pre-existing global `:focus-visible` ring in tailwind.css goes inset
    (-2px, was +1px — it clipped on full-bleed rows in overflow-hidden popovers);
    new `focus-ring` utility binds to Ariakit `data-focus-visible` for virtual-focus
    rows (which never receive DOM focus — previously NO keyboard indicator), and
    `focus-ring-on-brand` (white) covers solid brand fills (Button primary, active
    nav link) where a brand ring is invisible.
- Final reconciliation of observations:
  - CORRECTION (same day): dialogs DO have a scrim — the global `[data-backdrop]`
    rule in tailwind.css styles every Ariakit backdrop (`bg-black/40 dark:bg-black/70`).
    The real issue is two backdrop systems: dialogs at 40%/70% literals vs the
    `--ld-bg-screen-dim` token (20%/60%) on the MarketMakers drawer. This was later
    resolved by pointing both systems at the token and finalizing modal-strength values
    at light `#090b0c66` / dark `#090b0cb3`.
  - The later code review found that desktop/mobile logo links do not suppress the global
    focus ring. Audited in-scope inputs/composites that suppress it provide an explicit
    border/ring or Ariakit virtual-focus treatment; most remaining matches are excluded
    product code. The old “sidebar logo has no indicator” example is no longer true.
- Owner visual acceptance confirms the current light `hover-row`/`bg-brand-muted`
  relationship and light `text-disabled` output as the shipped baseline. A future design
  library revision may rename or republish those values, but no sweep blocker remains.

### 2026-07-09 Summary-Card Variant Taxonomy (owner decision)

- Three valid summary-card variants, confirmed by owner after the metric-row font
  normalization: (1) headline + "Key Metrics" heading + MetricRow rows (home/protocol
  overview); (2) the same without the heading (adapter overviews, token overview);
  (3) the stablecoins stat stack — vertical `label-md`/`mono-xl` headline pair plus
  compact `label-md`/`mono-md` rows. Variants 1-2 always use MetricRow (`body-md`
  labels); variant 3's `label-md` rows are a documented exception. Codified in
  design.md § Summary metric cards; StablecoinOverview intentionally NOT migrated
  to MetricRow.

### 2026-07-09 SummaryStats Extraction (branch `mintdart/summary-stats-card`)

- New `ui/SummaryStats.tsx`: `SummaryCardGrid` / `SummaryStatsCard` / `StatItem`
  replace the summary-card layout copy-pasted across 19 route files, plus the
  standalone stat stacks (RWA tile grids, home TVL). Deliberately NOT the
  audited mega-component (title/stats/chart props): titles, change badges,
  footers, and collapsible bodies stay callsite JSX — recipes own chrome,
  callsites own layout. StablecoinOverview body untouched (variant 3).
- Deliberate normalizations for owner eyeball: stat label/value gap unifies on
  plain flex-col (4 files lose gap-1); NFT/BridgedTVL 16px label inheritance
  drops to the standard 14px; BridgeProtocolOverview help-icon tooltip becomes
  the dotted underline; ExtraTvlByChain col-span-3 quirk normalizes;
  DAT/ByAsset gains real gap-6 (was inert on a block Panel); BridgedTVL 16px
  rows become MetricRows.
- Bug found and fixed (shipped in #3117): ProtocolTaxonomy DEX-volume row label
  rendered as a literal `{getProtocolCategoryDexVolumeLabel(...)}` string.
- Remaining StatItem shapes backlogged as opportunistic adoptions (card-anchored
  tooltips, local StatCard helpers, colored TokenPnl values).

### 2026-07-09 Chart Theme And Geometry Reconciliation (landed on `main`)

- Backdrop ownership is unified. The global Ariakit `[data-backdrop]` rule and the
  MarketMakers drawer consume `--ld-bg-screen-dim`; the finalized modal-strength values
  are light `#090b0c66` and dark `#090b0cb3`. This supersedes the earlier 20%/60% token
  split and the interim dark `#090b0c99` value recorded above.
- ECharts canvas chrome resolves through `chartTheme`: tertiary axis labels and legend
  page text, active/inactive paging arrows aligned with the table-sort hierarchy, shared
  low-alpha gridlines, semantic candlestick direction colors, and tokenized dataZoom
  chrome. HTML tooltip options use transparent native chrome plus the shared
  `.defillama-echarts-tooltip` overlay recipe. Series palettes remain data colors and are
  intentionally outside this convergence.
- `src/components/ECharts/chartSpacing.ts` is the geometry owner. Standard cartesian
  charts use an 8px visual outer bound via ECharts `outerBounds`; default legends start
  at 8px and reserve 40px before the plot; scroll legends reserve a 16px right paging
  gutter. Slider dataZoom has fixed height and raw right/bottom compensation for ECharts
  handle overflow, producing 8px visible side insets and a 12px visible bottom inset.
- Geometry exceptions are explicit rather than copied local numbers:
  - treemaps keep an 8px canvas-wrapper inset because zoomed content is clipped by the
    canvas, not by the series rectangle; removing the wrapper based on an unzoomed view
    makes zoomed tiles collide with the panel edge;
  - legend-based pies stay at `centerY: 50%` and reserve their legend region, while
    external-label pies can opt into a route-specific center (the bridged composition uses
    `44%`) so unlock/allocation and other legend-based pies are not shifted globally;
  - stacked candlestick panels retain one fixed left edge for cross-panel alignment, and
    scatter keeps labels inside its explicit plot offsets.
- The previous “do not change the 12px-ish grid without screenshots” decision was
  honored, not bypassed: owner screenshots exposed legend, dataZoom, treemap zoom, and pie
  composition behavior, and the 8px shared contract was tuned from those visual checks.
  This is the final chart baseline for the sweep. Later product changes use `chartTheme`
  and `chartSpacing.ts` as ordinary design-system contracts.
