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
	'src/pages/ai/',
	'src/pages/authors/',
	'src/pages/investors',
	'src/pages/pro/',
	'src/pages/research/',
	'src/pages/sheets/',
	'src/pages/subscription/'
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
	if (EXCLUDED_PRODUCT_FILES.has(file)) return true
	return EXCLUDED_PRODUCT_PREFIXES.some((prefix) => file.startsWith(prefix))
}

// Width-only border/divide utilities (className="border", "border-t", "divide-y")
// stopped receiving a default gray in Tailwind v4; the compatibility shim that
// restored the v3 behavior was removed from tailwind.css after a full audit, so
// such a utility now renders a currentColor border (near-white in dark mode)
// unless a color source accompanies it. This matcher scans plain string
// literals only: template literals with ${} interpolation and strings carrying
// pro-* theme classes (which set border-color) are assumed to supply a color,
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

// Tailwind v3-era spellings that v4 only supports as deprecated compatibility.
// Modern forms: trailing important (px-1!), rounded-sm, outline-hidden,
// x-(--var), bg-linear-to-*, shrink-*/grow-*. Scans class-list string literals
// only; a literal counts as a class list when it carries at least one other
// hyphenated token (prose such as test names does not).
function matchDeprecatedTailwindSpelling(content) {
	const found = []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const [literal] of source.matchAll(STRING_LITERAL)) {
		const body = literal.slice(1, -1)
		const tokens = body.split(/\s+/)
		const isClassList = tokens.some((t) => t.includes('-') && /^[\w!:[\]()/.%&>~*-]+$/.test(t))
		if (!isClassList) continue
		for (const token of tokens) {
			if (token === 'rounded') found.push(token)
			else if (/(^|:)outline-none$/.test(token)) found.push(token)
			else if (token.includes('[var(--')) found.push(token)
			else if (
				// leading important: require a utility shape after the ! so JS negations
				// (`!isLoading`) inside class template literals don't count
				(/^(?:[\w[\]()&>~.*-]+:)*![a-z][a-z0-9]*(?:-[\w[\]()/.%,]+)+$/.test(token) ||
					/^(?:[\w[\]()&>~.*-]+:)*!(?:flex|block|hidden|grid|relative|absolute|static|sticky|fixed|truncate|underline|uppercase|italic|visible|invisible|rounded|border)$/.test(
						token
					)) &&
				tokens.length > 1
			)
				found.push(token)
			else if (/(^|:)bg-gradient-to-/.test(token)) found.push(token)
			else if (/(^|:)flex-(shrink|grow)(-|$)/.test(token)) found.push(token)
		}
	}
	return found.length ? found : null
}

const NAMED_TYPOGRAPHY_UTILITY =
	/^(?:heading-(?:lg|sm|xs)|label-(?:xl|lg|md|sm|xs)|body-(?:xl|lg|md|sm|xs)|mono-(?:xl|md(?:-bold)?|sm(?:-bold)?))$/
// text-[…] counts as typography only when the arbitrary value is not a color
// (text-[#999], text-[rgba(…)], text-[var(--x)] set color, not size).
const RAW_TYPOGRAPHY_UTILITY =
	/^(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|\[(?!#|rgba?\(|hsla?\(|oklch\(|var\(|--|color)[^\]]+\])|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|jetbrains|inter|\[[^\]]+\])|leading-.+)$/
const VARIANT_UTILITY = /^((?:[\w[\]()&>~.*-]+:)*)((?:[^\s:]+))$/

// A named typography utility owns family (where applicable), size, line-height,
// and weight as one contract. Compare utilities by variant scope so an intentional
// responsive override such as `label-sm sm:label-md` is not treated as a conflict.
// Dynamic template literals are skipped because their completed class set is not
// statically knowable.
function matchConflictingNamedTypography(content) {
	const found = []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const [literal] of source.matchAll(STRING_LITERAL)) {
		if (literal.startsWith('`') && literal.includes('${')) continue
		const scopes = new Map()
		for (const token of literal.slice(1, -1).split(/\s+/)) {
			const parsed = token.match(VARIANT_UTILITY)
			if (!parsed) continue
			const [, variants, utility] = parsed
			const scope = scopes.get(variants) ?? { named: [], raw: [] }
			if (NAMED_TYPOGRAPHY_UTILITY.test(utility)) scope.named.push(utility)
			else if (RAW_TYPOGRAPHY_UTILITY.test(utility)) scope.raw.push(utility)
			scopes.set(variants, scope)
		}
		for (const { named, raw } of scopes.values()) {
			if (named.length > 1 || (named.length && raw.length)) found.push(named[0])
		}
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
		id: 'interim-token',
		description:
			'--interim-* app token (a value awaiting a design-library token) — do not introduce new ones; consume design-system or product-theme tokens instead',
		pattern: /--interim-[a-z0-9-]+/g
	},
	{
		id: 'product-token-leak',
		description:
			'product-theme token (--pro/--sub/--sl/--ai/--research/--callout) referenced in core app code — product palettes must not leak outside their surfaces',
		pattern: /--(?:pro|sub|sl|ai|research|callout)-[a-zA-Z0-9-]+/g,
		productLeak: true
	},
	{
		id: 'builtin-palette-color',
		description:
			'stock Tailwind palette color (red-500, black/[0.06], white, …) — use a semantic token or a quarantined surface variable',
		pattern:
			/(?<![\w-])(?:text|bg|border|from|to|via|fill|stroke|ring|outline|decoration|accent|caret|divide|shadow|placeholder)-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}|black|white)(?:\/(?:\d{1,3}|\[[^\]]+\]))?(?![\w-])/g
	},
	{
		id: 'arbitrary-color-function',
		description: 'arbitrary rgb()/hsl()/oklch() color in a utility class (same contract as hex-in-classname)',
		pattern:
			/(?:text|bg|border|from|to|via|fill|stroke|ring|shadow|outline|decoration|accent|caret|divide|placeholder)-\[(?:(?:rgba?|hsla?|oklch|oklab|color-mix)\(|color:)/g
	},
	{
		id: 'arbitrary-shadow',
		description: 'arbitrary box-shadow value (shadows come from the elevation/effect tokens)',
		pattern: /(?<![\w-])shadow-\[(?!#|var\(|rgba?\(|hsla?\(|oklch\()[^\]]+\]/g
	},
	{
		id: 'product-utility-leak',
		description:
			'product-theme utility class (pro-*/sub-*/sl-*/ai-*) used in core app code — product palettes must not leak outside their surfaces (`dialog` and `pro-dashboard` from themes/pro.css are not tracked: those names also appear as route slugs / aria roles)',
		pattern:
			/(?<![\w-])(?:(?:text|bg|border|from|to|via|fill|stroke|ring|outline|decoration|accent|caret|divide|shadow|placeholder)-(?:pro|sub|sl|ai)-[a-z0-9-]+|pro-(?:text[123]|bg[1237]|border|divider|glass|hover-bg|info-card|btn-(?:purple|blue)(?:-outline)?))(?![\w-])/g,
		productLeak: true
	},
	{
		id: 'prefixed-design-token',
		description: 'the semantic design system owns clean custom-property names; do not reintroduce the --ld- prefix',
		pattern: /--ld-[a-zA-Z0-9-]+/g
	},
	{
		id: 'arbitrary-standard-radius',
		description: 'use rounded-lg for 8px and rounded-xl for 12px, including side and corner variants',
		pattern: /rounded(?:-[a-z]{1,2})?-\[(?:8|12)px\]/g
	},
	{
		id: 'implicit-border-color',
		description:
			'width-only border/divide utility with no color source in the same class string (v4 default is currentColor; add border-subtle, border-medium, …)',
		match: matchImplicitBorderColor
	},
	{
		id: 'deprecated-tailwind-spelling',
		description:
			'Tailwind v3-era spelling (leading !, bare rounded, outline-none, x-[var(--…)], bg-gradient-to-*, flex-shrink/grow-*) — use the v4 form (px-1!, rounded-sm, outline-hidden, x-(--…), bg-linear-to-*, shrink/grow-*)',
		match: matchDeprecatedTailwindSpelling
	},
	{
		id: 'conflicting-named-typography',
		description:
			'named typography utilities own size, weight, family, and line-height; remove conflicting text-*, font-*, leading-*, or same-scope named type utilities',
		match: matchConflictingNamedTypography
	}
]

const files = execSync(
	'git ls-files --cached --others --exclude-standard -- "src/**/*.tsx" "src/**/*.ts" "src/*.css" "src/**/*.css" "public/**/*.svg"',
	{ cwd: ROOT, encoding: 'utf8' }
)
	.split('\n')
	.filter(Boolean)
	.filter((file) => fs.existsSync(path.join(ROOT, file)))

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
			![
				'explicit-thin-scrollbar',
				'legacy-token-reference',
				'prefixed-design-token',
				'arbitrary-standard-radius'
			].includes(rule.id)
		)
			continue
		if (
			rule.productLeak &&
			(bucket === 'excluded' ||
				file.startsWith('src/styles/') ||
				file === 'src/tailwind.css' ||
				file.startsWith('public/'))
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
