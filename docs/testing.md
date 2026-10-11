# Testing

A test calls the code the way its users do and asserts what they observe against a literal expected value. It fails when a user-visible or data-visible behavior breaks and stays green through refactors that keep that behavior.

The check: would the test still pass if every function it imports returned `undefined`? If yes, it observes no behavior. Rewrite the assertion or delete the test.

`.oxlintrc.json` rejects the mechanical cases: a test with no assertion (`vitest/expect-expect`), a malformed `expect` (`vitest/valid-expect`), and `it` in place of `test` (`vitest/consistent-test-it`). Name an assertion helper `expect*` so `vitest/expect-expect` sees it. This page covers what the lint cannot judge.

## Where a test goes

| To test this                                                                                                       | Test it here                                                                                                                                              | Example                                                               |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Decision logic                                                                                                     | A pure function: real input in, literal output out. This is the default and the fastest test.                                                             | `src/components/Select/__tests__/query.test.ts`                       |
| Logic buried in a component, hook or route                                                                         | Move it into a pure function first, then test that                                                                                                        |                                                                       |
| Interaction contracts: focus, dialogs, keyboard, races, cancellation, access gating, what a user sees after acting | Render the real component tree and act as a user would                                                                                                    | `src/ui/__tests__/Select.behavior.test.tsx`                           |
| A route contract                                                                                                   | Run the real `getServerSideProps` or API handler against `fetch` fixtures (`installFixtureFetch`); assert status, headers, redirect and returned data     | `src/containers/Cexs/__tests__/inflowsApiRoutes.test.ts`              |
| A reader of a value other code writes (URL query params, storage, API payloads)                                    | The round trip through the real writer, never a hand-written copy of what the reader receives. A copied encoding drifts silently when the writer changes. | `src/containers/ProDashboard/__tests__/variableOverridesUrl.test.tsx` |
| Anything rendered from the clock, the visitor's zone or locale                                                     | `renderHydrated` from `src/utils/testing/hydration.tsx` (see "Clock and hydration" below)                                                                 | `src/hooks/__tests__/dateRangeHydration.test.tsx`                     |
| A chart tooltip formatter                                                                                          | Real builder output; see `docs/charts.md`, "Testing a formatter"                                                                                          | `src/components/ECharts/MultiSeriesChart/__tests__/tooltip.test.ts`   |
| A page                                                                                                             | Beside the container the page renders. Next treats every file under `src/pages/` as a route, so a test there breaks the build.                            | `src/containers/RWA/__tests__/category-page.test.ts`                  |
| Any other file                                                                                                     | The `__tests__/` folder beside the code it tests                                                                                                          |                                                                       |
| Fixtures and factories one folder's tests use                                                                      | That `__tests__/` folder, without a `.test` suffix                                                                                                        | `src/containers/Equities/__tests__/pageFixture.ts`                    |
| Helpers shared across features                                                                                     | `src/utils/testing/`, with their own tests under the same rules                                                                                           | `src/utils/testing/__tests__/`                                        |

## What to mock

Mock only at boundaries:

| Boundary                                                                                                          | Use                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `fetch`                                                                                                           | `installFixtureFetch` from `src/utils/testing/fixtureFetch.ts`                                |
| App metadata (`~/utils/metadata`)                                                                                 | Seed it with `installMetadataSeeder` from `src/utils/testing/metadataCache.ts`; never mock it |
| Dataset snapshot store adapters                                                                                   | `vi.mock` of `*/server/dataset.server.ts`                                                     |
| Database clients, `~/utils/cache-client`, `~/utils/http-client`, `~/utils/async` (`fetchJson`), `~/utils/apiAuth` | `vi.mock` of that module                                                                      |
| Clocks                                                                                                            | `vi.useFakeTimers` and `vi.setSystemTime`                                                     |
| `next/router`                                                                                                     | `vi.mock('next/router')`                                                                      |
| Browser or third-party APIs that cannot run in Node                                                               | A stub of that API                                                                            |
| A heavy child component                                                                                           | A stub, only when the test asserts nothing about that child's output                          |

- Never `vi.mock` any other module under `src/`.
- A fixture endpoint has a success variant that changes the scenario's state as the real server does, so a dialog's success path, including invalidations that remount it, is tested, not only its failure.
- A test that needs a hand-written fake of a library (ECharts, an editor) to reach its assertion is testing logic that belongs in a pure function. Extract it.

## Assertions

- These shapes fail the `undefined` check: no assertion, or only `toBeDefined`, `toBeTruthy` or `not.toThrow`; only mock-call or absence assertions; an expected value computed by the code under test; a restated constant, config default or prompt string; data the test built itself.
- Never assert calls between internal modules, class names, inline styles, wrapper nesting, exact HTML, snapshots, or "renders without crashing".
- Assert calls only for `fetch`, navigation, emitted events, and callbacks the test supplies.
- Assert a request's URL, headers or body only where our own logic chose them: a filter, a cursor, a branch on user input. A fixed endpoint, an auth or secret header, or a body that is the input as JSON is a copy of the code. It cannot catch a wrong env var, a missing key or a broken upstream, and it fails only on intended changes.
- Accessibility semantics (labels, roles, focus, expanded state) are behavior. Assert them.
- Copy is not behavior. Assert that a message shows (a `role="alert"` where the data would be, a field error on the right control), what its action does, and when it clears; never its fixed wording, which fails only when someone rewords it. Assert wording only where code composes it: a name or count in the sentence, a server message the code passes through, or which of two messages a branch picked.
- Read field errors with `fieldErrorTexts` (every error under a root) or `fieldErrorOf` (one control's), and request failures with `alertTexts`, all from `src/utils/testing/fieldErrors.ts`. Never read them by a color class (`.text-error`) or through `getElementById(aria-describedby)`: a field error is the invalid control's error description, a request failure is a `role="alert"`, and a control with a hint is described by two ids.
- Find a control by `accessibleName` from `src/utils/testing/accessibleName.ts`, never by its `textContent`: a `Button` keeps its pending and done labels in the DOM, hidden, so its text reads "Copy codeCopied".
- A color or series cap is a design value, not behavior. Assert which role a series gets through the constants (`chartColor(rank)`, `OTHERS_COLOR`, `CHART_UP`) and size fold tests from `CHART_SERIES_LIMIT`; to test a color transform (brightening, mixing), pass fixed input colors. A palette hex or a literal cap in a test fails on every palette change and catches nothing.
- A test of an action that removes, swaps or disables the focused control asserts where focus lands, and covers the opposite edge: the last item removed, the only row, the end page.
- Tests read results through the public API, never through getters that expose internal state.

## One owner per behavior

- Write one test per behavior, named in user or data terms for what it asserts.
- Each behavior has one test that owns it, at the strongest boundary that reaches it. A second layer needs a failure the first cannot catch; never repeat the same scenario at every layer it passes through.
- A negative test fails for the reason its name gives: a "rejects X" test goes red when the X guard is removed, and does not stay green because another guard also rejects it.
- Never write characterization tests that freeze current output, bugs included.
- A regression test fails on the code before the fix, for the reason the bug describes. Run it against the old code before landing the fix; a test that never failed proves nothing about the fix.
- When a change breaks a test without changing behavior, rewrite or delete the test. Never patch the assertion to match.
- When deleting a test file, account for each behavior it asserted: where it is now covered, or why it is intentionally untested.
- A function that only tests call is dead code: delete it with its tests. Exporting a pure function that production code also calls, so a test can reach it, is fine.
- A module may export a reset for its module-level state, such as a cache, so each test starts from a fresh runtime.

## Speed and act

- Keep every test under two seconds and every file under five. A test that needs longer sets its own timeout in the `test()` call and says why.
- Bound every wait on a promise a mock is expected to resolve, so a lost mock registration fails fast instead of hanging.
- In render tests, wrap every event, focus change and store write in `act`.
- In render tests, wait with `waitForUi` from `src/utils/testing/waitForUi.ts`, never `vi.waitFor`. Tests that render nothing, such as server routes and auth clients, use `vi.waitFor`.
- A regression test for async UI holds the response (a fixture that returns a promise the test resolves), so the intermediate state renders before React batches past it.
- happy-dom fires no `blur` or `focusout` when a focused element is removed or disabled, and it keeps focus on a disabled button. Chrome fires both events and drops focus to the page. Dispatch `focusout` with `relatedTarget: null` to act like Chrome, and assert `disabled` or `aria-disabled` rather than `document.activeElement`.
- The app runs in Strict Mode (`reactStrictMode: true`), which replays effects on mount. A test of an effect that consumes a one-shot request renders under `<StrictMode>`.
- React logs a warning for each update outside `act`, and those warnings can crash a CI worker at teardown. In agent shells Vitest uses its minimal reporter, which hides console output; run with `--silent=false --reporter=default` to see them.

## Clock and hydration

`renderHydrated` renders on the server at a stale clock and zone, then hydrates at the visitor's. Assert no hydration errors, then the displayed values after the live clock takes over, and that a reader's selection survives it. A component that hydrates cleanly can still freeze on the server's day.

- The helper gives both renders the same element. Build per-render state, such as a `QueryClient`, inside the tree: a shared instance hands the browser the server's cache and hides the mismatch.
- The rules the test proves are in `docs/date-formatting.md`, "Render clock and hydration".
