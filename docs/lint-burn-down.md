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
