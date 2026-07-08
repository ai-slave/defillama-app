# Theme sweep — living checklist

Working tracker for the Llama Design System rollout (PR 4+). One line per known
inconsistency; checked = shipped on this branch and verified in the browser.
Recipes live in [design.md](design.md); exact Figma specs in the PR notes.
Delete this file when the last page sweep lands.

Process rules (from review feedback):

- When a Figma frame is shared, traverse **every node in it**, not just the pointed one.
- After any batch find/replace, re-grep and verify computed styles live — the commit
  formatter reorders Tailwind classes, so replacements can miss silently.
- New styling goes through `src/ui` primitives or design.md recipes — a hand-written
  border/color in a page file is a defect, not a shortcut.
- A checked item means the implementation shipped and was verified live. If a primitive
  exists but adoption or verification is incomplete, keep the adoption item unchecked.

## Post-merge triage — 2026-07-08

This file is now a living audit/backlog ledger, not a literal merge-blocking checklist.
The broad design sweep and shared popover/mobile-drawer pass have merged to `main`.
Many unchecked items are historical counts, deferred migrations, or "keep unchecked until
live verification" markers. Do not require every unchecked line in this file to be cleared
before opening or merging a focused follow-up branch.

Completed merge packet:

- Owner manual visual route pass was accepted for the merged design sweep.
- The shared popover session landed: `Select`, `SelectWithCombobox`, `MultiSelectCombobox`,
  `Menu`, `NestedMenu`, and in-scope direct popovers use the paddingless popover surface
  and mobile fixed-bottom drawer contract.
- `bun run lint:tokens` baseline is locked in `scripts/design-token-baseline.json`.
- Token-rights green/warning visuals were visually accepted as unchanged.
- Unlocks allocation/events density and the 12px event-card radius exception were accepted
  for the merged sweep.

Current focused backlog:

- Protocol overview cleanup: `KeyMetrics`, `Flag`, `IncomeStatement`, and remaining
  `/protocol/:protocol` overview card/table/dialog/token chrome.
- [x] Text-tier + icon consistency sweep (branch `theme/text-tier-icon-consistency`,
  2026-07-08, from two subagent audits): text-tier decision rule + icon three-role rule
  codified in design.md; TagGroup/Tab/nav resting text tertiary→secondary (supersedes
  the segmented-control "reconciled pick"); SmolStats values secondary + bare tertiary
  qualifier spans (no parens); SelectArrow/QuestionHelper/nestedMenu disclosure pin
  tertiary centrally; Copy + chip-✕ + pagination icon buttons on ghost ladder (opacity
  dimming removed); status icons on `text-warning`/`text-data-down`; bulk pass pinned
  colorless expand/accordion chevrons to tertiary. Out of scope, recorded: Yields
  (VaultRisk tertiary methodology notes, WatchlistView tabs, pool-page toggles,
  borrow.tsx tabs/trigger — excluded surfaces), MarketMakers `TabIcons.tsx` bespoke
  SVG set (bypasses tokens; needs its own pass if ever swept).
- DialogShell pass: mobile dialogs should become bottom sheets, with smooth slide
  animation, shared close-button chrome, footer sizing, headings, and internal scroll
  regions.
- Dense pages cleanup: `DeFiWatchlist` and `TokenPnl` before broad token namespace work.
- Raises chart-shell/fallback reservation pass before any `ChartPanel` extraction.

Medium pending items:

- Range/date popover containment verification and targeted fixes.
- Remaining table toolbar/search alignment cases across route families.
- RWA filter/table rhythm polish.
- Final global search desktop/mobile polish beyond the already-capped desktop height.

Hard or risky pending items:

- Full DialogShell adoption and deleting the legacy `dialog` utility.
- Status-shell adoption across embedded chart bodies, which likely needs a non-`Panel`
  helper first.
- Broad Panel/Card route-family migration for stablecoins, bridges, token, RWA, DAT,
  MCP, borrow, LST, and remaining CEX/detail shells.
- Extracting a new `src/ui/SegmentedControl`.
- Legacy token namespace changes, radius-scale codemods, broad typography codemods, and
  high-fanout folder moves.
- Full unlocks visual redesign beyond accepting or rejecting the current branch output.

Post-merge only means after all of the merge gates, owner verification, and owner
decisions above are resolved and this branch has merged to `main`, or after the owner
explicitly opens a follow-up branch. The deferred list is not fallback work for the
current branch.

Post-merge-only list:

- Rename legacy tokens to `--legacy-*`.
- Drop the `--ld-` prefix from new design tokens.
- Global radius scale codemod from `rounded-[8px]` / `rounded-[12px]` to named Tailwind
  radius utilities.
- Broad typography codemods such as `text-sm font-medium` to `label-md`.
- Move large high-fanout files such as `MetricPrimitives`, `Tooltip`, or loaders into
  `src/ui` purely for folder hygiene.
- Decide Sheets scope.
- Delete `design-sweep-todo.md` or `design-execution-plan.md`.

## Resolved implementation decisions

These are the current owner decisions from [design.md](design.md) and
[design-decision-audit.md](design-decision-audit.md). Do not re-open them during a
page sweep unless a live regression proves the rule is wrong.

- Interactive text floor: 12px. Figma 10px controls/chips are intentionally rendered
  as 12px in the app.
- Card body/data rows: 14px. Figma 12px data rows are intentionally larger in code.
- Dense cards: 8px padding on all sides, even where Figma shows 12px vertical padding.
- Page/card/panel/table placement rhythm: 8px gaps. Home frame 6px vertical gaps are
  intentionally reconciled to 8px. The home top controls row keeps a 12px horizontal gap.
- Toolbar controls: 32px outer target from primitive padding/min-height. Dense adjacent
  chart/table controls use 6px gaps; larger control groups and toolbar padding use 8px.
- `PanelHeader` remains the taller titled chart/table panel recipe. Inline chart/table
  toolbars use a separate compact toolbar recipe.
- Popover surfaces own background/border/radius/overflow only; search blocks, rows,
  action bars, and footers own vertical spacing.
- Multi-select popover rows use compact 14px checkboxes: filled blue when selected,
  empty `border-strong` boxes when unselected. Single-select rows show only the selected
  check mark and no empty box/circle.
- ECharts grid insets are not changed in this sweep. Any chart grid-inset change is a
  visual chart change and needs screenshot/pixel review.
- Dense-card secondary actions can stay compact, e.g. 24px stat-card CSV buttons, even
  while chart/table/action toolbars use 32px.

## Next implementation order after merge

The foundation primitives now exist. Broad sweeps should start by adopting and
verifying existing recipes, not by adding more one-off primitives unless a proven
gap remains.

1. Finish shared composite adoption and browser verification: Select/SelectWithCombobox/
   Menu popovers, remaining direct popover/menu copies, TableToolbar/TableWithSearch,
   protocol rankings toolbar/icon targets, chart export/control rows, and failed-data
   popovers.
2. Migrate route families in chunks: home/chain, metrics/tools, protocol TVL/subpages/CEX,
   protocol overview, then stablecoins/bridges/RWA/token/liquidations/DAT/adapter/markets/
   MCP/borrow surfaces.
3. For each route family, document live verification separately from code migration:
   desktop/mobile where applicable, light/dark, 32px controls, 6px dense gaps, 8px
   group/page gaps, card/panel padding, popover containment, status states, and no chart
   visual regression.
4. Run read-only review passes before the final cleanup: excluded-surface regression,
   chart visual-change risk, token/hardcoded-style drift, semantic HTML/status states,
   duplicated shell/component churn, and route-family visual checklist coverage.

## src/ui primitives

- [x] Button (secondary/primary/outline/ghost × sm/md, padding-driven, aspect-square icon-only)
- [x] Card base primitive exists (`src/ui/Card.tsx`)
- [x] Card border variant: `src/ui/Card.tsx` supports `border="medium" | "subtle"` so
      directory/repeated tiles can keep `border-medium` while protocol/detail surfaces use
      `border-subtle` without local shell classes. Route-family adoption still lives below.
- [x] Entity/PageTitleStrip primitive: `src/ui/EntityTitleStrip.tsx` exists as a standalone
      title surface, not `PanelHeader`.
      Current adoption covers protocol TVL/Treasury/Active Loans/Forks, CEX
      assets/stablecoins, chain overview empty/title shell, bridge protocol overview,
      and LiquidationsV2 summary. Defer unlocks/governance/LST until their
      metadata/action slots are audited.
- [x] Tab (TabLink + track; underline nav)
- [x] Switch (40×24 brand track — Figma 6298:54913)
- [x] Checkbox — Figma 6183:293491/6183:293514 was larger, but owner review
      reconciled the app primitive and popover multi-select box to a compact 14×14
      indicator: unchecked `border-strong`, checked `bg-brand border-brand` with a
      white check.
- [x] Input — `src/ui/Input.tsx` + `inputStyles` matches Figma Text Input
      6183:293480/6183:354516: min-h-8, bg-page, border-medium, 8px radius,
      body-sm placeholder/text tiers, 16px leading-icon slot. Adopted in Metrics,
      SelectWithCombobox, OtherLinks, Chain/Protocol/Token chart metric search,
      TableWithSearch, Correlations token picker, Downloads catalog/docs/schema,
      Tools page, Equities filters, and AddToDashboardModal. Re-grep evidence:
      exact old `bg-(--bg-input) p-1.5 pl-7 ... placeholder:text-[#666]` copies
      remain only in excluded/separate sweep surfaces (Yields, ProDashboard,
      LlamaAI, Articles, Bridges Transactions). Live verification on localhost:3000:
      `/tools`, `/downloads`, and `/banks` rendered page/table inputs at 32px high,
      8px radius, 1px medium border, `bg-page`, 32px leading-icon padding, and
      12px/16px text; `/correlation` picker input was not live-reachable because
      the token-picker disclosure did not render in the current page state.
      Re-verified `/metrics` after the radius pass: metrics search is 32px high,
      8px radius, default 1px border-medium, focus 1px border-brand, 32px
      leading-icon padding, and 12px/16px text.
      2026-07-07 placeholder audit: global Search desktop/mobile, MultiSelectCombobox,
      FilterBetweenRange, RaisesSearch, and 28 public table/search inputs now use
      `inputStyles`; paired search icons moved to left-3 with 32px leading padding.
      Live probe measured `/top-protocols` global search + table search and
      `/protocol/uniswap` chart metrics search at 32px height, 8px radius,
      12px/16px text, 32px left padding, and icon centerDeltaY 0.
- [ ] SegmentedControl — recipe shipped inside TagGroup/ChartGroupingSelector variant maps;
      extract into ui and collapse those two components into it
- [x] Panel (src/ui/Panel.tsx: Panel + PanelHeader + PanelTitle per 6183:148797 — shell
      bg-surface/border-subtle/8px radius, header px-4 py-3 heading-xs + 32px controls
      6px dense header-control gap, very-subtle divider). Keep this for true titled
      chart/table panels only; do not use it for title strips or inline chart toolbars.
- [x] ChartPanelToolbar / ChartPanelControlGroup recipes: `src/ui/Toolbar.tsx` exports
      inline chart/table toolbar helpers (`px-2 pt-2 pb-0`, controls 32px, dense adjacent
      controls gap 6px, larger groups gap 8px, no DOM chart-body padding). Adoption remains
      in the composite/route-family items below.
- [x] Select trigger md size — `size="md"` on Select/SelectWithCombobox mirrors Button md
      (min-h-8 px-3 py-1.5 8px radius) so "N Token ▾" lines up with .csv/.png in panel headers
      2026-07-07 follow-up: md trigger variants now use explicit `rounded-[8px]` instead of
      `rounded-lg`, matching the primitive radius rule.
- [x] MetricChip (src/ui/MetricChip.tsx per 6183:312062: rounded-full, 32px, label-sm
      text-primary — WHITE not link-blue, 2px gap to 16px ×, series-color border inline);
      adopted in Chain/Protocol chart panels. `metricOptionChipStyles` now covers the
      24px full-radius chart-dialog option pills so Chain/Protocol cannot drift.
      Live `/protocol/uniswap` probe measured active TVL option at 24px high,
      full radius, brand border, brand-muted bg, px-2, 12px/16px label-sm; inactive
      USD Inflows option matched 24px/full radius with medium border.
- [ ] MetricChip adoption: Chain/Protocol done; RWA Perps Contract and Token Overview
      option chips use the shared `metricOptionChipStyles` in the working tree. DAT and
      any remaining route-local selected metric chips still need audit/live verification.
- [x] PopoverSurface v2 — source recipe shipped in `src/ui/Popover.ts` and shared
      consumers (`Select`, `SelectWithCombobox`, `MultiSelectCombobox`, `Menu`,
      `NestedMenu`, plus in-scope direct default popovers) moved to the paddingless
      contract:
      surface owns bg/border/radius/overflow only; search blocks, action rows, footers,
      and list rows own vertical spacing; multi-select rows always use compact 14px
      checkboxes, filled blue when selected and empty `border-strong` when unselected;
      single-select rows use check-only with no empty box/circle.
      Mobile drawers keep fixed-bottom placement on the Ariakit wrapper and keep the
      slide transform on the drawer surface; do not add `transform-none` to animated
      drawer surfaces. Shared drawers portal to body by default (`portal={false}` is the
      explicit opt-out) so mobile fixed-bottom placement is viewport-based, not
      page-section based.
      Owner browser verification covered the shared default select, combobox, menu,
      nested menu, mobile drawer, and direct popover cases touched by the popover branch.
      2026-07-07 follow-up: Equities numeric operator select now uses shared popover surface/
      row/check recipes; Equities categorical filter combobox overrides no longer add a
      popover shadow. CEX DateFilter, bridge protocol selectors, mobile nav/settings,
      token usage, raises search, compare menu, and export/embed direct popovers moved
      to the shared fixed-wrapper/portal rule in the working tree. Remaining direct
      copies are mainly older bespoke or excluded surfaces such as Yields search/saved
      filters, app/global search special cases, Downloads/Admin/Editor, ProDashboard,
      and LlamaAI.
- [ ] DialogShell adoption — `src/ui/Dialog.tsx` has `dialogSurfaceStyles` +
      `DialogHeading`; AddToDashboardModal, Chain/Protocol chart metric dialogs,
      ProtocolRankings CustomColumnModal, RWA Perps Contract dialogs, and Token
      Overview metric dialogs use the shared surface. Remaining direct/legacy
      examples include ProtocolOverview Flag and MCP command dialogs plus mobile/
      route-specific menus; verify before deleting the legacy `dialog` utility.
      Owner decision 2026-07-08: mobile dialogs should be bottom sheets, not centered
      modals. Add to Dashboard uses the dialog recipe, not the popover drawer recipe,
      so bottom anchoring, smooth slide-up/down animation, close-button chrome, footer
      sizing, and breakpoint behavior should happen in a focused DialogShell pass.
- [x] IconHitTarget / TableIconHitTarget helper exists in `src/ui/IconHitTarget.tsx` for
      visual 16px icons with `p-1 -m-1` hit area.
- [ ] IconHitTarget adoption — first targets: protocol rankings bookmark/accordion/
      question-helper icons, then protocol card header link/bookmark icons and chain
      stat-card icon actions. Do call-site adoption instead of changing `Bookmark` or
      `QuestionHelper` globally in one pass.
- [ ] Icon-button hover treatment (radius-full ghost) for table pins, dialog ×, theme switch
- [x] Status/Empty/Error text shell recipe exists in `src/ui/Status.tsx`; protocol TVL,
      Treasury, Active Loans, Forks, and protocol Stablecoins loading/empty/error panel
      states use `PanelStatus` / `PanelLoadingStatus` with text semantics and
      `role="status"`/`role="alert"` where appropriate. CEX assets/stablecoins loading
      and empty states also use the shared status primitives.
- [ ] Status/Empty/Error adoption — chart-body states outside a standalone `Panel`
      (stablecoins, adapter metrics, RWA, downloads, token private sections) need a
      separate chart/body status helper or route-specific migration.

## Composites

- [ ] ChartToolbar / ChartPanelToolbar composite (Add Metrics + chips + denomination +
      grouping + embed/csv/png/dashboard slots). Chain/Protocol, Token Overview,
      RWA overview/perps, LiquidationsV2, bridge chart shells, DAT Company, and Token
      Usage are using shared toolbar pieces in the working tree; CEX chart shells use
      `Panel`/`PanelHeader`. Keep unchecked until stablecoins, adapter/markets, LST,
      remaining token/DAT variants, and live verification are complete.
- [ ] Popover/menu composite verification — after the v2 source pass, verify `/`,
      `/top-protocols`, `/calendar`, `/bridges`, `/protocol/uniswap`, `/protocol/tvl/uniswap`,
      global search, and a mobile drawer. Remaining direct/direct-Ariakit contexts to
      verify include chart PNG export menus, CEX DateFilter (now on shared surface/Input/
      Button but still direct), protocol overview switcher tree rows, mobile nav settings,
      Unlocks upcoming-event calendar menu and directory search panel. Downloads SQL/
      internal tools are excluded/deferred with the Downloads surface. `FilterBetweenRange`
      and CEX DateFilter still need live containment verification.
- [ ] TableToolbar / TableWithSearch reconciliation — `TableWithSearch` now uses the
      `Card border="subtle"` shell plus `TableToolbar`, and its built-in Columns/.csv
      controls use md/32px sizing. `ProtocolRankings` toolbar also moved to
      `TableToolbar` with md tinted segmented TagGroups, Columns, TVL Range, and .csv
      controls. Keep unchecked until `RecentProtocolsTable`, `ChainsByCategory`,
      stablecoin/bridge/RWA/token/liquidation table wrappers, custom filter controls,
      remaining toolbar-vs-scope joined-toggle call sites, and live verification are done.
      2026-07-07 follow-up: `PaginatedTable` now has `shell="none"` for embedded uses so
      Equities, Token markets/risks, and RWA asset detail tables can avoid nested bordered
      shells while standalone paginated tables keep their built-in shell. Equities list,
      filings, onchain, financials, Hacks, AdapterMetrics, and Stablecoins/Hacks filter
      bands moved toward shared Panel/Card/TableToolbar shells. Still verify nested table
      behavior on token, RWA, and equities detail pages.
- [x] Panel shells adopted across protocol tab routes (tvl, treasury, fees, dexs, options,
      perps, perps-agg, dex-agg, bridge-agg, active-loans, forks, bridges, stablecoins) +
      Unlocks EmissionsByProtocol + GovernanceProject. True titled panels use
      `PanelHeader` (`px-4 py-3`, very-subtle divider); inline chart controls use
      `ChartPanelToolbar` (`px-2 pt-2 pb-0`) with 32px controls. Token-rights
      shell/spacing/typography are in scope, while green/warning pill/card output
      remains guarded. Excluded: yields tabs and investor relations dashboard surfaces;
      raises/investor list-like pages are in scope unless separately quarantined.
- [ ] Panel/Card route-family migration still pending outside protocol tab panels:
      stablecoins, bridges, token, RWA, LST, liquidations, DAT, adapter/markets, MCP,
      borrow, and any remaining CEX markets/date-filter details still have local shells,
      direct popover/table pieces, or `--cards-*` surfaces that should move to `Panel`,
      `Card`, title-strip, or a narrow route-family wrapper. CEX assets/stablecoins
      title/status/metric-summary and chart panel shells are migrated in the working tree;
      CEX markets/date-filter still need live visual verification before being considered
      done.
      2026-07-07 follow-up: Bridges overview/protocol summary cards, bridge chart/table
      switches, `/bridges/chains` chart select sizing, Equities ticker/list/filings/onchain/
      financial shells, AdapterMetrics chart/table shells, Hacks chart/table shells,
      TokenOverviewHeader, and MarketMakers drawer chrome were migrated further. Keep this
      unchecked: Bridge Transactions, MarketMakers documentation internals, Equities
      financial table cell internals, adapter metric row details, token/DAT/LST/borrow/MCP,
      the hard-rolled `/protocol/bridges/[protocol]` wrapper (`p-4 gap-10` around a full
      bridge overview layout), and live browser verification remain.
- [x] Income statement bands (both: table header + Income Flow Visualization) → TagGroup
      tinted segmented at min-h-8; period select → filter md; titles → heading-xs; legacy
      form-control/link-hover tokens removed (verified live on /protocol/lido: all 32px)
- [ ] Income statement table header/cells still on legacy tokens (6183:313202 traversal
      pending)

## Known bugs / review findings

- [x] Chrome dual-tone focus ring → single 2px brand ring
- [x] Pills row: 2px second-row sliver + height layout shift
- [x] 10px control text too small → 12px floor; card data rows 14px
- [x] Chart-adjacent summary cards: headline metrics use stablecoins-style
      `text-(--text-label)` labels and `font-jetbrains text-2xl font-semibold`
      values; secondary metric rows stay compact row content and should not be
      promoted to headline sizing.
- [x] Done/Save buttons oversized vs neighbors → md Button everywhere
- [x] Icon-only buttons rendered thin → aspect-square
- [x] Segmented controls rendered solid-blue (wrong recipe) → tinted per Figma Tabs
- [x] Protocol tab nav: hand-rolled, wrong colors → ui/Tab (24 sites, 12 files)
- [x] Tab underline caused vertical scrollbar in overflow-x-auto tracks (-bottom-px → bottom-0)
- [x] "N Token ▾" select trigger taller than .csv/.png buttons (py-1.5 → py-1)
- [x] "Include own tokens" switch was a gray blob → Switch to spec
- [x] Protocol chart pills: 28px rounded-full old-blue → MetricChip recipe inline
- [x] Protocol info Website/GitHub/Twitter/Category/Create-comparison/View-all-Yields:
      blue pills → neutral md secondary buttons (Figma 6183:312146: no blue, text-primary)
- [ ] Comparison-dashboard dialog interiors (SubscribeProModal contents) still unported.
      AddToDashboardModal shell/interior was ported to Dialog + Input + Button
      primitives on this branch; verify live before checking the broader dialog item off
- [ ] Pre-existing (non-theme) bugs found while sweeping: ProtocolChartPanel metric-chip
      loading spinner hydrates differently than SSR (`loadingChartSet` is client-only state
      → dev-overlay hydration error on /protocol/:name); /unlocks countdown Date.now()
      hydration mismatch
- [x] Icon-only buttons stretched to rectangle by flex rows (aspect-square defeated by
      align-items:stretch) → self-center + items-center rows; verified 24×24
- [x] Category/Website/GitHub/Twitter/Safe-Harbor buttons: 16px icons + trailing
      arrow-up-right per 6183:312153; Category label label-md tertiary
- [ ] Protocol page: audit remaining links (competitor links, "Report incorrect data",
      methodology links) vs frames — link-blue only where Figma uses Text/links
- [x] Chain/Protocol chart toolbar control heights unified at 32px (md) —
      chips, Add Metrics, segmented groups, icon buttons, .csv/.png all measure 32 live.
- [ ] Chart/table toolbar gap verification — current rule is 6px inside dense adjacent
      control clusters and 8px between larger groups / for toolbar padding. Whole-shell
      lazy chart reservations that previously used 398px should now use 406px for the
      32px toolbar; inner chart-only reservations remain 360px. Apply through shared
      recipes, then verify Chain, Protocol, stablecoins, bridges, DAT, RWA, token, and
      table toolbars.
- [ ] Chart PANEL headers outside protocol tabs: remaining text-lg/text-base font-semibold
      sites per audit (protocol tab routes + unlocks + governance now done)

- [x] .png export button was link-blue outline while .csv neutral → both secondary md
      (Figma 148797: all panel-header buttons border-medium + text-primary); export
      dropdown menu → popover surface recipe; KeyMetricsPngExport ported off legacy tokens
- [x] Stats-card action row per 6183:311970 — gap-4 (16px) between actions, website link +
      Bookmark now 20×20 rounded-full p-0.5 ghost icon buttons (Bookmark merges className)
- [x] Audits label in protocol info → label-md text-tertiary, same as Category label
- [ ] Sub Category / other info-row labels: audit for same tertiary-label treatment

- [x] "More space below than above" in buttons (owner report) — root cause was NOT glyph
      centering (pixel-scan proved ink centroids within 0.4px) but FRACTIONAL LINE HEIGHTS:
      band ratios (label 1.2 → 12px×1.2 = 14.4px) made text-only controls render at 32.4px
      next to 34px icon-bearing siblings. Fixed: type ramp now uses Figma per-style integer
      line heights as exact fractions (Label 10/12, 12/16, 14/17; Heading 18/22; Body 12/16,
      14/21; others interpolated + marked TODO-verify). Button sm py 1→0.5 (16px line +
      floor = exactly 24); segmented containers all floor at min-h-8; verified live:
      Website/Yes/Category all 34, toolbar all 32, sm all 24, pills row exactly 32
- [x] Inter var @font-face: ascent/descent/line-gap overrides to hhea metrics (0.969/0.242)
      — normalizes fallback (CLS) and baseline math; visually ~0.14px shift only
- [ ] Verify remaining TODO line heights in Figma: heading-lg/sm, label-xl/lg, body-xl/lg/xs,
      all mono-\* (guessed integers shipped)
- [x] Loader/error cards on protocol tab pages → Panel (9 sites: tvl/treasury/active-loans/
      forks/stablecoins; layout classes col-span/flex-1/min-h preserved); leftover
      rounded-md recipe shells corrected to rounded-lg (bridges, treasury band, tvl name row)

## Page sweeps (each = traverse full frame + fix + verify both modes)

- [ ] Home/chain (PR 4 scope): reconcile to the resolved page rhythm. Top controls
      keep 12px horizontal gap; major vertical stack uses 8px; metrics browse toolbar
      has its dedicated dashed selected pill; RowLinks keeps 12px text; stat cards use
      dense 8px padding and 14px data rows; Llama app links gap is 8px; table toolbar
      uses 32px controls with 6px dense gaps / 8px group gaps; table icons use
      hit-target helper. Also audit table chrome (band/header/sort indicator text-link/
      row hover), Nav premium gold, Announcement → card recipe, and chart chrome debt
      without touching chart series colors.
- [ ] Metrics directory (6183:354500/6183:354640): top filter card 8px radius,
      p-3, gap-3; header row gap-3; scope switch 6183:354649 is a joined
      border-subtle 6px-radius wrapper, Figma 26px/10px text but code uses the
      12px text floor + `TagGroup size="sm"` 24px reconciliation; category pills
      6183:354658 are 24px full-radius brand-outline `Button filter` pills with
      px-2 and label-sm. Card grid is 8px both directions; category heading-to-grid
      gap is 12px; category-to-category rhythm is 22px. Cards + hover done in tokens;
      page layout/Card primitive adoption and live verification still pending.
      Live `/metrics` probe after earlier pass measured shell 8px radius, p-3, gap-3;
      joined switch 24px high, 6px radius, 1px subtle border, 12px/16px text;
      `Trending` category pill 24px high, full radius, 1px brand border, px-2,
      12px/16px label-sm.
- [ ] Global search overlay: result row text uses 14px, result type tags use 12px.
      Verify desktop and mobile popovers for row height, hover/focus full-width state,
      recent-clock alignment, scrollbar overlap, and no result/tag text collision.
- [ ] Protocol/CEX/bridge/chain/liquidations title strips: current adopters use
      `EntityTitleStrip` with 8px padding, 28px logo where present, 12px media/title
      gap, 20px title, and right-action slot where needed. Keep unchecked until live
      verification covers each adopted route; unlocks/governance/LST need separate
      slot checks before reuse.
- [ ] Protocol overview: migrate summary/key-metrics dense card, overview chart-card
      toolbar, and IncomeStatement table/panel shell to `Card`, chart toolbar recipes,
      or `Panel` as appropriate. AdditionalInfo detail cards now use `Card padding="sm"`
      with `border="subtle"`, the Figma `6183:312146/312158/312167` 12px internal stack,
      `heading-xs`, `body-md` content, tertiary no-colon metadata labels, and neutral
      md action buttons; they still need live verification. Stablecoin asset information
      and token/unlocks/RWA notes-prose cards now follow the same detail-card padding/gap/
      typography rule. Do not force the main
      chart toolbar into `PanelHeader`.
- [ ] Shared popover/select/menu controls: finish adoption and live verification of the
      paddingless wrapper, search-block-owned padding, normal-flow Select/Deselect action
      row, no bordered Add Custom Column footer, compact multi-select checkbox boxes in
      both selected and unselected states, and single-select check-only state with no
      unselected indicator. Verify regular Select, SelectWithCombobox with search,
      no-search select, menu, mobile drawer, and excluded legacy variant.
- [ ] Structural status/empty/error shells: refine the committed `<p>`→`div` cleanup.
      Data-card wrappers stay `div`; empty/error/status shells get inner text and
      `role="status"`/`role="alert"` where appropriate. Verify no default paragraph
      margins or visual shifts.

## Page-by-page Figma audit ledger

Use this as the route-level queue. Each row must be expanded with extracted child-node
measurements before code changes are made against that frame.

- [ ] Home / chain overview: 6183:292119, 6183:292798, 6183:291236, 6183:291265
      (RowLinksWithDropdown buttons/chart filter card), 6183:291322.
- [ ] Metrics directory: 6183:354500, 6183:354640, 6183:354581, 6183:354721,
      6183:354509, 6183:354516, 6183:354517, 6183:354650, 6183:354658.
      Extracted so far: filter shell 6183:354646 = bg-surface, border-subtle,
      8px radius, p-3, gap-3; scope switch 6183:354649 = border-subtle,
      rounded-md/6px, overflow clipped, solid selected segment; category pill
      6183:354658 = 24px full-radius brand-outline, 8px x-padding, 2px content gap.
      Live note: code renders 4px content gap because Button's shared icon/text
      gap is still `gap-1`; revisit only if a metrics category pill gains an icon.
- [ ] Protocol overview: 6183:312589, 6183:311951, 6183:312062, 6183:311970,
      6183:312186, 6183:312153, 6183:312146, 6183:312158, 6183:313202, 6183:355440,
      6183:355439.
- [ ] Protocol TVL: 6183:153039, 6183:148773, 6183:148797, 6183:148781.
- [ ] Unlocks: 6298:54868, 6183:355432, 6298:54913, 6291:39137, 6298:39363,
      6298:39347, 6291:39042, 6291:39214.
      Extracted so far: allocation/event sections are titled panels with `PanelHeader`
      (`px-4 py-3`, 8px shell radius) and compact 12px padded slots; allocation rows use
      label-md phase labels, body-md row labels, mono-md percentages, and 6px bars.
      Event cards are the only current 12px Card-radius exception (`Card radius="large"`),
      with 16px padding, 10px internal rhythm, body-md primary lines, body-sm secondary
      lines, a compact countdown pill, a subtle divider, and the existing countdown/
      calendar behavior preserved.
- [ ] Token rights: 6476:32931, 6476:34845. Keep green pills/warnings visually
      identical while moving token names only.
- [ ] Shared popover/search/select/check controls: 6183:293478, 6183:293504,
      6183:293491, 6183:293514, 6183:293480, 6183:293485. Current target:
      paddingless surface, row-owned vertical spacing, compact multi-select
      checkbox boxes in both states, check-only single-select state, normal-flow
      Select/Deselect rows.
- [ ] Protocol overview + in-scope subpages (tvl/treasury/unlocks/fees/token-rights shell-only…):
      remaining --cards-\* shells outside ProtocolOverview dir, stats card p-8,
      key-metrics chevron rows (h-20/28 pitch), "Report incorrect data" pinned row.
      Yields visual surfaces are excluded.
- [ ] Stablecoins, Bridges, CEX, LST, DAT, Token pages: shells + toolbars via composites
- [ ] Unlocks (Panel + detail cards 16px type + countdown chips + calendar)
- [ ] Token rights (keep green pills/warnings visually identical, new tokens)
- [ ] Toasts / skeletons / empty states (judgment recipes agreed)
- [ ] Final: `lint:tokens --update`, both-modes browser pass, light-mode regression check

## Audit results — 2026-07-06, four parallel agents (full reports in PR discussion)

Typography (in scope, excludes quarantined surfaces):

- 707 arbitrary `text-[Npx]` — 501×10px, 365×11px→(includes out-of-scope), 109×13px, 66×12px, 54× sub-10px on INTERACTIVE elements (a11y violation — fix first: RWA/Filters badge, Articles editor, Downloads SeriesChip)
- 473× `text-sm font-medium` → `label-md`; 157× `text-lg font-semibold` → `heading-xs` (the chart/panel header answer); 146× `text-base font-semibold` → panel subheads; 121× `text-xl font-semibold` → `heading-sm`
- Mapping table agreed: 13px→14, 11px→12, 15px→14, 22–28px→heading-sm/lg

Card/panel shells:

- 1,129 legacy `--cards-*` occurrences in 287 files. Protocol subpage totals: Token 118, Unlocks 58, DAT 56, Bridges 36, TokenRights 36, Stablecoins 28, Raises 22, protocol/\*/[protocol].tsx routes 52. Articles/editor is the single biggest hotspot (80+).
- 3 distinct hand-rolled chart-header patterns across ~40 files → converge on the Panel recipe (header px-4 py-3, heading-xs, md buttons, very-subtle divider)
- 44 files with hardcoded hex backgrounds; 18 in-scope `className="dialog"` sites → DialogShell

Legacy tokens:

- 337+ remaining var usages in scope; `--link-hover-bg` alone = 257 across 40+ files (mostly Downloads/IncomeStatement/QueryTabBar). Mechanical map confirmed; judgment only for --success/--error (feedback-only) and hover-row vs brand-muted context.
- Tier-1 batch targets: MultiSelect/ReactSelect, Downloads modals, Table.tsx; defer LiquidationsDistributionChart (5-var state machine).

Duplication (est. 900–1,200 deletable lines):

- ChartToolbar composite: original audit found 4 near-copies (~490 lines) across
  Chain/Protocol panels + Token/RWA-Perps. Several are now on shared toolbar pieces;
  re-grep before changing remaining route families.
- MetricChip 12+ sites; DialogShell 32+ dialogs; SearchInput 5+; EmptyState 15+;
  SectionHeader 12+; TooltipLabel 25+; ChartLoadingState 8+. Treat these as historical
  starting counts and confirm current matches before editing.
- ChartExportButtons exists but 48+ sites still compose csv/png manually — adopt it
- Dead-code candidates to confirm: LoadingSkeleton (1 ref), NotFoundPage (1), ImageWithFallback (2)
- Checkbox sizing is reconciled at 14×14 for the standalone primitive and popover
  multi-select boxes; revisit only if remaining variants duplicate the same behavior.

## Audit results — 2026-07-07, subagents after placeholder report

- [x] Placeholder/input inconsistency cluster: exact old public table search class
      `border-(--form-control-border) bg-white p-1 pl-7 text-black dark:bg-black`
      removed from in-scope table/search fields; token-rights shell/spacing/typography
      are in scope, while green/warning pill/card output remains guarded.
- [ ] Select/menu surface stack: Select.tsx, SelectWithCombobox.tsx, Menu.tsx,
      NestedMenu.tsx, and MultiSelectCombobox now share the paddingless popover
      surface recipe (`rounded-xl` border-medium bg-surface-elevated-1, surface owns
      border/radius/overflow only). Regular popover rows use `px-3 py-2 body-sm`;
      nested-menu drawer rows use the dedicated `px-4 py-2.5 body-sm` recipe with a
      fixed right icon/check column. Multi-select rows use the compact 14px checkbox
      footprint for both states: filled blue when selected, empty `border-strong`
      when unselected. Single-select rows use a check-only state with no empty
      box/circle. Select/Deselect is a normal-flow two-column action bar with
      centered labels; reset/download footer actions are left-aligned rows.
      ProDashboard, Yields, and LlamaAI shared-component callers are explicitly
      pinned to `popoverVariant="legacy"` or `variant="pro"` so excluded surfaces do
      not change during this sweep. Live verification is still the gate before
      promoting the broader PopoverSurface item.
- [ ] Range/date popovers: `FilterBetweenRange` and CEX DateFilter now use Input/Button
      plus shared popover surface recipes in the working tree, but still need live
      verification. Clear/Apply footer rows must not horizontally overflow the popover;
      button sizing should be contained by the row across TVL Range, available-range,
      and CEX date filters.
- [ ] Dialog copies: Correlations token picker, Metrics modal, ProtocolOverview Flag,
      DeFiWatchlist, Yields IncludeExcludeTokens, RecentProtocols airdrop checker, and
      MCP dialogs still use `className="dialog"` or duplicated dialog shells. Account/
      subscription, ProDashboard, LlamaAI, and editor/download dialogs remain excluded
      product surfaces unless separately scoped.
- [ ] Route panel shells: borrow, unlocks, token, stablecoins, bridges, MCP, and any
      remaining CEX market/detail shells still have old `--cards-*` or route-local shells
      that should move to Panel/Card in route-sized chunks. CEX assets/stablecoins
      title/status/metric-summary/chart shells are migrated in the working tree, but still
      need live visual verification. Token-rights top summary now uses the Layout metric
      browse row plus a Card `padding="strip"` inline stat strip; CEX stablecoin summaries
      use the same strip recipe. Continue keeping token-rights green/warning pill/card
      visuals stable.
- [ ] Chart/table tooltip chrome: smol line/bar/unlocks tooltips repeat
      `border-[#ccc] bg-white text-[#666] dark:*`; create a small tooltip recipe or
      reuse the popover surface tokens without touching chart series colors.
- [ ] Segmented controls: current decision is tinted segmented styling for chart/table
      toolbar metric/period/view controls and solid joined-toggle only for explicit
      scope switches. Read-only audit found likely toolbar migrations in BridgedTVL,
      LiquidationsV2 distribution, TokenUsage view mode, RWA overview/perps controls,
      and MarketMakers `ShowAsControl`; keep Metrics header, Bridges table subject
      switch, and Markets venue switch as scope/control exceptions. Downloads mode/
      SQL/chart controls are excluded/deferred with the Downloads surface.
- [ ] RWA filter/table rhythm: RWA Stablecoins/Governance/RWA-Perps filters use
      `Checkbox variant="filter"` rather than Switch, page-level inclusion rows left-align
      like `/rwa`, table search joins right-side toolbar controls, and filter/reset/docs
      triggers stay 32px with internal badges that do not increase height. Verify `/rwa`,
      `/rwa/chains`, `/rwa/categories`, `/rwa/asset-groups`, `/rwa/platforms`, and one
      RWA Perps route.
- [ ] Extra in-scope old-control cleanup from the 2026-07-07 subagent audit:
      Token/RWA chart option chips moved toward `metricOptionChipStyles`; DAT and any
      remaining route-local chart chips still need confirmation. Metrics directory inline
      metric pill → Button `filter`; Calendar, token-usage, Bridges ChartSelector/
      BridgeChainSelector, CompareTokens menu → `Popover`/`Input`/`Button` recipes;
      Bridges transaction form/search/pager → `Input`/`Button`/`selectTriggerStyles`;
      Exchanges venue control → joined-toggle styles; repeated failed-data chart overlays
      → shared `FailedDataPopover`.
      Static grep still has known touched-file exceptions (`Metrics`, `DeFiWatchlist`,
      `unlocks`, `ETF`, and quarantined surfaces); treat zero-grep claims as scoped to
      the file family being migrated, not as a repo-wide completion signal. Live route
      verification pending.

## Audit results — 2026-07-07 evening, four parallel agents

Counts below were captured during the evening audit and should be treated as a work
queue, not as a fresh ratchet baseline. Current merge scope excludes ProDashboard,
LlamaAI, yields, account/subscription, Downloads, Articles/research/authors/
newsletters/reports surfaces, and investor-relations dashboard products. Raises/
investor-like list pages remain in scope unless they are part of the investor-relations
dashboard product. Sheets scope is deferred until after this branch merges.

- [x] Ratchet regression fixed — `src/components/Metrics.tsx` now uses `gap-5.5`
      (= 22px from the spacing scale) instead of `gap-[22px]`. `lint:tokens` passes
      without a baseline update; the improved hex/font counts remain pending for the
      final reviewed baseline update.
- [x] `src/ui/Popover.ts`: collapsed the default search-block branch so
      `SelectWithCombobox` uses the documented full `p-3` inset instead of switching
      between duplicate exports.
- [x] `text-disabled` in-scope audit: after excluding yields, ProDashboard, LlamaAI,
      account/subscription, Downloads, articles/research, and investor dashboards, the
      remaining source match is the shared `pro` select disabled-state variant. No
      metadata/symbol misuse found in the Commit 2 route scope.
- [x] Commit 2 table/search source pass: shared table search wrappers now distinguish
      left-owned search (`mr-auto`, shrink-safe) from inline right-control search
      (`min-w-0`, 280px desktop width), and the RWA, Equities, Stablecoin usage, Token
      markets, and `TableWithSearch` call sites use the shared wrapper instead of local
      search-width clones. Equities financial controls use the 6px dense table-toolbar gap.
- [x] Commit 2 home/chain source pass: top desktop controls are already on the documented
      12px `gap-3` exception in `Layout`, while the chain page stack remains on the 8px
      `gap-2` rhythm. No chart option/series/grid code changed in this pass.
- [x] Commit 3 table composite checkpoint: RWA assets and Equities rankings/financials
      now use `TableToolbarControlGroup` for right-side dense toolbar clusters whose
      local class strings already matched the shared contract. More complex responsive
      table bands remain pending until they can be migrated without changing behavior.
- [x] Panel `className` contract violations: added explicit `Panel padding="sm|md"`
      variants and moved the 10 audited `p-2`/`p-4` shell overrides (protocol chart
      pages, Forks ×2, DAT/ByAsset) onto the primitive prop.
- [x] Card contract violations (3): added `Card interactive` for focus/hover chrome,
      moved directory tile type to the label text, and moved ExtraTvl/RWA Perps typography
      onto content wrappers instead of the Card shell.
- [x] Raw `-(--ld-*)` arbitrary values with registered equivalents (6): added small
      semantic utilities for border/background divider fills and screen dim overlays,
      then replaced the audited Metrics, ProtocolOverview, Unlocks, and MarketMakers
      class usages. Inline gradient/chart variable usages remain explicit.
- [ ] Select default-sm in md contexts: `LST/index.tsx` chart-controls selects (280/318)
      must be `size="md"`; sweep remaining ~14 default-sm sites (DeFiWatchlist, Raises,
      CompareChains, Unlocks/Table, layout) and set size explicitly per context.
- [x] a11y sub-12px interactive (in-scope): listed Nav pinned-page controls/helper text
      and small Buy on LlamaSwap triggers now use 12px `label-sm`/`body-sm` utilities.
      Sheets remains deferred.
- [x] buttonStyles→Button where a plain `<button>` is rendered: `Bridges/Transactions.tsx`
      submit/pager buttons now use `Button`; `CSVDownloadButton` uses `Button` for the
      normal styled path while preserving its explicit `replaceClassName` escape hatch.
- [ ] Segmented control has four public entry points (TagGroup 37 uses,
      ChartGroupingSelector 25, chartSegmentedControl\* strings 22 in 17 files, raw
      TAG_GROUP_VARIANTS in raises/investors + Markets/ExchangesTable +
      Bridges/TableSwitch) — all resolve to TAG_GROUP_VARIANTS in Select/types.ts.
      For merge, only fix visible drift or direct duplication that blocks route
      stabilization; extracting a new `src/ui/SegmentedControl` is deferred unless a
      focused route-family change proves it is necessary.
- [ ] Radius decision: no `--radius-*` override exists, so `rounded-lg` already = 8px
      (0.5rem) in Tailwind v4 — design.md's "no live 8px guarantee" claim is only true
      in the rem-vs-px sense. The current branch should keep exact primitive classes and
      avoid a global radius codemod. Revisit `--radius-lg: 8px` / `--radius-xl: 12px`
      after this branch merges.
- [ ] Legacy debt snapshot from the audit, requiring a fresh scope filter before edits:
      `--cards-*` 255 (TokenPnl 18, DeFiWatchlist 15, MCP 13, Nft/Collection 10,
      newsletters 10, support 10, unlocks page 10, ChainsByCategory 8);
      legacy `--text-*` 249 (MCP 34, DeFiWatchlist 33, newsletters 21, Unlocks
      UpcomingEvent 18, TokenPnl 11); `--link-hover-bg` 57 (DeFiWatchlist 10,
      NarrativeTracker 6, IncomeStatement 6, Unlocks/CalendarView 6, Correlations 5);
      btn/input/misc vars 139 (MCP 26, Popover.ts compat 21, DeFiWatchlist 9);
      hex-in-className 368 (Sheets 65 — DEFER until after merge,
      LlamaAIFloatingButton 37 — borderline LlamaAI, reports.tsx 28 — likely
      research-excluded, EntityQuestionsStrip 29, ChainOverview/Announcement 22,
      MCP 17); arbitrary font sizes 109 (Sheets 20, MCP 17).
- [ ] `dialog` @utility consumers in scope: ~9 files (Search, Metrics,
      EntityQuestionsStrip, MCP, ProtocolOverview/Flag, ProtocolLists/RecentProtocols,
      DeFiWatchlist, Correlations, TopupModal-borderline). Port to Dialog primitives,
      then delete the utility.
- [ ] Ariakit.Dialog sites not on dialogSurfaceStyles (~11 in scope): Search, Metrics,
      Nav/Mobile/Menu, Correlations, DeFiWatchlist, MCP, MarketMakers/Drawer,
      ProtocolLists/RecentProtocols, ProtocolOverview/Flag, EntityQuestionsStrip,
      sheets/auth (Sheets deferred).
- [ ] Status-shell adoption: only 13 files use PanelStatus/PanelLoadingStatus; ~57
      in-scope files hand-roll `min-h-[360px]` shells (many are legit lazy-chart
      reservations — separate the status shells from reservations when sweeping;
      clusters: pages/protocol/\* (10), RWA (7), DAT (3), Token (3)). A non-Panel
      chart-body status variant is needed for embedded contexts.
- [ ] Manual csv/png export compositions → ChartExportButtons (7 files: RWA/index,
      ECharts/BarChart, Token/TokenUsageSection, ChainChartPanel, ProtocolChartPanel,
      IncomeStatement, pages/token-usage). ChartExportButtons already has 46 sites.
- [ ] Segmented selected-state copies outside TagGroup/types (in-scope):
      BuyOnLlamaswap, Search, LinksWithDropdown, MultiSelectCombobox,
      AddToDashboardModal, RWA Filters/Asset, Bridges/Transactions, MarketMakers ×2,
      Equities dialog, pages/borrow.
- [ ] `text-sm font-medium` → label-md long tail (in-scope portion of 221/117 files;
      top: Governance 7, Unlocks/EmissionsByProtocol 5, cex/stablecoins 4, MCP 4);
      heading normalization `text-xl font-semibold`→heading-sm (RWA/Asset 6,
      MarketMakers/Podium 2, TokenPnl 2, newsletters 2), `text-lg font-semibold`→
      heading-xs, `text-base font-semibold`→panel subheads (TokensWatchlist 2).
      Redundant `leading-[21px]` (= body-md) deletions. Do not run as a broad codemod
      before merge; fix only route-family drifts where the surrounding context has been
      reviewed.
- [ ] Dead code: LoadingSkeleton.tsx only imported by ProDashboard (excluded) — delete
      when ProDashboard drops it; ImageWithFallback has 2 importers (1 in scope).
- [x] Excluded-surface prop-pin verification: recent commits touched excluded files
      only to thread `size`/`popoverVariant="legacy"` compat props — guard held.
- [x] Popover legacy exports leak check: every legacy*/excludedSurface* activation
      traces to excluded surfaces only. Clean.

## Review gates before final cleanup

- [ ] Excluded-surface guard (owner decision 2026-07-07, reconciled for merge):
      ProDashboard, LlamaAI, yields, account/subscription, Downloads (incl. SQL/notebook
      tooling), Articles/research/authors/newsletters/reports surfaces, and investor-
      relations dashboard surfaces (`containers/Investors` / `pages/investors` dashboard
      products) are excluded from the theme sweep — they are separate products or upcoming
      rewrites. Token-rights green/warning visual output stays pixel-identical. Raises/
      investor-like list pages remain in scope unless they are part of the investor-
      relations dashboard product. Shared components these surfaces consume still
      migrate; pin them via `popoverVariant="legacy"` / `variant="pro"` style compat
      props, not by forking styles into page files.
- [ ] Chart visual guard: no `CHART_COLORS`, `getNDistinctColors`, series color arrays,
      or ECharts option objects changed as a side effect of shell/toolbar cleanup.
- [ ] Token/style guard: no new page-level color/spacing classes where a primitive or
      recipe exists; no new `--cards-*`, `--old-blue`, `--link-hover-bg`, hex colors,
      arbitrary font sizes, or arbitrary spacing in in-scope files.
- [ ] Semantic/status guard: empty/error/status shells have correct wrapper vs text
      semantics and no default paragraph-margin regressions.
- [ ] Duplicate-shell guard: repeated local `rounded/border/bg/p-*` shells are either
      migrated to a primitive/composite or explicitly documented as route-specific.
- [ ] Live route guard: verify representative desktop/mobile, light/dark routes:
      `/`, `/chain/ethereum`, `/metrics`, `/tools`, `/protocol/uniswap`,
      `/protocol/tvl/uniswap`, `/cex/assets/binance`, `/stablecoins`, `/bridges`,
      `/rwa`, `/liquidations`, `/mcp`.

## Open design asks (also in design.md)

- Light Text/Warning; dark bg-brand-transparent-subtle; hover-step token for pills;
  rebind chevron icons off SDS leak; publish primitive ramps; Inter Display decision;
  gutter 12 vs 16; future ECharts grid-inset visual decision after screenshots.
