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

// Width-only border/divide utilities (className="border", "border-t", "divide-y")
// stopped receiving a default gray in Tailwind v4; the compatibility shim that
// restored the v3 behavior was removed from tailwind.css after a full audit, so
// such a utility now renders a currentColor border (near-white in dark mode)
// unless a color source accompanies it. This matcher scans plain string
// literals only: template literals with ${} interpolation and strings carrying
// legacy pro-* classes (which set border-color) are assumed to supply a color,
// zero-width utilities (border-0) render nothing, and class examples inside
// block comments aren't consumers. The baseline covers audited sites whose
// color arrives via an inline style={{ borderColor }} at the call site.
const BORDER_STYLE_KEYWORDS = new Set([
	'dashed',
	'dotted',
	'solid',
	'none',
	'double',
	'hidden',
	'collapse',
	'separate',
	'spacing'
])
const BORDER_SIDE = /^[tblrxyse]$/
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g
const BORDER_TOKEN = /(?<![\w.-])((?:[\w[\]()&>~.*-]+:)*)((?:border|divide)(?:-[\w[\]().%/-]+)?)(?![\w-])/g

function classifyBorderUtility(utility) {
	const m = utility.match(/^(border|divide)(?:-(.+))?$/)
	if (!m) return 'other'
	const [, kind, rest] = m
	if (rest === undefined) return kind === 'border' ? 'width' : 'other'
	const parts = rest.split('-')
	if (BORDER_STYLE_KEYWORDS.has(parts[0])) return 'other'
	if (BORDER_SIDE.test(parts[0])) {
		if (parts.length === 1) return 'width'
		if (parts.length === 2 && /^\d+$/.test(parts[1])) return 'width'
		return 'color'
	}
	if (kind === 'border' && parts.length === 1 && /^\d+$/.test(parts[0])) return 'width'
	return 'color'
}

function matchImplicitBorderColor(content) {
	const found = []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const [literal] of source.matchAll(STRING_LITERAL)) {
		if (!literal.includes('border') && !literal.includes('divide')) continue
		if (literal.startsWith('`') && literal.includes('${')) continue
		if (/pro-(?:border|divider|btn-[\w-]+)/.test(literal)) continue
		const widthUtilities = []
		let hasColor = false
		for (const token of literal.matchAll(BORDER_TOKEN)) {
			const kind = classifyBorderUtility(token[2])
			if (kind === 'color') hasColor = true
			else if (kind === 'width' && !/-0$/.test(token[2])) widthUtilities.push(token[1] + token[2])
		}
		if (!hasColor) found.push(...widthUtilities)
	}
	return found.length ? found : null
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
		description:
			'nested scroll containers are thin globally; use scrollbar-none only when the scrollbar must be hidden',
		pattern: /\bthin-scrollbar\b/g
	},
	{
		id: 'legacy-token-reference',
		description: 'legacy token references are quarantined; use semantic utilities in new code',
		pattern: /--legacy-[a-zA-Z0-9-]+/g
	},
	{
		id: 'prefixed-design-token',
		description: 'the semantic design system owns clean custom-property names; do not reintroduce the --ld- prefix',
		pattern: /--ld-[a-zA-Z0-9-]+/g
	},
	{
		id: 'implicit-border-color',
		description:
			'width-only border/divide utility with no color source in the same class string (v4 default is currentColor; add border-subtle, border-medium, …)',
		match: matchImplicitBorderColor
	}
]

const files = execSync(
	'git ls-files --cached --others --exclude-standard -- "src/**/*.tsx" "src/**/*.ts" "src/*.css" "src/**/*.css" "public/**/*.svg"',
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
		if (
			file.endsWith('.css') &&
			!['explicit-thin-scrollbar', 'legacy-token-reference', 'prefixed-design-token'].includes(rule.id)
		)
			continue
		const matches = rule.match ? rule.match(content) : content.match(rule.pattern)
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
