// Design-token ratchet (see design.md → Do's and Don'ts).
//
// Counts styling patterns that bypass the Llama Design System tokens and
// compares them against scripts/design-token-baseline.json. Core application
// debt and intentionally excluded product debt are ratcheted independently:
// excluded surfaces do not hide core regressions, and neither bucket may grow.
//
//   bun run lint:tokens            # check
//   bun run lint:tokens --update   # rewrite baseline after removing debt
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')
const BASELINE_PATH = path.join(import.meta.dirname, 'design-token-baseline.json')

const EXCLUDED_PRODUCT_PREFIXES = [
	'src/components/EntityQuestionsStrip/',
	'src/components/LlamaAIFloatingButton/',
	'src/components/Newsletter/',
	'src/components/SubscribeCards/',
	'src/containers/Account/',
	'src/containers/Articles/',
	'src/containers/Authors/',
	'src/containers/Downloads/',
	'src/containers/Investors/',
	'src/containers/LlamaAI/',
	'src/containers/ProDashboard/',
	'src/containers/Sheets/',
	'src/containers/Subscription/',
	'src/containers/Yields/',
	'src/pages/ai/',
	'src/pages/authors/',
	'src/pages/investors',
	'src/pages/pro/',
	'src/pages/protocol/yields/',
	'src/pages/research/',
	'src/pages/sheets/',
	'src/pages/subscription/',
	'src/pages/yields'
]

const EXCLUDED_PRODUCT_FILES = new Set([
	'src/components/Modal/LlamaAIWelcomeModal.tsx',
	'src/components/StripeCheckoutModal.tsx',
	'src/components/TopupModal.tsx',
	'src/pages/account.tsx',
	'src/pages/downloads.tsx',
	'src/pages/newsletters.tsx',
	'src/pages/pro.tsx',
	'src/pages/reports.tsx'
])

function isExcludedProductFile(file) {
	return EXCLUDED_PRODUCT_FILES.has(file) || EXCLUDED_PRODUCT_PREFIXES.some((prefix) => file.startsWith(prefix))
}

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
	},
	{
		id: 'arbitrary-spacing',
		description: 'arbitrary margin/padding/gap value (use the space palette: p-2, gap-4, … — see design.md)',
		// calc()/env()/min()/max()/var() are excluded: those express layout
		// relationships that cannot come from the palette.
		pattern: /(?<![a-zA-Z0-9-])-?(?:[mp][trblxyes]?|gap(?:-[xy])?|space-[xy])-\[(?!(?:calc|env|min|max|var)\()[^\]]+\]/g
	},
	{
		id: 'explicit-thin-scrollbar',
		description: 'nested scroll containers are thin globally; use no-scrollbar only when the scrollbar must be hidden',
		pattern: /\bthin-scrollbar\b/g
	}
]

const files = execSync(
	'git ls-files --cached --others --exclude-standard -- "src/**/*.tsx" "src/**/*.ts" "src/*.css" "src/**/*.css"',
	{ cwd: ROOT, encoding: 'utf8' }
)
	.split('\n')
	.filter(Boolean)

const buckets = ['core', 'excluded']
const counts = Object.fromEntries(buckets.map((bucket) => [bucket, Object.fromEntries(RULES.map((r) => [r.id, 0]))]))
const offenders = Object.fromEntries(
	buckets.map((bucket) => [bucket, Object.fromEntries(RULES.map((r) => [r.id, new Map()]))])
)

for (const file of files) {
	const content = fs.readFileSync(path.join(ROOT, file), 'utf8')
	const bucket = isExcludedProductFile(file) ? 'excluded' : 'core'
	for (const rule of RULES) {
		if (file.endsWith('.css') && rule.id !== 'explicit-thin-scrollbar') continue
		const matches = content.match(rule.pattern)
		if (matches) {
			counts[bucket][rule.id] += matches.length
			offenders[bucket][rule.id].set(file, matches.length)
		}
	}
}

if (process.argv.includes('--update')) {
	fs.writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, '\t') + '\n')
	console.log('baseline updated:', counts)
	process.exit(0)
}

const persistedBaseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
const baseline = 'core' in persistedBaseline ? persistedBaseline : { core: persistedBaseline, excluded: {} }
let failed = false

for (const bucket of buckets) {
	console.log(`\n${bucket} application bucket`)
	for (const rule of RULES) {
		const now = counts[bucket][rule.id]
		const was = baseline[bucket]?.[rule.id] ?? 0
		const status = now > was ? 'FAIL' : now < was ? 'improved' : 'ok'
		console.log(`${status.padEnd(9)} ${rule.id}: ${now} (baseline ${was})`)
		if (now > was) {
			failed = true
			console.log(`  ${rule.description}`)
			const top = [...offenders[bucket][rule.id].entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
			for (const [file, n] of top) console.log(`    ${n}\t${file}`)
		} else if (now < was) {
			console.log(`  run \`bun run lint:tokens --update\` to lock in the improvement`)
		}
	}
}

process.exit(failed ? 1 : 0)
