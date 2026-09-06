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

## Phase 2: mechanical manual fixes, by directory

Each bucket has one right answer per site but needs a human to read the site.

| Rule                                                         | Hits        | Fix and invariant                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react/memo-dependencies                                      | 20          | 18 extra deps: remove, the memo recomputes less often and the value is unchanged because the dep was not read. 2 missing deps (useDateRangeValidation, hyperliquid api): add, these are stale-closure bugs.                                                                                                                                                   |
| react/immutability                                           | 7 non-test  | 3 `let` counters mutated inside `.map` in JSX: build the row list with a `for` loop above the JSX, output order unchanged. 2 recursive `useCallback`s: named function expression. 2 in useChatScroll: one owner mutates the ref.                                                                                                                              |
| react/purity                                                 | 2 non-test  | `Date.now()` in render. VaultRolesBlock already receives `nowIso`: require it. ApiUsageBreakdown: take `now` from `dataUpdatedAt` or `useState(() => Date.now())`. Snapshot the rendered window before and after.                                                                                                                                             |
| react/hooks                                                  | 1           | `dialogStore.useState('open')` becomes `Ariakit.useStoreState(dialogStore, 'open')`.                                                                                                                                                                                                                                                                          |
| oxc/const-comparisons                                        | 1           | DeFiWatchlist/index.tsx:764 compares the same value on both sides. Read the intent, fix the condition, add a test for the branch.                                                                                                                                                                                                                             |
| oxc/no-map-spread                                            | 128         | Convert to in-place mutation only when the array is owned by the same function (freshly fetched, parsed, or built there). Otherwise the copy is correct: keep it with an inline disable. If most sites need the disable, drop the rule instead of littering disables. The count of owned versus shared arrays decides this and is reported in the Phase 2 PR. |
| unicorn/no-array-reduce, no-array-for-each                   | 72          | `for` or `for...of`. Same iteration order, same result; `forEach` over a `Map` or `Set` keeps insertion order in `for...of`.                                                                                                                                                                                                                                  |
| unicorn/prefer-set-has, prefer-array-find, prefer-array-some | 29          | Lookup semantics identical. `Set` construction moves out of the loop.                                                                                                                                                                                                                                                                                         |
| unicorn/consistent-function-scoping                          | 63 non-test | Hoist to module scope only when the function captures nothing. If it reads a component variable the rule is wrong about it; check before moving.                                                                                                                                                                                                              |
| react/button-has-type                                        | 315         | See Phase 1.                                                                                                                                                                                                                                                                                                                                                  |
| eslint/no-empty                                              | 64          | Empty `catch` blocks get a comment stating why the error is ignored, or handle it. No silent swallowing without a reason.                                                                                                                                                                                                                                     |
| eslint/max-depth (4), no-param-reassign, no-loop-func, radix | ~120        | Extract or early-return. Behavior unchanged by construction; tests around the function must exist or be added.                                                                                                                                                                                                                                                |

## Phase 3: React Compiler rules, by directory

Order: Articles, ProDashboard, Investors, Downloads, hooks, components, then LlamaAI as its own series.
Each PR covers one directory and lists the pattern used per site.

### react/refs (79)

Verified in oxlint 1.81: a function returned by `useEffectEvent` may only be called from an effect or
another Effect Event in the same component or hook. It cannot be called from an event handler, wrapped in
`useCallback` for callers, passed as a prop or into another hook, or listed in a dependency array.
Mobile-app (nkzw preset, oxlint 1.79) hit this in its PR #82.

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
