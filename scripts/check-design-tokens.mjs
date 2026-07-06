// Design-token ratchet (see design.md → Do's and Don'ts).
//
// Counts styling patterns that bypass the Llama Design System tokens and
// compares them against scripts/design-token-baseline.json. Existing debt is
// allowed; the check fails only when a count INCREASES — burn-down lowers the
// baseline automatically when run with --update.
//
//   bun run lint:tokens            # check
//   bun run lint:tokens --update   # rewrite baseline after removing debt
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const BASELINE_PATH = path.join(import.meta.dirname, 'design-token-baseline.json')

const RULES = [
	{
		id: 'hex-in-classname',
		description: 'hardcoded hex color in a utility class (use a token: bg-surface, text-data-up, …)',
		pattern: /(?:text|bg|border|from|to|via|fill|stroke|ring|shadow|outline|decoration|accent|caret)-\[#[0-9a-fA-F]/g
	},
	{
		id: 'dark-hex-variant',
		description: 'dark:*-[#hex] mode fork (tokens flip via html.dark; no per-component dark hex)',
		pattern: /dark:[a-zA-Z-]*-\[#[0-9a-fA-F]/g
	},
	{
		id: 'arbitrary-font-size',
		description: 'arbitrary font size (use the type ramp: label-sm, body-xs, …)',
		pattern: /text-\[(?:\d+(?:\.\d+)?px|0?\.\d+rem)\]/g
	}
]

const files = execSync('git ls-files -- "src/**/*.tsx" "src/**/*.ts"', { cwd: ROOT, encoding: 'utf8' })
	.split('\n')
	.filter(Boolean)

const counts = Object.fromEntries(RULES.map((r) => [r.id, 0]))
const offenders = Object.fromEntries(RULES.map((r) => [r.id, new Map()]))

for (const file of files) {
	const content = fs.readFileSync(path.join(ROOT, file), 'utf8')
	for (const rule of RULES) {
		const matches = content.match(rule.pattern)
		if (matches) {
			counts[rule.id] += matches.length
			offenders[rule.id].set(file, matches.length)
		}
	}
}

if (process.argv.includes('--update')) {
	fs.writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, '\t') + '\n')
	console.log('baseline updated:', counts)
	process.exit(0)
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
let failed = false

for (const rule of RULES) {
	const now = counts[rule.id]
	const was = baseline[rule.id] ?? 0
	const status = now > was ? 'FAIL' : now < was ? 'improved' : 'ok'
	console.log(`${status.padEnd(9)} ${rule.id}: ${now} (baseline ${was})`)
	if (now > was) {
		failed = true
		console.log(`  ${rule.description}`)
		const top = [...offenders[rule.id].entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
		for (const [file, n] of top) console.log(`    ${n}\t${file}`)
	} else if (now < was) {
		console.log(`  run \`bun run lint:tokens --update\` to lock in the improvement`)
	}
}

process.exit(failed ? 1 : 0)
