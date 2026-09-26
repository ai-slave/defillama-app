# Agent Commands and Conventions

This file defines the commands and working conventions that all AI agents must follow in this repository.

## Package Manager

- Use `bun` for all package management and project commands, and `bunx` to run a package binary.
- Do not use `npm`, `npx`, `yarn`, or `pnpm`.

## Approved Commands

- Format code with `bun run format`
- Run tests with `bun run test`
- Run lint checks with `bun run lint`
- Run TypeScript checks with `bun run typecheck`

## Forbidden Commands

- Do not run `bun run build` or any other build command. Builds are expected to fail because of API rate limits.
- Do not use `bun test`. Use `bun run test` so tests run through the repo's Vitest script.

## Verification

During implementation, run only the smallest targeted test or check that proves the requested change. Do not run repo-wide format, lint, typecheck, or test commands after every intermediate edit.

Subagents and review agents must not run repo-wide verification commands. They should report relevant targeted verification to the coordinating agent.

For multi-agent work, only the coordinating agent may run broad verification, and only after all implementation and review agents have finished and their changes have been integrated. Do not run write-formatting commands while another agent is still working.

Run the full verification sequence only when:

- The user explicitly requests CI or full verification.
- Preparing a user-requested commit or pull request.
- The coordinating agent determines the change is broad enough that targeted checks cannot reasonably validate it.

The full verification sequence is:

1. `bun run format`
2. `bun run lint`
3. `bun run typecheck`
4. `bun run test:typecheck`

`bun run format` must finish before the other checks because it writes files. After formatting completes, `bun run lint`, `bun run typecheck`, and `bun run test:typecheck` may be run in parallel.

Do not run the full verification sequence for documentation-only or instruction-only edits unless the user explicitly asks.

If the user asks to run specific commands, run only those commands unless code changes are needed to complete the request.

Before finalizing without full verification, state which targeted checks ran and which broader checks were skipped.

## Testing Policy

A test calls the code the way its users do and asserts what they observe against a literal expected value. It fails when a user-visible or data-visible behavior breaks and stays green through refactors that keep that behavior.

The check: would the test still pass if every function it imports returned `undefined`? If yes, it observes no behavior. Rewrite the assertion or delete the test. Shapes that fail the check: no assertion or only `toBeDefined`/`toBeTruthy`/`not.toThrow`; only mock-call or absence assertions; an expected value computed by the code under test; restating a constant, config default, or prompt string; asserting data the test built itself.

Where to test:

- Decision logic lives in pure functions and is tested there: real input in, literal output out. When logic that needs a test is buried in a component, hook, or route, move it into a pure function first. This is the default and the fastest test.
- Render a component only for interaction contracts: focus, dialogs, keyboard, races, cancellation, access gating, what a user sees after acting. Use the real component tree and act as a user would.
- Route contracts: run the real `getServerSideProps` or API handler against `fetch` fixtures and assert status, headers, redirect, and returned data.

Put a test file in the `__tests__/` folder beside the code it tests. Fixtures and factories that only one folder's tests use sit in that `__tests__/` folder without a `.test` suffix. Helpers shared across features live in `src/utils/testing/`, and their own tests follow the same rule.

Mock only at boundaries: `fetch` (`installFixtureFetch` from `src/utils/testing/fixtureFetch.ts`), dataset snapshot store adapters (`*/server/dataset.server.ts`), database clients, `~/utils/cache-client`, `~/utils/http-client`, `~/utils/async` (`fetchJson`), `~/utils/apiAuth`, clocks, `next/router`, and browser or third-party APIs that cannot run in Node. Seed metadata with `installMetadataSeeder` from `src/utils/testing/metadataCache.ts` instead of mocking `~/utils/metadata`. A test may stub a heavy child component when it asserts nothing about that child's output. Do not `vi.mock` any other module under `src/`. A test that needs a hand-written fake of a library (ECharts, an editor) to reach its assertion is testing logic that belongs in a pure function; extract it.

Do not assert calls between internal modules, class names, inline styles, wrapper nesting, exact HTML, snapshots, or "renders without crashing". Call assertions are allowed only for `fetch`, navigation, emitted events, and callbacks the test supplies. Accessibility semantics (labels, roles, focus, expanded state) are behavior.

One test per behavior, named in user or data terms. No characterization tests that freeze current output, bugs included. When a change breaks a test without changing behavior, rewrite or delete the test instead of patching the assertion. When deleting a test file, account for each behavior it asserted: where it is now covered, or why it is intentionally untested.

Each behavior has one test that owns it, at the strongest boundary that reaches it. Do not repeat the same scenario at every layer it passes through; a second layer needs a failure the first cannot catch. Name a test for what it asserts, and make a negative test fail for the reason its name gives: a "rejects X" test must go red when the X guard is removed, not stay green because another guard also rejects it.

A regression test must fail on the code before the fix, for the reason the bug describes. Run it against the old code before landing the fix; a test that never failed proves nothing about the fix.

When code reads a value that other code writes (URL query params, storage, API payloads), test the round trip through the real writer instead of hand-writing what the reader receives. Readers that copy an old encoding drift silently when the writer changes.

A function that only tests call is dead code: delete it with its tests. Exporting a pure function that production code also calls, so a test can reach it, is fine. A module may also export a reset for its module-level state, such as a cache, so each test starts from a fresh runtime. Tests read results through the public API, not through getters that expose internal state.

Keep every test under two seconds and every file under five. A test that needs longer sets its own timeout in the `test()` call and says why. Never wait on a promise a mock is expected to resolve without bounding it; a lost mock registration must fail fast, not hang.

## Metric Semantics

Before changing metric routes, chart queries, metadata flags, public API validation, or adapter data types, read `docs/metrics.md`.

`public/pages.json` contains product-facing page definitions. `docs/metrics.md` documents implementation semantics and overloaded terminology that can affect code paths.

## Chart Data Readers

- ECharts tooltip formatters read series values and timestamps through `src/components/ECharts/shared/tooltip.ts` (`getTooltipRawYValue`, `getTooltipAxisValue`). Do not index `params.value` or `params.data` by position or by series name.
- Formatter params are typed `unknown`, so type errors do not reveal readers that a chart data layout change breaks. Before changing a chart dataset's row layout, search for every reader of the old layout (for example `data[seriesName]`, `seriesName in data`, `.value[1]`). Migrate each reader or confirm it is unaffected before the change is done.
- Test a custom formatter with real builder output that has at least two series with different values, and confirm the test fails without the fix.
- Before grouping chart data by week, month, quarter, or year, follow "Grouped chart periods" in `docs/date-formatting.md` and reuse its shared formatters instead of writing a local bucketing loop.

## Filter Pickers

- Filter pickers read and write the page URL only through `src/components/Select/query.ts`; its header lists the rules. Pass a picker its URL keys and options and let it read its own selection; filter rows, requests and exports with `readSelectionFromQuery`, on the client and the server alike.

## Local User Instructions

If `.codex/local-instructions.md` exists, read and follow it before making code changes. It contains local user preferences and skill routing, and is intentionally gitignored.
