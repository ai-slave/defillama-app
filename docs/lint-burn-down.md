# Lint burn-down plan

Status as of 2026-09-06. Phase 0 is PR #3383. Every later phase starts from a fresh worktree off `main`
after the previous PR is merged. No stacked PRs.

## How the ratchet works

- `.oxlintrc.json` is the hand-written rule set. Rules that are deliberately off carry a comment saying
  why and what unblocks them.
- `.oxlintrc.baseline.counts.json` is the only committed generated file: violations per file per rule, one
  line per file, so fixing a file changes one line. `bun run lint:baseline` regenerates it. It is marked
  `linguist-generated`, so GitHub collapses it in diffs.
- `.oxlintrc.baseline.json` is derived from the counts by `bun scripts/lintBaseline.ts --emit`, which
  `bun run lint` and the pre-commit hook run first. It is gitignored. It turns each rule off in the files
  that violate it, so oxlint passes.
- `bun run lint:baseline:check` fails when the working tree has more violations than recorded for any
  rule/file (an override hides extra violations of the same rule in the same file), when a recorded entry
  is stale, or when the committed counts accept more debt than the same file on `origin/main`. CI passes
  `--base origin/main`. Regenerating the baseline can therefore only shrink it.
- Editors that auto-discover `.oxlintrc.json` show the full debt in the files being edited. That is
  intended.

Workflow for every fix PR: fix violations, run `bun run lint:baseline` to shrink the baseline, run
`bun run lint:baseline:check`, and state in the PR which behavior each pattern must preserve and how it
was checked. "Mechanical" is not a review category; each pattern below names its invariant.

## Baseline at creation

|                                     |       |
| ----------------------------------- | ----- |
| Rules with open violations          | 79    |
| Files with at least one suppression | 2724  |
| Violations                          | 19100 |

## Phase 1: autofix

One PR running `oxlint --fix` for the rules whose fixers are semantics-preserving, then regenerating the
baseline. Approximate counts from the Phase 0 measurement.

| Rule                                                                                                                                                     | Hits | Invariant to check                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typescript/array-type (`Array<T>`)                                                                                                                       | 7733 | Types only. Typecheck proves it.                                                                                                                                                                                                            |
| react/button-has-type                                                                                                                                    | 315  | Not fixable automatically in a safe way: a button inside a `<form>` without a type submits. Each hit is read: `type="submit"` where that was relied on, `type="button"` otherwise. Part of Phase 2 if the count of in-form buttons is high. |
| unicorn/explicit-length-check                                                                                                                            | 314  | `if (a.length)` becomes `a.length > 0`. Identical truthiness.                                                                                                                                                                               |
| react/function-component-definition                                                                                                                      | 249  | Arrow components become function declarations. Hoisting changes nothing because components are not called before definition. Check `displayName` and `forwardRef` wrappers by hand.                                                         |
| react/jsx-curly-brace-presence                                                                                                                           | 210  | String literal props and children lose braces. Watch for strings with `{`, `}`, or trailing whitespace the fixer must keep.                                                                                                                 |
| react/no-unescaped-entities                                                                                                                              | 183  | Fixer replaces quotes and apostrophes with entities. Rendered text is identical.                                                                                                                                                            |
| eslint/prefer-template, object-shorthand, no-else-return, no-lonely-if, no-useless-return, no-var, prefer-exponentiation-operator, prefer-object-has-own | ~200 | Syntax only.                                                                                                                                                                                                                                |
| typescript/consistent-type-imports, no-import-type-side-effects, no-inferrable-types, prefer-for-of                                                      | ~165 | Type-only imports must not be the only reference keeping a module's side effects. The `no-unassigned-import` hits in `_app` show which modules are imported for side effects; none are type-import candidates.                              |
| react/jsx-boolean-value, self-closing-comp, jsx-no-useless-fragment                                                                                      | 209  | JSX shape only. Fragments with a single child and a `key` are not removed by the fixer.                                                                                                                                                     |
| unicorn/numeric-separators-style, no-typeof-undefined, no-lonely-if, prefer-node-protocol, catch-error-name                                              | ~400 | Syntax only.                                                                                                                                                                                                                                |
| import/no-duplicates                                                                                                                                     | 18   | Merged imports keep every binding. Typecheck proves it.                                                                                                                                                                                     |

Review: read the diff for anything that is not one of the transformations above. Typecheck and the full
test suite run in CI.

### Suggestion-level fixers (Phase 2d)

`oxlint --fix-suggestions` applies fixes oxlint marks as behavior-changing. Run through a temporary config that
enables only the reviewed rules, it cleared 215 arrow components to function declarations, every inferrable
type annotation and 15 fragments. It also re-applied two fixes that Phase 1 had reverted by hand (the
`export {}` in `umami.d.ts` and the `reason` rename in token-page.test), so those two are re-fixed and the
renamed rejection handlers now use `caughtError`, which the rule accepts and which cannot shadow. Two rule
options changed instead of fixing code: `consistent-type-imports` allows `typeof import(...)` annotations (the
vitest `importOriginal` idiom) and `jsx-no-useless-fragment` allows `<>{expr}</>` (a component returning its
child).

### Fixer hazards found while running Phase 1

- `-D <rule>` on the CLI resets the rule's options to defaults. Running `array-type` that way converted
  to `T[]`. Drive single-rule fixes through a temporary config that extends `.oxlintrc.json`.
- `unicorn/prefer-set-has` rewrites the initializer to `new Set(...)` but not the array type annotation.
  Excluded from autofix; it is a Phase 2 manual fix.
- `unicorn/catch-error-name` also renames promise rejection handler parameters. A shorthand object key
  built from the parameter (`(reason) => ({ reason })`) changes meaning, and a renamed parameter can
  shadow an outer `error`. `no-shadow` caught 12 of these; the test suite caught the shorthand one.
- `typescript/no-useless-empty-export` removed the `export {}` that makes a `.d.ts` a module, which
  silently dropped its `declare global` block. The rule is now off for `**/*.d.ts`.
- `vitest/consistent-test-it` renames `it(...)` calls but not the `import { it } from 'vitest'`
  specifier. A follow-up script rewrote the imports; without it every test file would fail at runtime.
- `react/jsx-curly-brace-presence` can unwrap a string containing an apostrophe into an unescaped
  entity. One site; fixed with `&apos;`.
- tsgo keeps an incremental `tsconfig.vitest.tsbuildinfo`; delete it when a typecheck result looks
  stale after reverting a file.

## Phase 2: mechanical manual fixes, by directory

Each bucket has one right answer per site but needs a human to read the site.

| Rule                                                                 | Hits        | Fix and invariant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react/memo-dependencies                                              | 20          | Done in Phase 2a. Three real kinds: (1) an in-component alias of a module constant listed as a dep: use the constant directly, which also satisfies `exhaustive-deps`; (2) a `void x` "recompute trigger" the compiler cannot see, which means the compiled build would already skip the recompute: make `x` a real input (ProDashboard day boundary flows into `projectChartData`, MultiSeriesChart holds the probed legend icon set as state); (3) a callback referencing itself: named function expression or a function declaration inside the effect. **False positive**: every dep of an async callback containing `try/finally` is reported as unnecessary (verified with a fixture). Those five sites keep their deps behind an inline disable naming this cause. |
| react/immutability                                                   | 7 non-test  | 3 `let` counters mutated inside `.map` in JSX: build the row list with a `for` loop above the JSX, output order unchanged. 2 recursive `useCallback`s: named function expression. 2 in useChatScroll: one owner mutates the ref.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| react/purity                                                         | 2 non-test  | `Date.now()` in render. VaultRolesBlock already receives `nowIso`: require it. ApiUsageBreakdown: take `now` from `dataUpdatedAt` or `useState(() => Date.now())`. Snapshot the rendered window before and after.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| react/hooks                                                          | 1           | `dialogStore.useState('open')` becomes `Ariakit.useStoreState(dialogStore, 'open')`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| oxc/const-comparisons                                                | 1           | DeFiWatchlist/index.tsx:764 compares the same value on both sides. Read the intent, fix the condition, add a test for the branch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| oxc/no-map-spread                                                    | 128         | Decided in Phase 2c: rule off. Split by what the mapped array is: 41 React props or state, 14 test fixtures, 10 module constants and 2 state updaters, where the copy is required; the remaining 61 sit in server or data-fetch code, most over cached API responses that other callers also hold. Mutating those would be a real bug, and the win where it is safe is one allocation per row. "One pass per dataset" stays a review concern; `no-accumulating-spread` (quadratic) stays on and its 2 hits are fixed.                                                                                                                                                                                                                                                     |
| unicorn/no-array-reduce, no-array-for-each, typescript/prefer-for-of | 72 + 15     | Done in Phase 2c. `for...of`, with `.entries()` where the index is read. `return` inside a `forEach` callback becomes `continue`. A `forEach` callback did not count as a block for `max-depth`; the loop does, so one site needed early `continue`s. Two index loops the rule did not flag also used the index for writes and were converted with `.entries()`, which the test suite caught when the first attempt dropped the index.                                                                                                                                                                                                                                                                                                                                    |
| unicorn/prefer-set-has, prefer-array-find, prefer-array-some         | 29          | Done in Phase 2c. Module-constant arrays used only with `.includes` became `new Set<T>([...])` with `.has`; a `.has` argument typed `string \| undefined` needs `?? ''`. `filter(...)[0]` became `find`, `filter(...).pop()` and `.at(-1)` became `findLast`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| unicorn/consistent-function-scoping                                  | 63 non-test | Hoist to module scope only when the function captures nothing. If it reads a component variable the rule is wrong about it; check before moving.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| react/button-has-type                                                | 315         | Done in Phase 2b. Every typeless button sat outside a `<form>` (checked by scanning each file for an enclosing form; the only component named SubmitButton fires `onClick`), so all 324 got `type="button"`, which cannot change submit behavior. The `Link` wrapper keeps its dynamic `type={props.type ?? 'button'}` behind an inline disable; test mocks using `createElement` pass `{ type: 'button' }`.                                                                                                                                                                                                                                                                                                                                                              |
| eslint/no-empty                                                      | 64          | Done in Phase 2d. All 64 were `catch {}`; each now holds a one-line comment naming why the error is ignored (storage unavailable, clipboard denied, optional icon, best-effort attribution, prerender without paths). None swallowed an error a caller needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| eslint/max-depth (4), no-param-reassign, no-loop-func, radix         | ~120        | Phase 2d: `radix` adds `, 10` where the input is decimal digits, and splits one conditional radix into two literal calls. `no-param-reassign` renames the parameter and binds the normalized value to a `const`; the two buffer rotations in useChatExecutionOwner keep an inline disable. `no-loop-func` stays on; its 8 hits are deliberate captures (a cancellation flag, the scheduler counter, awaited test cases) and carry inline disables naming that. `max-depth` (91) moves to the next PR.                                                                                                                                                                                                                                                                     |

## Phase 3: React Compiler rules, by directory

Order: Articles, ProDashboard, Investors, Downloads, hooks, components, then LlamaAI as its own series.
Each PR covers one directory and lists the pattern used per site.

### Phase 3a: Articles (done)

58 sites, all four rules. Patterns used, in order of frequency:

- Prop copied into draft state (admin forms, caption editors, ArticleImageNodeView, SlashCommandList,
  ArticleMetaDialog): the "store previous prop" form during render. The compiler accepts it (verified
  with a fixture). ArticleMetaDialog keeps its exact triggers with two sync keys: schedule fields follow
  `goLiveAt`/`isScheduled` while open, row drafts restart only when the dialog opens.
- Derived state (ResearchSocialMediaMentions index clamp, editor preview article): computed during
  render; the state that remains is only what the user chose.
- State that is also memory (EntitySuggestionList highlight, RevisionHistoryDrawer base mode, both
  article pickers' titles): kept as state, with the reset or merge done during render when its input
  changes. Review of the first version caught three regressions from deriving these instead: a stale
  highlight came back when a filter cleared, a forced diff-base fallback stopped sticking, and a removed
  selection dropped another selection's resolved title. Rule: before deriving a value from state, walk it
  through the invalid-then-valid transition; if the old value must be forgotten or the value must
  survive a failed refetch, it is memory, not a derivation. Each of these now has an interaction test
  that fails against the derived version.
- Dialog close resets in ArticleEditorClient: `useDialogStore({ setOpen })` clears the edited node when
  the store closes by any means, replacing three effects on the `open` state.
- Latest-value refs (`saveRef`, `articleIdRef`, `inlineUploadRef`, `targetRef`): written in
  `useLayoutEffect`. The tiptap image plugin takes getters (`getUpload`, `getArticleId`) instead of ref
  objects, so `createArticleEditorExtensions` no longer closes over refs in its `useMemo`.
- Share URL in ArticleRenderer: `useSyncExternalStore` over `popstate`/`hashchange`, server snapshot is
  the article path.
- Inline disables with reasons: layout measurement (MentionSlotPreview), textarea autosize that must
  re-run after the value renders (ArticleTitleFields, caption editors), the `router.isReady` route copy,
  and the hydration reset keyed on the route article id.
- Trigger-only deps dropped (`articles`, `newsletters`, `items` in the landing widgets): the observers
  and rAF loop already react to content changes.

Follow-up done as its own PR (behavior changes, kept out of the migration): the admin forms now keep a
draft through refetches of the same entity with a field-level merge (`useSavedDraft`): a different entity
replaces the draft, untouched fields adopt what was saved elsewhere, edited fields stay and show a
"changed elsewhere" notice with a "Load saved version" action until the draft matches the saved value
again. A successful save calls `acceptSaved(stored, submitted)`, so trimmed text and server-filled asset
metadata are adopted as the user's own save, not flagged as someone else's change (review round 1 of
that PR caught both: identity-only asset comparison kept stale metadata in the next PATCH, and a
normalized save produced a false conflict). Round 2 caught two more: the submitted snapshot must travel
as the mutation variable, because TanStack's success callback sees the latest options and therefore the
latest draft, and a single-field save must acknowledge only its field. The revision drawer keeps the chosen diff base and explains why nothing can be compared instead
of switching bases.

### Follow-up: effects that only existed because nothing unmounted (done)

Six `set-state-in-effect` disables from phases 3c and 3d were justifications, not necessities. Each sat in
a component that never went away, so its state had to be reset by hand. The fix in every case was to put
the state where it already gets destroyed:

- The two market-maker lead dialogs reset a dozen fields, a mutation, a captcha widget and two refs on
  open. `LeadDialog` is now a shell and the forms compose the header, body and footer, so the form lives
  under Ariakit's `unmountOnHide` and a fresh open starts from fresh state. `resetSubmit()` disappears
  with it: it could never move into the mutation's `onSuccess`, because `submit.isSuccess` is what renders
  the confirmation screen.
- The UTR docs drawer does the same through the shared `Drawer`, which also unmounts its children.
- The combine modal is already mounted conditionally, so `key={initialConfig.id}` covers a preset swap.
- The support page moves the chat state into a `LiveChatCard` keyed by the signed-in user, so signing out
  unmounts it and the next session re-initialises the SDK.
- The leaderboard pages during render and keeps only the scroll in an effect, under three stated rules: a
  search navigates once, a new order or filtered set returns to the first page, nothing else moves it.

Two lessons from the review of that pass. A `key` fix is only a fix once the keyed component exists —
deleting the reset first and describing the key in prose left the support chat unable to restart. And
removing a reconciliation means naming the rules that replace it: paging that follows only the search is
as wrong as paging that chases the search forever, and the choice between them is a UX decision to state
and test, not a diff to minimise.

Rule for the rest of the burn-down: **before writing a reset, ask what owns the state and whether that
owner can simply stop existing.** `key` and conditional rendering are the first answers; adjusting state
during render is second; an effect is last and needs a reason that is not "the reset also touches a ref",
since a remount clears refs too.

The same review pass found duplicated state: the Token borrow and yields sections kept a
`shouldFetchFullData` boolean whose every setter was already implied by the filters, the sort or the
requested page. React Query's `enabled` can express that directly, so the state is gone. Deriving the
gate is safe because `useIsClient` keeps the server rendering the hydration snapshot.

### Phase 3d: the long tail (done)

56 sites across 38 files; everything outside LlamaAI is now clean for the compiler rules. What this slice
adds to the patterns above:

- **A browser-only value read after hydration belongs in `useSyncExternalStore`, not in state.** The
  announcement dismissal cookie and the device-platform sniff both became stores with a server snapshot
  that matches the server HTML, which deletes the state and the effect. The cookie writer now notifies its
  subscribers, so every banner for the same announcement hides together.
- **`react/hook-use-state` and the compiler pull in opposite directions** for "build once per instance":
  `useState(() => build())` trips the lint rule, so these use `useMemo` and say why rebuilding is harmless.
- **A reset that also writes a ref cannot move into render**, because the ref write cannot. Those keep the
  effect and a disable that names the pairing (the lead dialogs, the onboarding guard, the pool chart).
- **Adjusting state during render must be provably self-terminating.** Each site either compares against a
  synced copy of its input or sets a value the condition excludes; the narrative-tracker reset relies on
  the dollar denom never being disabled, which the builder guarantees with an explicit `continue`.
- **An effect also ran on mount; the render-time form must not lose that.** The store-previous-prop shape
  initializes its marker from the current prop, so the first application is skipped unless the state's own
  initializer already equals what the effect would have set. Review of this phase found two places where
  it did not: the vault-risk deposit input rendered empty for an existing position (blurring then cleared
  it), and the token page ignored a `#section` hash on load. Check every conversion by asking what the
  effect did on the first commit; where the answer needs the client (a URL hash, localStorage), keep the
  effect.
- **Deriving a value is not the same as writing it.** The seat purchase modal forced the billing interval
  to match an existing subscription by writing it into state, so it stayed chosen after switching to a
  type with no subscription. Replacing that with `lockedInterval ?? billingInterval` silently changed the
  submitted interval. Adjusting state during render keeps both the rule and the behaviour.
- **SSR is a reason to keep an effect.** Moving the Token borrow and yields "fetch the full dataset" latch
  into render changed the server markup, because on the server the effect never runs and the hydration
  snapshot is what should render. An existing test caught it; both latches stayed effects with the reason
  recorded.

Known better abstraction, deliberately left for its own PR: the two market-maker lead dialogs reset a
dozen fields by hand when they open. Their state should live in a body that Ariakit already unmounts
(`unmountOnHide`), so a fresh open starts from fresh state with no reset at all. That needs `LeadDialog`
to stop taking header and footer props computed from form state, which is a refactor of a form with a
captcha and analytics click ids, not a lint change.

### Phase 3c: ECharts, Downloads, hooks, pages (done)

43 sites; the four areas are clean for the compiler rules. New ground beyond 3a/3b:

- Trigger dependencies are the dominant shape here and they are legitimate: `[height]` on an echarts
  `resize()`, `[activeTabId]` on a `scrollIntoView`, `[resultKey]` on a migration, `[remeasureKey]` on a
  re-measure, `iconRevision` on a `setOption`. The callback genuinely does not read the value; re-running
  is the point. These keep an inline disable naming the trigger. Redundant deps are different and were
  removed: `isDark` where `chartTheme` already derives from it, `valueSymbol` where the memo above owns
  it, and the three MultiSeriesChart deps whose values flow in through `series`.
- Next.js router deps: the pages router keeps one object identity and swaps `query` on navigation, so
  `[router.query]` is the real trigger and `[router]` is not a substitute. Reading the value into a local
  first (`const routerQuery = router.query`) satisfies the rule without changing when the effect runs.
- `useTablePages` now compiles under the React Compiler, which it did not on main. Three things blocked
  it: a reducer built with `ref.current ??=` during render, latest-value refs written during render, and
  an arrow function as a parameter default. The reducer moved to `useMemo` (not `useState`, which trips
  `react/hook-use-state`), the refs are written in a layout effect, and the default parser is a
  module-scope function.
- A synchronous reset paired with a ref write cannot move into render, because the ref write cannot.
  Those sites keep the effect and a disable (MultiMetricModal's apply-once guard, support's chat
  teardown). Where the reset stands alone it moved into render.
- Known pre-existing bailouts this phase did not change, all verified identical to main with
  `scripts/reactCompilerCheck.cjs`: MultiSeriesChart, the market treemap, a SqlWorkspace helper,
  useDebounce and token-usage. MultiSeriesChart has two independent blockers (`??=`, then a ref passed
  into the series builder for the end-label formatter), so removing only the first buys nothing; making
  it compile needs the end-label formatter to be attached where the instance already exists.

### Phase 3b: Investors, RWA, ProDashboard (done)

45 sites, all four rules; the three directories are clean for them. Patterns beyond Phase 3a:

- The compiler is on (`reactCompiler: true`), and every `preserve-manual-memoization` hit makes it skip
  the whole component. Where the flagged dependency is a value the compiler cannot prove stable (a
  route-derived string, a value later passed to an unknown function), the manual memo is removed and the
  compiler memoizes the value; two loops in RWAOverview became module-level pure helpers first.
- `useIdleChartComputation` takes `input` plus `compute(input)`; the latest pair is written in a layout
  effect inside the hook, so callers pass inputs as data instead of holding a ref for the hook to read.
  useAdvancedTvlChartData's private copy of the idle scheduler went away with that.
- Keyed resets in render: a market key for the hyperliquid tape and book, a stream key (dashboard, token,
  enabled) for the dashboard stream, and the loaded module remembered with its dashboard id in
  InvestorRelationsView (null while a registered module loads, so the skeleton shows on a switch).
- An effect that only turned a derived default into stored state (Investors first-tab auto-select) is
  removed rather than converted.
- Animation state: the burn counter animates from a ref the frames write, so the effect no longer depends
  on the displayed value.
- **Removing a manual memo needs two proofs, not one: the file compiles, and the computation is actually
  cached.** Review of this phase found both failures in RWAOverview, one after the other. First it did
  not compile at all: an optional chain inside a logical test (`previous?.start === range?.start && ...`)
  is not lowerable by compiler 1.0.0, so the whole component bailed. Then, with that fixed and the
  component compiling, four chart computations were still emitted bare, because the compiler prunes a
  memo scope whose dependency has a mutable range reaching past it (`chartView` aliases a hook object's
  property; the oxlint label for this is "This dependency may be modified later").
- The fix for a pruned scope is to move the memo into a small hook that takes those values as
  parameters. Parameters carry no mutable range from the caller, so the `useMemo` is preserved, the
  helper hook compiles, and the component still compiles: `useLimitedPieChartData` and
  `useRwaChartPresentation` in RWA/index.tsx. Restoring the `useMemo` in the component body instead
  re-bails the whole component, which is what main does today.
- `node scripts/reactCompilerCheck.cjs . <files>` runs babel-plugin-react-compiler with Next's
  production client options and prints which functions compiled and every bailout with its reason.
  Add `--cached fn1,fn2` to assert that every call to those functions in the generated code sits inside
  a memo cache guard; it exits non-zero otherwise. For this phase:
  `node scripts/reactCompilerCheck.cjs . src/containers/RWA/index.tsx --cached
limitRwaPieChartData,buildRwaTimeSeriesCharts,valueSortedStackColors,barChartPresentation`.
  Known pre-existing bailouts it also shows, none of them a place where a memo was removed: value blocks
  inside try/catch (hyperliquid useHyperliquidWs) and try/finally without catch (SqlChartModal,
  useDashboardStream).

### react/refs (79)

Verified in oxlint 1.81: a function returned by `useEffectEvent` may only be called from an effect or
another Effect Event in the same component or hook. It cannot be called from an event handler, wrapped in
`useCallback` for callers, passed as a prop or into another hook, or listed in a dependency array.
Mobile-app (nkzw preset, oxlint 1.79) hit this in its PR #82.

Invariant for every latest-callback site (`useStableCallback`, `useEffectEvent`, latest-value refs): a
deferred call (timer, retry, subscription) must run the closure from the _latest_ render, not the render
that scheduled it. Phase 2a broke this once by turning a `useStableCallback` self-reference into a named
inner function; the timer then kept the original closure. Route deferred self-calls through a ref assigned
in `useLayoutEffect` and check which closure the deferred call actually reaches before calling it fixed.

| Reader of the ref                                                                                                                               | Sites | Fix                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An effect in the same hook                                                                                                                      | ~15   | `useEffectEvent`. Invariant: the effect's dependency array shrinks by the callback and nothing else.                                                                                                                       |
| Event handler, `useCallback`, reducer, async loop, microtask, or library callback                                                               | ~30   | Keep the ref; write it in `useLayoutEffect` instead of during render; read through a plain getter. This is what mobile-app did in useExecutionRecovery. Invariant: the value is fresh before any event in the same commit. |
| Inputs handed to another hook (`latestInputRef` into useIdleChartComputation and friends)                                                       | ~5    | Pass the inputs as data; the receiving hook owns the effect.                                                                                                                                                               |
| Ref read during render as output (useDuelStream buffer, ChatMarkdownRenderer render context, HBarChart logo state, TokensChartsSection entries) | ~5    | `useSyncExternalStore` for the mutable buffer with a version counter; props or context for render data.                                                                                                                    |
| Lazy init `ref.current ??= new X()` read in render (LlamaAI/index.tsx:422)                                                                      | 4     | `useState(() => new X())`.                                                                                                                                                                                                 |
| Reducer held in a ref (useTablePages)                                                                                                           | 1     | Module-level reducer, varying pieces in action payloads.                                                                                                                                                                   |

### react/set-state-in-effect (87)

| Pattern                                                                                                                                         | Sites | Fix and invariant                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copy a prop into draft state and re-sync on change (ArticleImageNodeView, admin forms, PositionControl, DateRangePicker, MMDetailDrawer)        | ~25   | `key` on the child so it remounts with fresh initial state, or the "store previous prop" form during render. Invariant: a draft the user is typing is reset exactly when it was reset before, and not on unrelated re-renders. Remounting drops focus; check inputs that are focused during the change.                                                                                                                                        |
| Derive one piece of state from another (auto-select first tab, clamp index, denom fallback, `shouldFetchFullData`, reset page on filter change) | ~25   | Compute during render, or reset in the handler that changed the input. Invariant: same visible value on every render; for page reset, the page resets on the same user action as before.                                                                                                                                                                                                                                                       |
| Reset form state when a dialog opens or closes                                                                                                  | ~12   | Unmount the dialog body while closed, `key` it, or reset in the close handler. Invariant: state after reopen is the initial state.                                                                                                                                                                                                                                                                                                             |
| Read a browser-only source after hydration (localStorage, UA, `Notification.permission`, sessionStorage, `new Date()`)                          | ~9    | `useSyncExternalStore` with a `getServerSnapshot` that matches the server HTML. Invariant: no hydration warning, same first paint.                                                                                                                                                                                                                                                                                                             |
| Effect guarded by `router.isReady` that copies the query into state (token-usage, subscription, Hacks, ai chat, StablecoinOverview)             | ~4    | Keep the effect. Next.js says `isReady` belongs in effects, not in render decisions. Inline disable with that reason. Exception: a boolean derived from the query with a false default (StablecoinOverview `includeUnreleased`, Nft `includeOutliers`, Cexs `includeOwnTokens`, treasury `includeOwnTokens`) needs neither `isReady` nor state; `router.query` alone is hydration-safe because it is empty on the server and during hydration. |
| Async work with a synchronous reset first (hyperliquid Trades, InvestorRelationsView, useSemanticSearch, PoolApyChart)                          | ~12   | Move the reset to the event that changed the input or `key` by it; dynamic import into state becomes `React.lazy` or `useQuery`. The async setStates are legal and stay.                                                                                                                                                                                                                                                                       |
| Layout measurement in `useLayoutEffect` (useScrollerHeightFromFirstItem, ArticleEditorControls, MentionSlotPreview)                             | ~5    | Allowed by React. Inline disable with the reason.                                                                                                                                                                                                                                                                                                                                                                                              |

### react/preserve-manual-memoization (35)

- Optional-chain paths in deps (`data?.chartConfig`, `streamingDraft?.id`): destructure first, or delete
  the `useMemo` and let the compiler memoize. 12 sites.
- `useCallback` closing over `router` (RWA/Chains, Stablecoins): delete the `useCallback`. 11 sites.
  Invariant: children that received the callback are not `React.memo` wrappers relying on identity;
  check before deleting.
- Inputs mutated after memoization (DirectoryTable, RWA/index): find the in-place `sort` or `push` on a
  memoized array and replace with a fresh array. The memo stays where a comment says TanStack needs the
  identity. 12 sites.

### react/exhaustive-effect-dependencies (61)

55 extra deps, almost all the set-state-in-effect cases above; they disappear with those fixes. The
remainder (`instance.resize()` on `[height]`, `rowVirtualizer.measure()` on `[rows.length]`) either pass
the value into the call or move into the handler that changed it. 6 missing deps are stale-closure bugs
and are fixed first.

### Deferred compiler rules

- `react/incompatible-library`: off until the TanStack table and virtual migration. All 83 non-test hits
  are `useReactTable` and `useVirtualizer`.

## Follow-up: the reset class, swept app-wide

A scan of every effect that calls a real `useState`/`useReducer` setter found 139 across 96 files. 85 are
async arrival, a subscription, or a browser-only read. Of the 54 that remain, 17 looked like the
unmount class. Six are LlamaAI and wait for that directory. Of the other eleven, this pass fixed the
ones where a component really could stop existing:

- The chart and dataset preview modals reset a dozen fields when a different saved preset was run into
  them. Both are already mounted conditionally, so the call site keys them by what they display.
- The virtualized multi-select cleared its search on close. Its popover body is now its own component
  behind `unmountOnHide`, so the search box, the filtered list and the virtualizer stop existing while
  the popover is shut.
- The metric sentence builder reset three pieces of state whenever its popover closed. Ariakit's store
  takes a `setOpen` callback that runs on every close, including Escape and outside clicks, which the
  old `closePopover` helper missed — so three effects collapse into one teardown. Ariakit runs that
  callback from its own store subscription rather than from the click, so this is not literally an event
  handler; what it buys is one teardown that no close path can miss.
- The two author profile forms wrote loaded profile data into four state variables after the request
  landed, guarded by a hydration ref. Each is now a loader that renders a form keyed by the loaded
  profile, so the fields are seeded at mount. That also removes the nullability those forms carried
  everywhere, and fixes an unreachable branch: both checked `loadError` _after_ a spinner condition that
  a failed load also satisfied, so a load error span forever.

The remaining four are not the unmount class, and the heuristic that grouped them was wrong:

- `ChartDatasetModal` resets its table view when the category, the previewed value or sum mode changes.
  Those are transitions inside one open modal. The real fix is to give the table its own component keyed
  by what it displays, which is a larger extraction from a 1300-line file.
- `MarkdownCell` enters edit mode when an already-mounted empty cell gains focus. Cells are keyed by id,
  so a new cell is already handled; this is a genuine prop-change reconciliation.
- `pro.tsx` clears a comparison preset when the create dialog closes. The preset is a URL intent, and
  the honest fix is to consume it — strip the query param — not to clear it on close.

Rule this pass adds: **the effect only disappears if the owner can stop existing.** Where it cannot, the
next question is whether the state change belongs to an event; a store callback like Ariakit's `setOpen`
often turns "reset when it closed" into "reset when it closes".

### LlamaAI

Four of the six LlamaAI sites are the unmount class. `AddTextContentModal`, `ShareModal` and
`CreateAlertModal` all had a dialog that already carried `unmountOnHide` and state that sat above it, so
each becomes a shell plus a form. `ResearchLimitModal` cannot: its latch is what chooses between two
dialogs, so it is reconciled in render instead.

`CreateAlertModal` is the interesting one. It reset thirteen fields, a mutation and a captcha-style
generation counter on every open, and carried two refs whose only job was telling a stale submission
apart from a live one. Unmounting removes the reset, but not the stale-submission problem: React Query
still calls a mutation's own `onSuccess` after the component unmounts. Only the callbacks passed to
`mutate` are dropped. So the split is by ownership — the cache invalidation and the toast stay on the
mutation, because the alert exists regardless; `onCreated` and `dialogStore.hide()` move to the `mutate`
call, because they only mean something to a dialog that is still open.

Extracting the form also made it compile: `CreateAlertModal` and `CreateAlertModalForm` both do now,
where the original bailed out, which is why two of its rule violations had never been reported.

Two traps found while confirming that. `scripts/reactCompilerCheck.cjs` takes the repo root as its first
positional argument, so `node scripts/reactCompilerCheck.cjs <file>` checks nothing and exits 0 — always
pass `.` first. And an `eslint-disable` comment for a React rule makes the compiler skip the whole
component ("React Compiler has skipped optimizing this component because one or more React ESLint rules
were disabled"), so silencing `react-hooks/exhaustive-deps` costs the component its optimization.
`oxlint-disable-next-line` does not have that effect.

`SettingsModal`'s two sites stay. Its dialog closes with `onClose={() => void commitDraft()}`, which
reads the instructions draft, so the state that would need to unmount is exactly the state the close
handler needs. Splitting it means either lifting the draft back into the shell — six props to save one
effect — or a latest-value ref in an unmount cleanup, which is the pattern this burn-down is removing.

## Follow-up: mutation callbacks that outlive their component

The alert-modal fix turned on a React Query detail worth stating once. A mutation's own `onSuccess` runs
even after the component that declared it unmounts; only the callbacks passed to `mutate` are dropped.
So the two places are not interchangeable, and the choice is about ownership:

- On the mutation: work that must happen because the request succeeded — cache writes, invalidation,
  a toast, analytics. The alert exists whether or not anyone is looking at the dialog.
- On the `mutate` call: work that only means something to the component that started it — navigating,
  closing a dialog, calling back to an opener.

A sweep of every `useMutation` found no case of the second mistake: nothing puts cache work in a
`mutate` callback where an unmount would silently skip it. The first mistake existed in eight places, all
of them navigation. Six are fixed: the two `router.replace` calls in
`containers/Articles/editor/ArticleEditorClient.tsx`, the redirect in
`containers/ProDashboard/hooks/useDashboardCreation.tsx`, and the three Articles admin forms
(`BannerForm`, `SocialMentionForm`, `TrustedLogoForm`), which wrote the same shape as
`await mutateAsync(...)` followed by a push — a continuation that survives unmount just as the callback
does. Each keeps its revalidation and toast on the mutation and moves only the redirect.

Two are left, because moving them would not fix them:

- `containers/ProDashboard/hooks/useDashboardAPI.ts` exposes `createDashboard` as `mutateAsync`, and its
  three consumers in `ProDashboardAPIContext` all await it. Taking the push off the mutation only moves
  it into an awaited continuation, which has the same lifetime. A real fix redesigns that provider's
  API to hand callers a `mutate`, and that is a separate change.
- `ArticleEditorClient`'s `save()` awaits `mutateAsync` and returns a boolean its callers depend on, so
  it cannot become a `mutate` call without restructuring the save contract. Its redirect only runs on
  the first save of a brand-new article.

Two more escaped side effects came out of review. `AddTextContentModal` hid its dialog and toasted from
the continuation of an awaited request; `ShareModal` wrote the new link to the reader's clipboard from
the mutation's `onSuccess`, so a share the reader had already dismissed could overwrite whatever they
copied since. Both move to the `mutate` call.

Moving a callback onto the `mutate` call means every caller of that mutation has to carry it. The share
dialog has two — the initial attempt and the retry button — and moving only the first silently stopped
retries from copying anything. Look for the other call sites before making this move. The invalidation each depends on already sits on its
mutation, so nothing that must happen is lost.

`AddToDashboardModal` calls `dialogStore.hide()` from a mutation callback. Hiding an already-hidden
dialog does nothing, so it is left alone.

### `router` in dependency arrays

63 hooks list the whole `router` object. It is not a correctness problem: the pages router keeps one
object identity for the life of the app, so the dependency never fires. It is only noise.

`next/router`'s default export is the same router as an imperative singleton, and the repo already uses
it in several places. Where a hook only navigates, importing `Router` and calling `Router.push` drops
the dependency entirely; that is what `useDashboardCreation` and the two article-editor redirects now
do. The eight purely imperative hooks app-wide now do the same: the articles access gate, the onboarding
continue handler, the movers chart click, both Pro dashboard route normalisers, the research canonical
redirect and the sheets auth handoff. Four of those files stopped calling `useRouter` altogether.

The remaining 56 read `query`, `pathname` or `isReady`, and an effect gated on `isReady` genuinely needs
to re-run when it flips, so those keep `useRouter` and their dependency.

Two test harnesses had to learn the singleton, and the failure is worth knowing: `vi.mock` factories are
hoisted above the file body, so a `default: { push }` referring to a `const push = vi.fn()` throws
"Cannot access 'push' before initialization". Declare those through `vi.hoisted`.

Note the setState findings the same sweep produced are _not_ bugs: setting state on an unmounted
component is a no-op in React 18, and `setQueryData` is a cache write that belongs on the mutation.
Only effects that escape the component matter here.

## Follow-up: the memo sweep

React Compiler caches the JSX elements a component creates, so a child whose element comes back
identical is not re-rendered — which is the work `React.memo` was doing. The condition is not "the
caller compiles": it is that the element for that child sits inside a `if ($[n] !== dep)` cache guard in
the compiled caller. A child rendered inside a `.map()` never does, however well its caller compiles.

`scripts/reactCompilerCheck.cjs` answers the first question, not the second, so this sweep used a
throwaway variant that compiles a caller and reports, per component, how many of its JSX elements land
inside a cache guard.

That check was wrong on its first pass, in a way worth recording. It walked up from the element to the
nearest guard, which marks a list item as cached: the guard is real, but it caches the render _callback_
the compiler hoisted out of the list, not each element the callback produces, so one item changing
rebuilds them all. The rule that matches the compiled output is **no function boundary between the
element and its guard**. Two of the nine removals were wrong under the corrected rule, and a browser
comparison of render counts caught the first one before the corrected tool did.

Results across the 22 `memo()` sites:

- **7 removed**: `MultiChartCard`, `KeyMetrics`, `AlertArtifact`, `AlertArtifactLoading`, `QueueChips`,
  `CreateAlertModal`, `SpawnProgressCard`. Every caller of each caches the element with no function
  boundary in between. `KeyMetrics` has nine callers and all nine do.
- **14 kept**: the element is uncached in at least one caller. `DashboardItemRenderer` and
  `AgenticSessionItem` are here because of the corrected rule — both render inside a list whose callback
  is what gets cached. Several others are rendered from `containers/LlamaAI/index.tsx`, which has six
  bailouts, so nothing it renders is cached. `SearchResults` is the instructive one: cached from
  `components/ResearchSearchDialog.tsx`, uncached from the agentic sidebar, so a per-component verdict
  would have cleared it wrongly.
- **1 untouchable**: `ChartRendererMemoized` passes a custom comparator, which is a behaviour choice
  rather than automatic memoization.

The residual risk is maintenance, not correctness: a component whose memo is gone will re-render freely
if a future caller bails out. That is an argument for keeping the LlamaAI bailouts on the burn-down
list, not for keeping the memos.

## The React Compiler baseline

`bun run compiler:baseline:check` is the ratchet for compiler bailouts, and CI runs it. It exists
because a component that stops compiling fails nothing: it simply stops being memoized, and nothing
downstream of it is cached either. That is how `AgenticChat` went its whole life without compiling.

It mirrors the lint ratchet exactly — `.reactcompiler.baseline.json` records bailouts per file per
reason, one line per file; the check fails if a file bails more than recorded, if the record is stale,
or if the committed record accepts more than `origin/main` does. Regenerate with
`bun run compiler:baseline`. A full run recompiles every non-test `.ts`/`.tsx` under `src` and takes
about a minute.

At creation: 193 bailouts across 154 files and 17 reasons. `Use of incompatible library` is 82 of them
(`useVirtualizer` and `useReactTable`, the deferred rule). The rest are dominated by things the compiler
cannot lower — value blocks inside `try`/`catch` (23), refs read during render (22), `try` with a
`finally` (21) — and each has a mechanical fix, which is what makes this a burn-down list rather than a
wall.

Two traps when working with the checker directly, both of which produced false clean runs here:

- `scripts/reactCompilerCheck.cjs` takes the repo root as its first positional argument. Passing only a
  file checks nothing and exits 0. Always `node scripts/reactCompilerCheck.cjs . <files>`, and expect a
  `<file>: compiled N [...]` line for every file.
- The compiler only visits components and real hooks. A plain function whose name happens to start with
  `use` but which calls no hooks is never compiled, so probing the checker with one proves nothing.

### Every count here is a floor, not a total

The compiler stops at the first unsupported expression in a component, so the baseline records the
reason it reported, not the reasons the component has. Fixing that one can reveal another underneath.

This is not a rare edge. Two of the seventeen files in the mechanical sweep did exactly that:

| File                                                       | Recorded  | Revealed once fixed           |
| ---------------------------------------------------------- | --------- | ----------------------------- |
| `components/ECharts/MultiSeriesChart/index.tsx`            | `??=` (2) | refs read during render       |
| `containers/LlamaAI/components/sidebar/AgenticSidebar.tsx` | `??=` (1) | `Use of incompatible library` |

Both were left unfixed on purpose. Neither component compiles either way, so the change would trade one
baseline entry for another, and the ratchet is right to read that as new debt under a different rule.
They go with the phase that unblocks them — the refs restructure, and the TanStack migration.

Three consequences worth carrying:

- **Per-rule totals understate.** `Use of incompatible library` reads 82, but at least one more is
  hiding behind a `??=`. Treat it as a floor. The same applies to every row in the tally below.
- **A fix that "reveals" is still progress on the file, but not on the count.** Judge a sweep by
  components that newly compile, not by the delta in the baseline total. The mechanical sweep moved 22
  bailouts and 14 components; those numbers are not two views of the same thing.
- **The ratchet cannot express "same file, still broken, different first reason".** That is a real gap
  in the tool, not a false positive. Reverting the fix is the honest response until the blocking rule is
  in scope; do not add an allowance to make the check quiet.

### Some bailouts are load-bearing

The dangerous case is the opposite one: a bailout can be the only thing keeping a component out of the
compiler, and removing it is a behaviour change even when the edit itself is a no-op.

`components/Table/Table.tsx` is the worked example. Its three `['--x' as string]` computed keys kept
`TableRow` and `VirtualTable` uncompiled. Rewriting them into the `{ '--x': v } as CSSProperties` form
used elsewhere in the repo is provably equivalent CSS — and it let both components compile, which cached
`instance.getRowModel()` against the instance identity and `row.getVisibleCells()` against the row
identity. TanStack keeps both objects stable while their state mutates, so the cached reads froze after
the first render: sorting and filtering stopped taking effect, replaced data kept its old values, and
hiding a column dropped its header while leaving the cells under the wrong headings. A reviewer caught
it in compiled browser fixtures; no unit test in the suite would have.

The reason the compiler does not protect itself here is that `instance` arrives as a **prop**. The
`Use of incompatible library` bailout fires on `useReactTable` and `useVirtualizer` call sites, so a
component handed a table object never trips it.

Two rules follow:

- Before removing a bailout from a file that reads TanStack row, cell, header or column state, check
  where that read ends up in the compiled output. `node scripts/reactCompilerCheck.cjs . <file>` says
  whether the component compiles; dumping the compiled code says whether the read landed inside an
  `if ($[n] !== x)` guard. A read in a cache guard against a stable-identity object is the bug.
- **There is already a convention for this, and it is a directive.** `PaginatedTable`, ProDashboard's
  `TableBody` and `MarketMakers/StickyTable` each open with `'use no memo'`, precisely because they take
  a table instance as a prop. That is the established answer for this component shape; use it rather
  than inventing something.

  `containers/Investors/dashboards/aave/shared.tsx` was the one that had missed it, and was a live bug
  on main: compiled, it cached `overrideRows ?? instance.getRowModel().rows` and
  `instance.getHeaderGroups()` against the instance, so its GHO and Rates views ignored sorting and kept
  stale values after the data was replaced. `getVisibleCells()` was left uncached there, which is why
  cells stayed under the right headings — a narrower symptom set than `Table.tsx`'s, and easy to misread
  as a data-fetching problem. It now carries the directive.

  Two files in that group are fine for reasons other than a directive: `UnifiedTable/index.tsx` reads
  columns inside click handlers, which run after render and so must read fresh; `Table/utils.ts` is a
  plain function the compiler never visits.

- **Opt-outs are recorded in the baseline.** `scripts/reactCompilerCheck.cjs` prints a `SKIPPED` line
  for a directive and `scripts/compilerBaseline.ts` records it as `Skipped by directive`. Deleting a
  directive therefore makes its entry stale and fails the check, instead of quietly letting the
  component compile again. Adding one shows up as growth against `origin/main`, so it stays a decision
  rather than a habit.

When a bailout turns out to be load-bearing, keep it and say so at the line, so the next person to tidy
the expression knows what it is holding up.

### Finding the expression, not the function

The checker's `BAILOUT` line used to print the enclosing function's position, which for a long
component is its declaration and tells you nothing. It now prints the expression's own location from
the diagnostic, falling back to the function when there isn't one. Three location guesses were wrong
before this was noticed, so prefer the line the checker gives you over reading the file for likely
suspects.

`scripts/compilerBaseline.ts` parses that line. A format change there emptied the counts file to zero
on the next regeneration without failing — the two scripts are coupled by the checker's stdout, so
change them together and re-run `bun run compiler:baseline` before trusting a diff.

## The try family, and what its messages do not tell you

Four fix shapes cover it, and three of them are not guessable from the bailout text.

**A value block in a `catch` is the same bailout as one in a `try`.** The message only says
"within a try/catch statement", so a conditional formatting a caught error reads as unrelated. Name the
message out in a function, or compute it before the try when it does not depend on the error.

**A caught binding referenced from a nested function reports as something else entirely.** The message
is `Expected all references to a variable to be consistently local or context references`, with the
detail "this is local", which sounds like a separate and harder class. It is not: it means the `catch
(error)` binding is captured by a closure inside the catch, typically a `setState` updater. Read it into
a plain const first, then let the updater close over that.

Both of those cost a revert before being understood. `ClaimTokenProfile` was set aside as
"not mechanical" on the strength of that message alone, and turned out to be two ordinary fixes.

**The compiler cannot lower a loop inside a `try` at all.** Not the iterator, the whole statement.
`for (const [i, x] of plan.entries())` reports against `plan.entries()`; rewriting it as
`for (let i = 0; i < plan.length; i++)` moves the complaint to the `0`. The loop has to come out of the
try, which is a restructure, not a hoist. `SqlWorkspace` is left in the baseline for that reason.

**`Promise.finally` replaces a `try`/`finally` whenever the callee already returns a promise.** No try
statement survives, the flag still clears on rejection, and in the SQL chart modal it also retired a
`react/memo-dependencies` suppression that only existed because the compiler could not see through the
try.

A finalizer can only move after the try/catch when neither body exits early. Where every path returns —
`ArticleEditorClient`'s save, `useTableRegistry`'s load — moving it means it never runs, so those need
the body extracted instead.

One file at a time is the wrong unit here. `useDashboardStream` took five passes: two request
conditionals, a catch ternary, a caught binding in an updater, a body test, and a `try` with a
`finally` but no `catch`. Expect to re-run the checker after every fix.

## Follow-up: try/catch around an awaited mutation

React Compiler cannot lower a conditional, logical or optional chain inside a `try`/`catch`, and the
commonest shape in this repo puts one there:

```tsx
try {
	await remove.mutateAsync(project.id)
	toast.success('Project deleted')
} catch (error) {
	toast.error(error instanceof Error ? error.message : 'Failed to delete project')
}
```

The fix is not a helper for the message. It is that the error already has a home: pass the callbacks to
`mutate` instead. That removes the `try`, adds no abstraction, and leaves the failure in
`mutation.error` — which is what an inline error message renders from, where a toast does not. So this
conversion is a prerequisite for moving off toasts, not churn ahead of it.

Three project modals are converted. **`ProjectInstructionsEditor` is deliberately not**, and it is the
counter-example that stops this being a codemod: its draft merge awaits the save and reads `isPending`
to decide whether to keep a newer draft, and it has tests for exactly that concurrency
("submits a newer draft while an earlier save is pending"). `mutate` fires and forgets. Its three tests
failed immediately, which is the check to run per site — and the mocks in that file only expose
`mutateAsync`, so a converted component silently calls `undefined`.

The pattern app-wide, for the revisit: **28 `try` blocks awaiting a `mutateAsync` across 17 files** —
LlamaAI 10, Articles 6, Subscription 5, Account 4, auth 3. The densest are
`useArticleCollaborators` (4), `useSessionMutations` (3), `SignInDialog` (3) and `SwitchToEmailModal` (3).
Per site, ask whether anything after the `await` depends on ordering or on the promise itself; if it
does, leave it alone.

The other three `try` bailout families are separate work: a `finally` clause (21 bailouts) is unsupported
whatever it contains, so those need promise `.finally()` or the cleanup duplicated per exit path; `try`
without a `catch` (9) and `throw` inside `try`/`catch` (8) likewise need restructuring rather than a
substitution.

## Follow-up: hand-rolled pending and error state

A `finally` clause is unsupported by the compiler whatever it contains, and the commonest one in this
repo resets a flag:

```tsx
setIsLoading(true)
try {
	await requestEmailChange(email)
	setIsSuccess(true)
} catch {
	setError('This email is already associated with another account.')
} finally {
	setIsLoading(false)
}
```

Fourteen of those were moved after the `try`/`catch`, which is behaviour-identical wherever neither
block exits early — but it treats the symptom. All three flags are a hand-rolled `useMutation`:
`isPending`, `isError` and `isSuccess` already exist, the `finally` has nothing to reset, and
`reset()` replaces clearing them by hand. `EmailChangeModal` is the worked example: three `useState`
calls and the whole `try`/`catch`/`finally` gone, seven lines shorter.

Two things the conversion must keep. The error text was a fixed string, not the thrown message, so it
moves into the JSX rather than into state. And a nested `try` that swallowed a secondary failure becomes
`await refreshSession().catch(() => {})`, which keeps the primary request's success independent of it.

### Where this pattern lives

**35 files** keep local pending or error state around an `await`. LlamaAI 12, Articles 8, ProDashboard 5,
components 3, Account 2, and one each in auth, Downloads, ChainOverview, ProtocolOverview and
ProtocolRankings.

**Eight of them already use a mutation and duplicate its state**, which makes them pure deletions:
`Account/DeleteAccountCard`, `Account/SwitchToEmailModal`, `Articles/editor/ArticleEditorClient` (×2),
`Articles/editor/RevisionHistoryDrawer`, `Articles/editor/useArticleCollaborators`,
`LlamaAI/components/ShareModal`, `LlamaAI/components/sidebar/AgenticSessionItem`, `LlamaAI/index` (×2).

**Four keep a per-item busy marker** — state holding the id of the row being acted on rather than a
boolean: `ProjectLanding`, `AgenticSidebar`, `LlamaAIChartPicker`, `SqlChartModal`. Those do not need
their own state either: `mutation.variables` is the in-flight input, so
`rename.isPending && rename.variables.sessionId === session.sessionId` is the whole condition.

### The rule, and what it decides

Local state is fine where the work it guards is genuinely synchronous and the justification is written
down. Where the work is async and the state only tracks that it is in flight, it is a hand-rolled
mutation and should go. Client-side versus server-side is not the axis — PNG export and clipboard writes
are as async as any request.

Applied to the 27 files with no mutation, that leaves **one** case of justified local state:
`ChatMarkdownRenderer`'s `pendingExternalHref`, which is not a loading flag at all but the link awaiting
confirmation. Every other flag in that list guards an `await`.

The eight files that already hold a mutation need a _partial_ refactor, not a deletion. `SwitchToEmailModal`
and `DeleteAccountCard` keep their error state for validation messages — "Passwords do not match",
"Password must be at least 8 characters" — which no mutation produces. Only the branch that copies a
rejection into that same state is redundant, and `DeleteAccountCard` already composes both mutations'
errors alongside it.

### The reverse check

Nothing to undo. All **150** `useMutation` call sites wrap genuinely async work. Thirteen look otherwise
to a naive "no `await` in the options block" search, and all thirteen are references to an async function
declared elsewhere (`requestSwitchToEmailOtp`, `submitSupportRequest`, `downloadMarkdownFile`) or a call
returning a promise (`loadMoreMessages`). No mutation here is wrapping synchronous work.

The remaining `finally` sites are the ones where a block exits early, plus `try` without a `catch` (9)
and `throw` inside `try`/`catch` (8). Those cannot move the finalizer, so they need either promise
`.finally()`, the cleanup duplicated per exit path, or the whole block lifted out of the component the
way `stopSettlement` was.

## Follow-up: put the mutation where the button is

The audits above kept arriving at the same root cause. Six hooks hand callers a bare trigger —
`createSession: createSessionMutation.mutateAsync` and twelve more like it — so every caller has to
re-derive what the mutation already knows. That is where most of the 35 local pending flags come from.

There are three shapes, in increasing order of how good they are.

**Worst: a local id.** `ProjectLanding` kept `actingSessionId` because the hook only offered one shared
`isUpdatingTitle` for every row. State duplicating something the mutation holds.

**Better: hand out the mutation.** `useSessionMutations` now returns `updateTitle` rather than its
trigger and its `isPending` separately, and `updateTitle.variables?.sessionId === s.sessionId` answers
which row without any state. Two lines, no new state, and it is what `variables` is for.

**Best: move the mutation down to the row.** The "which row" question only exists because the mutation
lives above the thing that owns the action. A `SessionRow` that calls its own update mutation has
`isPending` for itself, and no id is compared anywhere — the same "state belongs to the component that
owns it" move as the rest of this burn-down, and the row becomes memoizable per row as a bonus.

Is a mutation per row expensive? Worth answering from the mechanism rather than taste. `useMutation`
creates one `MutationObserver` and one subscription to the mutation cache. It does not fetch, and unlike
`useQuery` it holds no keyed cache entry, so the per-row cost is an allocation and a subscribe — the
same order as any other hook. Against that it _removes_ work: with the mutation in the parent, every
`isPending` flip re-renders the parent and recomputes the busy flag for every row; with it in the row,
only the acting row re-renders.

So per row wins here, with two conditions. It has to be a granular hook: `useSessionMutations` holds
**eight** mutations, so calling it per row would mean eight observers per row. And the list has to stay
bounded — `useProjectSessions` fetches every session for a project with no limit and the list is not
virtualised, so N is the reader's. At tens of rows the observers are free; at thousands the mount cost
becomes real, though by then an unvirtualised list is the larger problem. If it ever grows that far, the
mutation moves back up or reaches the row through context.

The title mutation only needs `authorizedFetch`, `queryClient` and the user id, so it extracts cleanly
into `useUpdateSessionTitle`. Splitting the omnibus hook comes first; then the row can own its mutation.

### Measured

200 rows, unmemoized React, one row's action taken:

|                           | mount            | renders when it starts | renders when it settles |
| ------------------------- | ---------------- | ---------------------- | ----------------------- |
| one mutation for the list | 200 rows, 15.1ms | **200**                | **200**                 |
| one mutation per row      | 200 rows, 10.3ms | **1**                  | **1**                   |

Two hundred mutation observers cost nothing measurable at mount — the per-row shape was in fact the
faster of the two, inside noise. What differs is every action after that: the shared shape re-renders
the whole list twice, once to show the pending state and once to clear it, because the flag lives in
the parent. The per-row shape re-renders the row that is acting.

So the worry is unfounded at this size, and the caveats stand rather than being softened: it must be a
granular hook, and the list must stay bounded. This was a synthetic list, so it measures the render
mechanism, not this page. React Compiler was not enabled in the harness, which is the honest worst case
for the shared shape — but the busy flag differs per row, so the map callback is rebuilt either way and
production should behave the same.

Deletion in the same component went the same way, which removed the last local id there. Its
`window.confirm` stays outside the mutation on purpose: the confirm guards whether to act at all, and a
cancelled prompt is neither a failure nor a delete, so putting it in `mutationFn` would have to leave
the mutation in one of two states that misdescribe what happened. `isPending` would also be true while a
prompt waits on a person — harmless while it blocks, wrong as soon as it is a real dialog.

## What is left of the async-state work

One tally, so the remaining work is a list rather than a feeling. All counts are against the current
tree.

| Bucket                                                   | Remaining             | Where                                                                                                                         |
| -------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Value block inside a `try`/`catch`                       | 21 bailouts, 21 files | Spread thin; one per file                                                                                                     |
| `throw` inside a `try`/`catch`                           | 8 bailouts, 5 files   | `useChatQueueController`, `LlamaAIChartPicker`                                                                                |
| `try` without a `catch`                                  | 7 bailouts, 6 files   | Upload hooks, SQL chart modal, stream readers                                                                                 |
| `finally` clause                                         | 7 bailouts, 7 files   | The ones where a block exits early                                                                                            |
| Refs read during render                                  | 8 bailouts, 4 files   | `useDuelStream`, `ChatMarkdownRenderer`, `TreemapChart/Market`, `useDebounce` — restructure, not mechanical                   |
| `??=` left in place                                      | 3 bailouts, 2 files   | Masked by a deferred or restructure bailout; see the floor caveat above                                                       |
| `as string` computed keys in `Table.tsx`                 | 3 bailouts, 1 file    | Load-bearing: they keep the shared table out of the compiler. Needs reactive row/cell data first                              |
| Local pending or error state around an `await`           | 34 files              | LlamaAI 11, Articles 8, ProDashboard 5                                                                                        |
| — of those, alongside a mutation that already reports it | 8 files               | Partial refactors, not deletions                                                                                              |
| — of those, with no mutation at all                      | 26 files              | Full conversions                                                                                                              |
| Hooks handing out a bare trigger                         | 12 sites, 6 hooks     | `useSessionMutations` (3 left), `auth`, `useDashboardAPI`, `useDashboardDiscovery`, `useDashboardEngagement`, `useUserConfig` |

43 of the compiler bailouts and all 34 state files are the same underlying thing seen from two angles,
so the order that pays is: hooks hand out mutations, callers stop hand-rolling pending and error state,
and the `try`/`catch` around the await goes with it. Doing it in the other order means converting a
`try`/`catch` and then rewriting the same lines again.

Two things not on this list. `no-await-in-loop` (109) and `max-depth` (91) are the Phase 4 judgment
buckets and unrelated. `Use of incompatible library` (82, and at least one more masked) is the deferred
TanStack rule and will not move until table and virtual migrate.

The mechanical sweep took the baseline from 161 to 139, so 57 of the 139 are actionable. It fixed 22
bailouts across 14 files and made 14 more components compile — the two figures differ, for the reason in
the floor caveat above.

## Phase 4: judgment buckets

| Rule                                          | Hits | Approach                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react/no-array-index-key                      | 129  | One at a time. Preference order: the id the backend sends; a composite key from fields that identify the row; an id assigned once where the response is normalized, never at render time; for static lists that are never reordered, filtered or edited, keep the index with an inline disable saying so. Never `index + value` hacks. |
| jsx-a11y correctness set                      | ~200 | Mostly `aria-label` on icon-only controls (96) and keyboard handlers on clickable divs (39). `prefer-tag-over-role` and `no-autofocus` stay off with reasons in the config.                                                                                                                                                            |
| vitest/no-conditional-expect                  | 74   | Split the test or assert the condition. Each test still covers the branch it covered before.                                                                                                                                                                                                                                           |
| eslint/no-await-in-loop                       | 109  | Parallelize with `Promise.all` where the iterations are independent; inline disable where sequencing is deliberate (rate limits, ordered writes).                                                                                                                                                                                      |
| eslint/max-depth                              | 91   | Extract or early-return.                                                                                                                                                                                                                                                                                                               |
| unicorn/consistent-function-scoping leftovers |      | See Phase 2.                                                                                                                                                                                                                                                                                                                           |

## Phase 5: deferred, with the trigger that re-opens each

| Rule                                                                                                                                 | Trigger                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| typescript/no-explicit-any (175 non-test)                                                                                            | Strict-types migration complete.                                                                                                |
| react/incompatible-library (83)                                                                                                      | TanStack table and virtual migrated.                                                                                            |
| import/no-cycle                                                                                                                      | Needs a separate measurement run with the multi-file pass.                                                                      |
| eslint/no-console (299)                                                                                                              | A logger decision. Likely `allow: ["warn", "error"]` with a server-side override, as nkzw does.                                 |
| Type-aware rules (`await-thenable`, `no-floating-promises`, `no-misused-promises`, `no-useless-default-assignment`, `require-await`) | CI runs `oxlint --type-aware`. Today that reports about 9900 diagnostics from correctness type-aware rules and is out of scope. |

## Rules considered and left off

- `unicorn/no-array-sort` (407), `no-array-reverse` (20): `toSorted` copies; `react/immutability` catches
  sorting props or state in place.
- `unicorn/no-new-array` (248): `new Array(n)` is the preallocation idiom.
- `typescript/no-non-null-assertion` (754): the style guide uses asserts for data expected to exist.
- `typescript/explicit-function-return-type` (7777): trust inference.
- `eslint/no-nested-ternary` (1263), `no-negated-condition` (1064): mostly JSX conditionals; revisit later.
- nkzw preset wholesale: its perfectionist sorting rules (60k hits) and `curly` (11k) are cosmetic and
  need the JS plugin runtime. The non-cosmetic half is already in the config.
- `react-perf` plugin: React Compiler makes the memoization it nags about automatic.

## Decisions on record

- `Array<T>` style. Vitest `test`, not `it`. `no-unused-vars` with `args: none`.
- Ratchet baseline approach; every phase is its own PR merged before the next starts.
- `router.isReady` stays in effects; no mass replacement with `useIsClient`. The two flags answer
  different questions and both are false on the server and during hydration. Loader-on-`!isReady` pages
  (~12) are a UX and SEO tradeoff to decide per page, not a lint fix.
- `no-map-spread` is kept only if most sites own their arrays; the Phase 2 PR reports the split.
