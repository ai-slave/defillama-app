# Agent instructions

## Commands

- Use `bun` for package management and project commands, and `bunx` to run a package binary. Never use npm, npx, yarn or pnpm.
- Run tests with `bun run test <path>`. Never use `bun test`: it runs Bun's own runner, not the repo's Vitest setup.
- Never run `bun run build` or any other build. Builds fail on API rate limits.
- The pre-commit hook formats and lints staged files and runs the date, number, hydration, column-picker and image-size policies on staged `src/` files.
- `bun run check` runs what the hook does not: the whole-tree format check, typecheck, test:typecheck, and the design-token, color-contrast and focus-handoff policies.
- While working, run only the targeted tests and checks that prove the change. Never rerun repo-wide checks after every intermediate edit.
- Targeted tests include every test that imports a changed module, found by grepping importers across `src/`, not only the changed folder.
- Run `bun run typecheck` and `bun run test:typecheck` even when test runs are skipped. `tsgo` takes seconds, and CI fails a branch that skipped it.
- Run `bun run check` before a commit or PR the user asked for, when the user asks for full verification, or when targeted checks cannot cover the change. Skip it for documentation-only edits unless the user asks.
- When the user names the commands to run, run only those, unless a code change is needed to finish the request.
- Subagents and review agents run only targeted checks and report them to the coordinating agent.
- The coordinating agent runs broad checks once, after every implementation and review agent has finished and their changes are integrated. Never run `bun run format` or another writing command while another agent is still working.
- When finishing without `bun run check`, say which checks ran and which were skipped.
- After pushing, wait for CI and fix what fails. CI also runs whole-tree lint, every policy, the React Compiler baseline and the full test suite.
- Never commit screenshots or images only to illustrate a PR.

## Always

- Before editing a folder, read the nearest `README.md` in it or its parents.
- When fixing a reported problem, also fix what allowed it: the rule where it lives (design.md, a component header, a folder README), a shared `src/ui` component, or a policy check when the rule is mechanical. A fix at one call site leaves the same mistake on the next page.
- Report a bug, UX gap or review finding only with the user who meets it: the page, the steps that reproduce it, what they see, and what it costs them. An edge no real flow reaches is not a finding, nor is one that costs a keystroke and leaves the user in place. Behavior a comment calls deliberate is not a finding unless the report shows that cost.
- A change that touches a file brings every render branch in it (empty, error, pending, success, blocked, expired) onto the current recipes, and each of those states is looked at, not only the path that changed.
- `tsconfig.json` has `strict: false`, so a property missing from one member of a union still typechecks. After adding a field to a function with several `return {`, check every return.
- A codemod that rewrites source parses it with the TypeScript AST and edits only the nodes it means to. Regex matching is for read-only audits: regex literals and apostrophes make a pattern span code.
- The repo holds no plans, audits, progress notes or roadmaps. Docs state product and code rules; comments, commits and PR titles never cite plan or phase labels.
- Look at UI work in the browser only when the user asks for a browser check. Then check desktop width and the 375px mobile preset, plus dark mode when the change touches colors, tokens or surfaces. Otherwise rely on tests and typecheck, and say the browser check was skipped.

## Code

- Write simple, skimmable TypeScript: fewer lines, fewer states, direct transforms, no clever abstractions.
- Comments explain why: a business rule, a data invariant, a performance choice or non-obvious control flow. Never restate what the code says.
- Trust TypeScript types and API contracts. Add runtime validation, `unknown` parsing, `Number.isFinite`, type guards, fallback coercion, try/catch fallbacks or defensive empty states only for untyped user input or where existing code already requires them. Before adding a defensive check, name the exact bad input it protects against.
- Handle a failure only when a supported environment can produce it. Before adding an error path, find what throws and whether a real user can reach it. A failure that only a test stub or an unsupported setup produces gets no handling.
- Prefer direct property access, simple loops, early returns, required parameters, asserts for data expected to exist, discriminated unions and exhaustive handling. Avoid generic normalizers, adapters, optional arguments for required values, override objects, and label-to-backend key remapping.
- Do not add a function, hook, component, constant or type whose only job is to rename, forward to, or pin the arguments of another one. Import and call the original, and keep one name for one thing. A wrapper earns its place when it owns something: cache policy, a domain meaning, a test-mocked boundary, or config shared by several callers. A memo-only hook also stays when React Compiler would not cache the call inlined: read the compiled caller for a cache guard around the call, because a component that compiles can still leave one call uncached.
- Before adding a prop, flag, ref, state, metadata field or helper to carry a value, check whether the value can travel with its data, whether an existing state can be redefined, or whether a convention the app already uses removes the need. One variable does one job. Search for how the app already solves the same shape and follow it.
- Write a short constant list out entry by entry. Map a literal list only when the markup each entry repeats outweighs the list, and never to copy objects into the same shape or to index a parallel array.
- In large-dataset transforms, make one pass with plain loops. Avoid chained array methods, `Object.*` enumeration and `reduce` with spreads there. Use `Map` or `Set` only when it reduces total work.
- Before coding a bug fix or behavior change, state the clean behavior model: what is intentional and what is accidental, the invariants to keep, and the likely opposite-edge regression. Make the smallest cohesive change, and test the original bug plus the opposite edge when relevant.

## Before you change it, read

| When you                                                                                            | Read first                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Add or change UI, or style anything                                                                 | `design.md` "Which component for which job", then the component's header comment                              |
| Write, change or delete a test                                                                      | `docs/testing.md`                                                                                             |
| Write or remove an effect                                                                           | `docs/effects.md`                                                                                             |
| Remove, replace or disable a focused control, retry a request, or hold a draft in a dialog          | `docs/focus-and-errors.md`                                                                                    |
| Format a date, read the clock, or render anything that depends on zone or locale                    | `docs/date-formatting.md`                                                                                     |
| Draw a chart, write a tooltip formatter, group by period, add a filter picker, or build a chart CSV | `docs/charts.md`                                                                                              |
| Change metric routes, chart queries, metadata flags, public API validation or adapter data types    | `docs/metrics.md` for implementation semantics; `public/pages.json` holds the product-facing page definitions |
| Add, rename or remove an analytics event, or add an A/B experiment                                  | `docs/analytics.md`                                                                                           |
| Debug a value an API returns, or find the repo behind an upstream URL                               | `README.md` "Where the data comes from"                                                                       |
| Add a dataset snapshot, a server or result cache, or a server-paginated table                       | `docs/server-data.md`                                                                                         |
