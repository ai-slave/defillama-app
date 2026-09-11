# Lint and React Compiler ratchets

Two ratchets keep quality debt from growing: one for oxlint violations, one for React Compiler
bailouts. CI runs both. This note covers how they work and the lessons that are not obvious from
reading the scripts. Per-rule decisions live in `.oxlintrc.json`, next to the rule.

## The lint ratchet

- `.oxlintrc.json` is the hand-written rule set. A rule that is off carries a comment saying why and
  what would re-open it.
- `.oxlintrc.baseline.counts.json` is the only committed generated file: violations per file per rule,
  one line per file, so fixing a file changes one line. `bun run lint:baseline` regenerates it. It is
  marked `linguist-generated`, so GitHub collapses it in diffs.
- `.oxlintrc.baseline.json` is derived from the counts by `bun scripts/lintBaseline.ts --emit`, which
  `bun run lint` and the pre-commit hook run first. It is gitignored. It turns each rule off in the
  files that violate it, so oxlint passes.
- `bun run lint:baseline:check` fails when the working tree has more violations than recorded for any
  rule/file, when a recorded entry is stale, or when the committed counts accept more debt than the
  same file on `origin/main`. CI passes `--base origin/main`. Regenerating can therefore only shrink
  the baseline.
- Every source file is in scope. Scope is narrowed by rule, never by path.

**What is left:** `react/no-array-index-key`, 116 violations across 73 files. That is the whole
baseline. When it reaches zero the baseline file, `scripts/lintBaseline.ts`, `scripts/lib/lintBaseline.ts`,
`scripts/lintBaseline.test.ts`, the `lint:baseline*` scripts and the CI step can all be deleted, and
`bun run lint` becomes plain `oxlint`. A rule nobody intends to fix belongs off in `.oxlintrc.json`
with a reason, not in a 73-file ledger.

Still awaiting a decision, and not lint decisions: `eslint/no-console` (299 hits) needs a logger call,
and the five type-aware rules sitting at `warn` need both the strict-types migration and a ruling on
whether CI can afford type-aware linting.

## The React Compiler baseline

`bun run compiler:baseline:check` is the ratchet for compiler bailouts. It exists because a component
that stops compiling fails nothing: it simply stops being memoized, and nothing downstream of it is
cached either. That is how `AgenticChat` went its whole life without compiling.

It mirrors the lint ratchet — `.reactcompiler.baseline.json` records bailouts per file per reason, one
line per file; the check fails if a file bails more than recorded, if the record is stale, or if the
committed record accepts more than `origin/main` does. Regenerate with `bun run compiler:baseline`. A
full run recompiles every non-test `.ts`/`.tsx` under `src` and takes about a minute.

Two reasons are exempt from the growth check against the base ref, because a new entry for either is
expected rather than a regression: `Skipped by directive`, which somebody chose, and
`Use of incompatible library`, the deferred TanStack rule. That reason fires on every `useReactTable`
and `useVirtualizer` call site, so adding a table page tripped it with no fix available. Both still
fail the working-tree check until the baseline is regenerated, so every new entry stays a visible diff
and a review decision.

Staleness is deliberately not exempt. A file that stops bailing on the library has started compiling,
which for a component reading TanStack row or cell state is the failure below.

Of the 82 recorded bailouts, 79 are those two accepted reasons, so regeneration prints the split
rather than one total: what is left to burn down, and what is a register of components the deferred
rule keeps out of the compiler.

Two traps when working with the checker directly, both of which produced false clean runs:

- `scripts/reactCompilerCheck.cjs` takes the repo root as its first positional argument. Passing only
  a file checks nothing and exits 0. Always `node scripts/reactCompilerCheck.cjs . <files>`, and
  expect a `<file>: compiled N [...]` line for every file.
- The compiler only visits components and real hooks. A plain function whose name happens to start
  with `use` but which calls no hooks is never compiled, so probing the checker with one proves
  nothing.

### Every count is a floor, not a total

The compiler stops at the first unsupported expression in a component, so the baseline records the
reason it reported, not the reasons the component has. Fixing that one can reveal another underneath;
two of seventeen files in one sweep did exactly that. Three consequences:

- **Per-rule totals understate.** Treat every count as a floor.
- **A fix that "reveals" is progress on the file, not on the count.** Judge a sweep by components that
  newly compile, not by the delta in the total.
- **The ratchet cannot express "same file, still broken, different first reason".** That is a gap in
  the tool, not a false positive. Reverting the fix is the honest response until the blocking rule is
  in scope; do not add an allowance to make the check quiet.

### Some bailouts are load-bearing

A bailout can be the only thing keeping a component out of the compiler, and removing it is a
behaviour change even when the edit itself is a no-op.

`components/Table/Table.tsx` is the worked example. Its three `['--x' as string]` computed keys kept
`TableRow` and `VirtualTable` uncompiled. Rewriting them into the `{ '--x': v } as CSSProperties` form
used elsewhere is provably equivalent CSS — and it let both components compile, which cached
`instance.getRowModel()` against the instance identity and `row.getVisibleCells()` against the row
identity. TanStack keeps both objects stable while their state mutates, so the cached reads froze
after the first render: sorting and filtering stopped taking effect, replaced data kept its old
values, and hiding a column dropped its header while leaving the cells under the wrong headings. A
reviewer caught it in compiled browser fixtures; no unit test in the suite would have.

The compiler does not protect itself here because `instance` arrives as a **prop**. The
`Use of incompatible library` bailout fires on `useReactTable` and `useVirtualizer` call sites, so a
component handed a table object never trips it.

Three rules follow:

- Before removing a bailout from a file that reads TanStack row, cell, header or column state, check
  where that read ends up in the compiled output. `node scripts/reactCompilerCheck.cjs . <file>` says
  whether the component compiles; dumping the compiled code says whether the read landed inside an
  `if ($[n] !== x)` guard. A read in a cache guard against a stable-identity object is the bug.
- **There is already a convention, and it is a directive.** `PaginatedTable`, ProDashboard's
  `TableBody` and `MarketMakers/StickyTable` each open with `'use no memo'`, precisely because they
  take a table instance as a prop. Use it rather than inventing something.
  `containers/Investors/dashboards/aave/shared.tsx` had missed it and was a live bug on main; it now
  carries the directive. Two files in that group are fine for other reasons:
  `UnifiedTable/index.tsx` reads columns inside click handlers, which run after render and so must
  read fresh, and `Table/utils.ts` is a plain function the compiler never visits.
- **Opt-outs are recorded in the baseline.** `scripts/reactCompilerCheck.cjs` prints a `SKIPPED` line
  for a directive and `scripts/compilerBaseline.ts` records it as `Skipped by directive`. Deleting a
  directive makes its entry stale and fails the check, instead of quietly letting the component
  compile again. Adding one shows up as growth against `origin/main`.

When a bailout turns out to be load-bearing, keep it and say so at the line, so the next person to
tidy the expression knows what it is holding up.

### Read the line the checker gives you

The checker's `BAILOUT` line prints the expression's own location from the diagnostic, falling back to
the enclosing function when there isn't one. Three location guesses were wrong before this was
noticed, so prefer that line over reading the file for likely suspects.

`scripts/compilerBaseline.ts` parses that line. A format change there emptied the counts file to zero
on the next regeneration without failing — the two scripts are coupled by the checker's stdout, so
change them together and re-run `bun run compiler:baseline` before trusting a diff.

## Lessons about the rules themselves

- **A rule written for another tool can be wrong here.** `vitest/valid-expect` enforced Jest's
  `expect` arity, which Vitest widens with a message argument; `react/jsx-no-constructed-context-values`
  predates the React Compiler, which already memoizes those values. Check the emitted output or the
  library's own types before treating a count as debt.
- **"Captures no local variables" does not mean "safe to hoist".** Moving an impure helper to module
  scope changes what the compiler may cache. A clock-reading helper hoisted out of the alerts modal
  made its "next run" label go stale, and neither the type checker nor the compiler baseline saw it.
- **An effect may list a dependency it does not read.** That is how it re-runs when the value changes.
  `react/exhaustive-effect-dependencies` reports those as extra dependencies; removing one is a
  behaviour change, so they carry a disable naming the trigger.
