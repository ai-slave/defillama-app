/**
 * Maintains the accepted React Compiler debt, so a component that compiles today cannot quietly stop.
 *
 * The compiler is not a linter: a single unsupported expression makes it skip a whole component, and
 * nothing else notices. A component that skips is not memoized, and nothing downstream of it is cached
 * either, without any failing check.
 *
 * The committed file is .reactcompiler.baseline.json: bailouts per file per reason, one line per file.
 * It records what still fails, so the rest is protected. The count helpers live in
 * scripts/lib/compilerBaselineCounts.ts.
 *
 *   bun run compiler:baseline
 *     Recompile every non-test .ts/.tsx under src (about a minute) and rewrite the counts.
 *
 *   bun run compiler:baseline:check [-- --base <git ref>]
 *     Fail if the committed counts are stale, if the working tree bails more than recorded for any
 *     file/reason, or if the committed counts accept more than the same file on <git ref>
 *     (default origin/main, skipped when the ref has no counts file). CI runs it; `bun run check` does not.
 *
 * Both modes refuse to run on an incomplete report. A file the compiler cannot parse emits BABEL
 * FAILED and no bailout lines, so counting it as clean would turn a fatal error into a passing check.
 *
 * Every count is a floor. The compiler stops at the first unsupported expression in a component, so the
 * baseline records the reason it reported, not every reason the component has.
 * - Fixing the recorded bailout can reveal another underneath. Judge a fix by the components that newly
 *   compile, not by the change in the total.
 * - The ratchet cannot express "same file, still broken, different first reason". Revert the fix until the
 *   blocking rule is in scope; never add an allowance to quiet the check.
 *
 * Working with the compiler:
 * - Fix a bailout at the line the checker's BAILOUT output names. It prints the expression's own location
 *   when the diagnostic has one, and the enclosing function otherwise.
 * - A file that stops bailing has started compiling. Verify its newly memoized reads stay reactive before
 *   regenerating the baseline.
 * - Hoisting an impure helper to module scope changes what the compiler may cache, even when it captures no
 *   local variables. A clock-reading helper hoisted out of a component makes its label go stale, and neither
 *   the type checker nor this baseline sees it.
 * - When a bailout is required for correctness, say why at the line so later edits keep it.
 *
 * Two traps when running the checker directly, both of which produce false clean runs:
 * - scripts/reactCompilerCheck.cjs takes the repo root as its first argument. Passing only a file checks
 *   nothing and exits 0. Run `node scripts/reactCompilerCheck.cjs . <files>` and expect a
 *   `<file>: compiled N [...]` line for every file.
 * - The compiler visits only components and real hooks. A plain function whose name starts with `use` but
 *   calls no hooks is never compiled, so probing the checker with one proves nothing.
 *
 * This script parses the checker's stdout (the `compiled`, `BAILOUT`, `SKIPPED` and `BABEL FAILED` lines).
 * A format change there can empty the counts without failing, so change both scripts together and rerun
 * `bun run compiler:baseline` before trusting the diff.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Counts, findGrowth, findStale, parseCounts, renderCounts, total } from './lib/compilerBaselineCounts'

const COUNTS_PATH = '.reactcompiler.baseline.json'
const SKIP_REASON = 'Skipped by directive'
const LIBRARY_REASON = 'Use of incompatible library'

/**
 * Reasons a new entry is expected rather than a regression, so the growth check against the base ref
 * ignores them. Both still fail the working-tree check until the baseline is regenerated, which keeps
 * every new entry a visible diff and a review decision.
 *
 * `Skipped by directive` is an opt-out somebody chose, such as `'use no memo'` in VirtualTable.
 * `Use of incompatible library` fires where a React Virtual hook is called
 * (UnifiedVirtualTable, useVirtualItems), the same deferred decision as `react/incompatible-library: "off"`
 * in .oxlintrc.json. A new virtualized list trips it with no fix available, so it is not new debt.
 *
 * Staleness is deliberately not exempt. A file that stops bailing on the library has started compiling,
 * and a read from a stable object such as the virtualizer can land in a cache guard keyed on that
 * object's identity and freeze.
 */
const GROWTH_EXEMPT_REASONS = [SKIP_REASON, LIBRARY_REASON]

function sourceFiles(dir = 'src'): Array<string> {
	const out: Array<string> = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) {
			if (entry.name === '__tests__' || entry.name === 'node_modules') continue
			out.push(...sourceFiles(path))
			continue
		}
		if (!/\.tsx?$/.test(entry.name) || /\.(test|spec)\.tsx?$/.test(entry.name)) continue
		out.push(path)
	}
	return out
}

interface Report {
	counts: Counts
	/** Files the compiler could not parse at all. A count of zero bailouts would be a lie for these. */
	babelFailures: Array<string>
	/** Files that produced no line of report. Silence must not read as success. */
	missing: Array<string>
}

/** Runs the shared checker so the compile options stay in one place, and reads its report. */
function collect(): Report {
	const files = sourceFiles()
	const result = spawnSync('node', ['scripts/reactCompilerCheck.cjs', '.', ...files], {
		encoding: 'utf8',
		maxBuffer: 256 * 1024 * 1024
	})
	if (result.error) throw result.error
	const counts: Counts = {}
	const babelFailures: Array<string> = []
	const reported = new Set<string>()
	let file: string | null = null
	for (const line of result.stdout.split('\n')) {
		const failed = /^(\S+): BABEL FAILED (.+)$/.exec(line)
		if (failed) {
			babelFailures.push(`${failed[1]}  ${failed[2]}`)
			reported.add(failed[1])
			file = null
			continue
		}
		const header = /^(\S+): compiled \d+/.exec(line)
		if (header) {
			file = header[1]
			reported.add(file)
			continue
		}
		// SKIPPED lines are directive opt-outs. Recording them alongside bailouts means deleting a
		// directive shows up as a stale entry rather than as a component that quietly starts compiling.
		const bailout = /^ {2}(?:BAILOUT|SKIPPED) \S+: (.+)$/.exec(line)
		if (!bailout || !file) continue
		// Counts are rule-major in memory; renderCounts transposes them to one line per file on disk.
		const reason = bailout[1]
		counts[reason] ??= {}
		counts[reason][file] = (counts[reason][file] ?? 0) + 1
	}
	return { counts, babelFailures, missing: files.filter((f) => !reported.has(f)) }
}

/** Both of these mean the report cannot be trusted, so neither mode may proceed on it. */
function assertReportComplete({ babelFailures, missing }: Report): void {
	if (babelFailures.length > 0) {
		report(
			`${babelFailures.length} file(s) failed to compile. Fix them; a file that cannot be parsed reports no bailouts.`,
			babelFailures
		)
	}
	if (missing.length > 0) {
		report(`${missing.length} file(s) produced no report line. The checker did not finish.`, missing)
	}
	if (babelFailures.length > 0 || missing.length > 0) process.exit(1)
}

function readCommittedCounts(): Counts {
	return parseCounts(readFileSync(COUNTS_PATH, 'utf8'))
}

function readBaseCounts(ref: string): Counts | null {
	const result = spawnSync('git', ['show', `${ref}:${COUNTS_PATH}`], { encoding: 'utf8' })
	if (result.status !== 0) return null
	return parseCounts(result.stdout)
}

/** findGrowth renders entries as `<reason>  <file>  <before> -> <after>`. */
function isGrowthExempt(entry: string): boolean {
	return GROWTH_EXEMPT_REASONS.some((reason) => entry.startsWith(`${reason}  `))
}

function report(title: string, lines: Array<string>): void {
	console.error(title)
	for (const line of lines.slice(0, 50)) console.error(`  ${line}`)
	if (lines.length > 50) console.error(`  ... and ${lines.length - 50} more`)
}

const args = process.argv.slice(2)

if (args.includes('--check')) {
	const committed = readCommittedCounts()
	const report_ = collect()
	assertReportComplete(report_)
	const fresh = report_.counts
	let failed = false

	const stale = findStale(committed, fresh)
	if (stale.length > 0) {
		report(
			`Baseline records ${stale.length} file/reason entr(ies) that no longer bail. Those components now compile: check that their reads stay reactive, then run \`bun run compiler:baseline\` and keep the diff. Rules: the header of scripts/compilerBaseline.ts.`,
			stale
		)
		failed = true
	}

	const hidden = findGrowth(committed, fresh)
	if (hidden.length > 0) {
		const expected = hidden.every((entry) => isGrowthExempt(entry))
		report(
			expected
				? `${hidden.length} file/reason entr(ies) bail more than the baseline records, all for expected reasons. Run \`bun run compiler:baseline\` and keep the diff in the change.`
				: `${hidden.length} file/reason entr(ies) bail more than the baseline records. A component stopped compiling: run \`node scripts/reactCompilerCheck.cjs . <file>\` and fix the expression its BAILOUT line names instead of regenerating. Rules: the header of scripts/compilerBaseline.ts.`,
			hidden
		)
		failed = true
	}

	const baseIndex = args.indexOf('--base')
	const baseRef = baseIndex === -1 ? 'origin/main' : args[baseIndex + 1]
	const base = readBaseCounts(baseRef)
	if (base === null) {
		console.log(`No ${COUNTS_PATH} on ${baseRef}; skipping the growth check against it.`)
	} else {
		const grown = findGrowth(base, committed).filter((entry) => !isGrowthExempt(entry))
		if (grown.length > 0) {
			report(
				`Baseline accepts ${grown.length} file/reason entr(ies) of new debt relative to ${baseRef}. Fix the bailouts instead of regenerating. Rules: the header of scripts/compilerBaseline.ts.`,
				grown
			)
			failed = true
		}
	}

	if (failed) process.exit(1)
	console.log('Compiler baseline is tight.')
} else {
	const report_ = collect()
	assertReportComplete(report_)
	const fresh = report_.counts
	writeFileSync(COUNTS_PATH, renderCounts(fresh))
	const { rules, files, violations } = total(fresh)
	// Split the total, because the two halves mean different things: one is a burn-down list, the other
	// a register of components the deferred TanStack rule keeps out of the compiler.
	let accepted = 0
	for (const reason of GROWTH_EXEMPT_REASONS) {
		for (const file in fresh[reason]) accepted += fresh[reason][file]
	}
	console.log(`Wrote ${COUNTS_PATH}: ${files} files, ${violations} bailouts across ${rules} reasons.`)
	console.log(`${violations - accepted} to burn down; ${accepted} accepted (${GROWTH_EXEMPT_REASONS.join(', ')}).`)
}
