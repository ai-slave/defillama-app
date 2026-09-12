# Lint and React Compiler checks

`bun run lint` runs plain Oxlint against `.oxlintrc.json`. CI and the pre-commit hook use the same
rule set. The lint baseline and its file-wide overrides have been retired.

`react/no-array-index-key` remains an error. Editable rows retain local creation-time IDs; persisted
records use domain identity. Intentional display slots carry a narrowly scoped inline exception
explaining their lifecycle. Table callers explicitly opt into occurrence keys when source identity
is unavailable; those keys cannot track distinct duplicate records swapping positions.

Still awaiting a decision: `eslint/no-console` needs a logger call, and the five type-aware rules at
`warn` need the strict-types migration and a decision on CI cost.

## The React Compiler baseline

`bun run compiler:baseline:check` is the ratchet for compiler bailouts. It exists because a component
that stops compiling fails nothing: it simply stops being memoized, and nothing downstream of it is
cached either. That is how `AgenticChat` went its whole life without compiling.

Its count helpers live in `scripts/lib/compilerBaselineCounts.ts`. `.reactcompiler.baseline.json` records bailouts per file per reason, one
line per file; the check fails if a file bails more than recorded, if the record is stale, or if the
committed record accepts more than `origin/main` does. Regenerate with `bun run compiler:baseline`. A
full run recompiles every non-test `.ts`/`.tsx` under `src` and takes about a minute.

Two reasons are exempt from the growth check against the base ref, because a new entry for either is
expected rather than a regression: `Skipped by directive`, which somebody chose, and
`Use of incompatible library`, which still applies to React Virtual hooks. Native TanStack Table v9
uses reactive subscriptions and no longer needs the v8 `useReactTable` bailout. Both still
fail the working-tree check until the baseline is regenerated, so every new entry stays a visible diff
and a review decision.

Staleness is deliberately not exempt. A file that stops bailing has started compiling, so verify
that its newly memoized reads remain reactive before regenerating the baseline.

Regeneration prints accepted reasons separately from the remaining compiler bailouts. Read current
counts from the baseline rather than treating historical totals as the current state.

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

The v8 table renderer exposed this problem: compiling reads against stable table and row objects
froze sorting, filtering, replaced data, and column visibility. The incompatible-library bailout
at the hook call site did not protect nested components receiving those objects as props.

Native Table v9 uses reactive subscriptions. Keep these rules when changing table rendering:

- Put `Subscribe` inside the component that reads state from stable row, cell, column, or core
  table objects. Keep state-dependent reads inside its render callback. When using `useSelector`,
  render from the selected result or pass it to children as a prop.
- Test store-state changes and columns-only option changes under the compiler. Sorting, filtering,
  visibility, pagination, replaced data, and same-ID column formatter changes must update the UI.
  The shared table regression fixtures run both with and without the compiler.
- Keep React Virtual exceptions separate from Table state subscriptions. The remaining virtualizer
  bailouts do not justify adding directives to table-only components.
- Record intentional opt-outs in the baseline. Removing a directive makes its entry stale;
  regenerate only after verifying that the newly compiled component still behaves correctly.

When another bailout is required for correctness, explain why at the line so future edits preserve
that behavior.

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
