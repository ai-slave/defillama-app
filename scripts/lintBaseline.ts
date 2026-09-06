/**
 * Maintains the accepted lint debt so `bun run lint` stays green while it burns down.
 *
 * The committed file is .oxlintrc.baseline.counts.json: violations per file per rule, one line per file.
 * .oxlintrc.baseline.json is derived from it and gitignored; it turns each rule off in the files that
 * still violate it, and is what `bun run lint` hands to oxlint.
 *
 *   bun scripts/lintBaseline.ts
 *     Regenerate the counts from the current violations, then emit the oxlint config.
 *
 *   bun scripts/lintBaseline.ts --emit
 *     Emit the oxlint config from the committed counts without linting. `bun run lint` runs this first.
 *
 *   bun scripts/lintBaseline.ts --check [--base <git ref>]
 *     Fail if the committed counts are stale (record debt that no longer exists), if the working tree has
 *     more violations than recorded for any rule/file, or if the committed counts accept more debt than
 *     the same file on <git ref> (default origin/main, skipped when the ref has no counts file).
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import {
	type Counts,
	countViolations,
	type Diagnostic,
	findGrowth,
	findStale,
	parseCounts,
	renderBaseline,
	renderCounts,
	total
} from './lib/lintBaseline'

const BASELINE_PATH = '.oxlintrc.baseline.json'
const COUNTS_PATH = '.oxlintrc.baseline.counts.json'

function collectFreshCounts(): Counts {
	// Lint against the hand-written config only, so the current baseline does not hide anything.
	const result = spawnSync('./node_modules/.bin/oxlint', ['-c', '.oxlintrc.json', '--format=json'], {
		encoding: 'utf8',
		maxBuffer: 256 * 1024 * 1024
	})
	if (result.error) throw result.error
	const { diagnostics } = JSON.parse(result.stdout) as { diagnostics: Array<Diagnostic> }
	return countViolations(diagnostics)
}

function readIgnorePatterns(): Array<string> {
	// .oxlintrc.json is JSONC with full-line comments only.
	const text = readFileSync('.oxlintrc.json', 'utf8').replace(/^\s*\/\/.*$/gm, '')
	return (JSON.parse(text) as { ignorePatterns: Array<string> }).ignorePatterns
}

function readCommittedCounts(): Counts {
	return parseCounts(readFileSync(COUNTS_PATH, 'utf8'))
}

function readBaseCounts(ref: string): Counts | null {
	const result = spawnSync('git', ['show', `${ref}:${COUNTS_PATH}`], { encoding: 'utf8' })
	if (result.status !== 0) return null
	return parseCounts(result.stdout)
}

function emit(counts: Counts): void {
	writeFileSync(BASELINE_PATH, renderBaseline(counts, readIgnorePatterns()))
}

function report(title: string, lines: Array<string>): void {
	console.error(title)
	for (const line of lines.slice(0, 50)) console.error(`  ${line}`)
	if (lines.length > 50) console.error(`  ... and ${lines.length - 50} more`)
}

const args = process.argv.slice(2)

if (args.includes('--emit')) {
	emit(readCommittedCounts())
} else if (args.includes('--check')) {
	const committed = readCommittedCounts()
	const fresh = collectFreshCounts()
	let failed = false

	const stale = findStale(committed, fresh)
	if (stale.length > 0) {
		report(
			`Baseline records ${stale.length} rule/file entr(ies) with more debt than exists. Run \`bun run lint:baseline\`.`,
			stale
		)
		failed = true
	}

	const hidden = findGrowth(committed, fresh)
	if (hidden.length > 0) {
		report(
			`${hidden.length} rule/file entr(ies) have more violations than the baseline records. Fix them; do not regenerate.`,
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
		const grown = findGrowth(base, committed)
		if (grown.length > 0) {
			report(
				`Baseline accepts ${grown.length} rule/file entr(ies) of new debt relative to ${baseRef}. Fix the violations instead.`,
				grown
			)
			failed = true
		}
	}

	if (failed) process.exit(1)
	console.log('Baseline is tight.')
} else {
	const fresh = collectFreshCounts()
	writeFileSync(COUNTS_PATH, renderCounts(fresh))
	emit(fresh)
	const { rules, files, violations } = total(fresh)
	console.log(`Wrote ${COUNTS_PATH}: ${rules} rules, ${files} files, ${violations} violations.`)
}
