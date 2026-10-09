// Design-token ratchet (see design.md → "Enforcement").
//
// Counts styling patterns that bypass the token system and compares them
// against scripts/policies/design-token-baseline.json. Everything is ratcheted; there
// are two independent buckets so neither can hide the other's regressions:
//
//   core     — app code on the Llama Design System (semantics.css)
//   product  — standing product surfaces with their own palettes in
//              src/styles/themes/ (--pro/--sub/--sl/--ai/--research/--callout)
//
// Product themes are living palettes: adding tokens to a theme file as the
// product evolves is the intended workflow. The surface map below also feeds
// the *-leak rules, which flag product tokens/utilities used in core code.
//
//   bun scripts/policies/check-design-tokens.mjs          # check
//   bun scripts/policies/check-design-tokens.mjs --update # rewrite baseline after removing debt
//
// The check also fails when a count drops below its baseline: the gap would
// let the next change add that many violations back without failing.
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '../..')
const BASELINE_PATH = path.join(import.meta.dirname, 'design-token-baseline.json')

// The product-surface map: code under these paths belongs to a standing
// product and consumes its own theme from src/styles/themes/. It is counted
// in the `product` bucket (still ratcheted — separate baseline only) and is
// where product tokens/utilities are legitimate; anywhere else they count as
// a leak.
const PRODUCT_SURFACE_PREFIXES = [
	'src/components/EntityQuestionsStrip/',
	'src/components/Newsletter/',
	'src/components/SubscribeCards/',
	'src/containers/Account/',
	'src/containers/Articles/',
	'src/containers/Authors/',
	'src/containers/Downloads/',
	'src/containers/Investors/',
	'src/containers/LlamaAI/',
	'src/containers/MobileApp/',
	'src/containers/ProDashboard/',
	'src/containers/Sheets/',
	'src/containers/Subscription/',
	'src/containers/UniversalTokenRating/',
	'src/pages/ai/',
	'src/pages/authors/',
	'src/pages/investors',
	'src/pages/pro/',
	'src/pages/research/',
	'src/pages/sheets/',
	'src/pages/subscription/'
]

const PRODUCT_SURFACE_FILES = new Set([
	'src/pages/account.tsx',
	'src/pages/downloads.tsx',
	'src/pages/newsletters.tsx',
	'src/pages/pro.tsx',
	'src/pages/reports.tsx'
])

// Marketing landings and editorial pages keep display type: a class set with text 18px or larger keeps its size, as
// designed (design.md → Typography). Their smaller text, and every other rule, still counts.
const LANDING_DISPLAY = [
	'src/containers/AttestationLanding/index.tsx',
	'src/containers/MCP/index.tsx',
	'src/pages/mcp/index.tsx',
	'src/pages/ai/index.tsx',
	'src/pages/investors.tsx',
	'src/containers/Articles/landing/',
	'src/containers/Authors/AuthorProfileView.tsx',
	'src/pages/authors/[slug].tsx',
	'src/pages/newsletters.tsx',
	'src/containers/Sheets/index.tsx',
	// An article's title and dek are editorial display type, in the reader and in the editor that mirrors it.
	'src/containers/Articles/renderer/ArticleRenderer.tsx',
	'src/containers/Articles/editor/ArticleTitleFields.tsx'
]

function isProductSurfaceFile(file) {
	if (PRODUCT_SURFACE_FILES.has(file)) return true
	return PRODUCT_SURFACE_PREFIXES.some((prefix) => file.startsWith(prefix))
}

// Width-only border/divide utilities (className="border", "border-t", "divide-y")
// stopped receiving a default gray in Tailwind v4; the compatibility shim that
// restored the v3 behavior was removed from tailwind.css after a full audit, so
// such a utility now renders a currentColor border (near-white in dark mode)
// unless a color source accompanies it. This matcher scans class-list string
// literals only: direct class/className attributes and strings corroborated by
// another class-shaped token. Template literals with ${} interpolation and
// strings carrying pro-* theme classes (which set border-color) are assumed to
// supply a color, zero-width utilities (border-0) render nothing, and class
// examples inside block comments aren't consumers. The baseline covers audited
// sites whose color arrives via an inline style={{ borderColor }} at the call site.
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

const BORDER_ONLY_COLORS = new Set(['very-subtle', 'subtle', 'medium', 'strong', 'brand'])

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
	// The border-subtle family are @utility names in semantics.css with no divide- twin: `divide-subtle` sets no color.
	if (kind === 'divide' && BORDER_ONLY_COLORS.has(rest)) return 'other'
	return 'color'
}

function matchImplicitBorderColor(content) {
	const found = []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const match of source.matchAll(STRING_LITERAL)) {
		const literal = match[0]
		if (!literal.includes('border') && !literal.includes('divide')) continue
		if (literal.startsWith('`') && literal.includes('${')) continue
		const tokens = literal.slice(1, -1).split(/\s+/)
		const isClassAttribute = /(?:class|className)\s*=\s*$/.test(
			source.slice(Math.max(0, match.index - 24), match.index)
		)
		const hasClassShapedToken = tokens.some((token) => token.includes('-') && /^[\w!:[\]()/.%&>~*-]+$/.test(token))
		if (!isClassAttribute && !hasClassShapedToken) continue
		const widthUtilities = []
		let hasColor = false
		for (const token of literal.matchAll(BORDER_TOKEN)) {
			const kind = classifyBorderUtility(token[2])
			if (kind === 'color') hasColor = true
			else if (kind === 'width' && !token[2].endsWith('-0')) widthUtilities.push(token[1] + token[2])
		}
		if (!hasColor) found.push(...widthUtilities)
	}
	return found.length > 0 ? found : null
}

// The index of the `>` that ends the tag opened at `from`: the first `>` outside braces and quotes, so
// `onClick={() => a > b}` and multi-line props stay inside the tag.
function tagEnd(content, from) {
	let depth = 0
	let quote = null
	for (let i = from; i < content.length; i++) {
		const char = content[i]
		if (quote) {
			if (char === quote && content[i - 1] !== '\\') quote = null
		} else if (char === '"' || char === "'" || char === '`') quote = char
		else if (char === '{') depth++
		else if (char === '}') depth--
		else if (char === '>' && depth === 0) return i
	}
	return -1
}

// The opening tags `<Name ...>` of the given components, props included.
function openingTags(content, names) {
	const tags = []
	for (const match of content.matchAll(new RegExp(`<(?:${names.join('|')})\\b`, 'g'))) {
		const end = tagEnd(content, match.index + match[0].length)
		if (end !== -1) tags.push(content.slice(match.index, end + 1))
	}
	return tags
}

// The source between each <Dialog …> or <SideSheet …> and its closing tag, nested ones included in their parent.
// A self-closing `<Dialog />` has no body and no closing tag, so it does not open one.
function dialogBodies(content) {
	const bodies = []
	for (const name of ['Dialog', 'SideSheet']) {
		const tag = new RegExp(`<(/?)${name}\\b`, 'g')
		let depth = 0
		let start = 0
		for (const match of content.matchAll(tag)) {
			if (match[1] === '') {
				if (content[tagEnd(content, match.index + match[0].length) - 1] === '/') continue
				if (depth === 0) start = match.index
				depth++
			} else if (depth > 0 && --depth === 0) bodies.push(content.slice(start, match.index))
		}
	}
	return bodies
}

// Buttons in a dialog grow to 44px in phone sheets through their recipe; a pinned h-* or size-* stops that
// (design.md → "Spacing and radius"). Counts buttons written inside a dialog's JSX.
function matchPinnedButtonHeightInDialog(content) {
	const found = []
	for (const body of dialogBodies(content)) {
		for (const tag of openingTags(body, ['Button', 'ProButton'])) {
			const pinned = tag.match(/(?<![\w-])(?:max-sm:|sm:|sheet:)?(?:h|size)-(?:\d+(?:\.\d+)?|\[[^\]]+\])(?![\w-])/g)
			if (pinned) found.push(...pinned)
		}
	}
	return found.length > 0 ? found : null
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
	return found.length > 0 ? found : null
}

// Bare `shadow` is also an English word and an ECharts axisPointer type, so it counts only inside a class list.
const STOCK_SHADOW_SIZE = /(?<![\w-])(?:[\w\-[\]&=.'*@():>]+:)*shadow-(?:2xs|xs|sm|md|lg|xl|2xl|inner)(?![\w-])/g
function matchStockShadow(content) {
	const found = content.match(STOCK_SHADOW_SIZE) ?? []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const [literal] of source.matchAll(STRING_LITERAL)) {
		const tokens = literal.slice(1, -1).split(/\s+/)
		if (!tokens.some((t) => t.includes('-') && /^[\w!:[\]()/.%&>~*-]+$/.test(t))) continue
		for (const token of tokens) if (/^(?:[\w[\]()&>~.*-]+:)*shadow$/.test(token)) found.push(token)
	}
	return found.length > 0 ? found : null
}

const NAMED_TYPOGRAPHY_UTILITY =
	/^(?:heading-(?:lg|sm|xs)|title-(?:lg|md|sm)|table-header|label-(?:xl|lg|md|sm|xs)|body-(?:xl|lg|md|sm|xs)|mono-(?:xl|lg|md(?:-bold)?|sm(?:-bold)?))$/
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
			if (named.length > 1 || (named.length > 0 && raw.length > 0)) found.push(named[0])
		}
	}
	return found.length > 0 ? found : null
}

// Tailwind drops a class it does not know without a warning, so a type name off the scale
// (`heading-md`, `label-2xl`) renders as unstyled body text.
const TYPOGRAPHY_FAMILY_TOKEN = /^(?:heading|title|label|body|mono)-[a-z0-9-]+$/
function matchUnknownNamedTypography(content) {
	const found = []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const [literal] of source.matchAll(STRING_LITERAL)) {
		for (const token of literal.slice(1, -1).split(/\s+/)) {
			const utility = token.match(VARIANT_UTILITY)?.[2]
			if (utility && TYPOGRAPHY_FAMILY_TOKEN.test(utility) && !NAMED_TYPOGRAPHY_UTILITY.test(utility)) {
				found.push(utility)
			}
		}
	}
	return found.length > 0 ? found : null
}

// Mono has two weights: 400 for every figure and 700 for the number a block exists to show. A
// font-jetbrains/font-mono class string that picks any other weight is flagged; use mono-* or font-bold.
const MONO_FAMILY = /(?:^|\s)font-(?:jetbrains|mono)(?=\s|$)/
const OFF_SCALE_MONO_WEIGHT = /(?:^|\s)font-(?:thin|extralight|light|medium|semibold|extrabold|black)(?=\s|$)/
function matchOffScaleMonoWeight(content) {
	const found = []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const [literal] of source.matchAll(STRING_LITERAL)) {
		// Like the named-typography rule, skip dynamic templates: their branches are not one class set.
		if (literal.startsWith('`') && literal.includes('${')) continue
		const body = literal.slice(1, -1)
		if (MONO_FAMILY.test(body) && OFF_SCALE_MONO_WEIGHT.test(body))
			found.push(body.match(OFF_SCALE_MONO_WEIGHT)[0].trim())
	}
	return found.length > 0 ? found : null
}

// A raw size and a raw weight on one element are a type style the ramp should name: `text-sm
// font-semibold` is title-md. Order does not matter, and a variant that changes either one over the
// base pair (`md:text-base`) is another style. The parts of one clsx() call, and the branches of a
// template's ${}, land on one element, so each counts as one class set. A bare weight over an
// inherited size cannot be told apart from emphasis inside a sentence, so recipes and shared
// components cover those instead.
const RAW_TYPE_SIZE = /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[(?:\d+(?:\.\d+)?px|0?\.\d+rem)\])(?:\/\S+)?$/
const RAW_TYPE_WEIGHT = /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/
const STRING_LITERAL_AT = new RegExp(STRING_LITERAL.source, 'y')

function rawTypePairs(classText, found) {
	const scopes = new Map()
	for (const token of classText.replace(/\$\{|[{}'"`]|:(?=\s|$)/g, ' ').split(/\s+/)) {
		const parsed = token.match(VARIANT_UTILITY)
		if (!parsed) continue
		const [, variants, utility] = parsed
		const scope = scopes.get(variants) ?? {}
		if (RAW_TYPE_SIZE.test(utility)) scope.fontSize = utility
		else if (RAW_TYPE_WEIGHT.test(utility)) scope.weight = utility
		scopes.set(variants, scope)
	}
	const base = scopes.get('') ?? {}
	for (const [variants, scope] of scopes) {
		const fontSize = scope.fontSize ?? base.fontSize
		const weight = scope.weight ?? base.weight
		if ((scope.fontSize || scope.weight) && fontSize && weight) found.push(`${variants}${fontSize} ${weight}`)
	}
}

function matchRawTypePair(content) {
	const found = []
	let source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const call of [...source.matchAll(/\bclsx\(/g)].reverse()) {
		let depth = 1
		let i = call.index + call[0].length
		while (depth > 0 && i < source.length) {
			STRING_LITERAL_AT.lastIndex = i
			const literal = /['"`]/.test(source[i]) ? STRING_LITERAL_AT.exec(source) : null
			if (literal) {
				i += literal[0].length
				continue
			}
			if (source[i] === '(') depth++
			else if (source[i] === ')') depth--
			i++
		}
		rawTypePairs(source.slice(call.index + call[0].length, i - 1), found)
		source = source.slice(0, call.index) + source.slice(i)
	}
	for (const [literal] of source.matchAll(STRING_LITERAL)) rawTypePairs(literal.slice(1, -1), found)
	return found.length > 0 ? found : null
}

// The font size a text-* utility sets, in px at the default root: a number, NaN when it is a size whose px value
// depends on the viewport (vw, calc), or null when the utility is not a font size (a color, an alignment).
const NAMED_TEXT_PX = {
	xs: 12,
	sm: 14,
	base: 16,
	lg: 18,
	xl: 20,
	'2xl': 24,
	'3xl': 30,
	'4xl': 36,
	'5xl': 48,
	'6xl': 60,
	'7xl': 72,
	'8xl': 96,
	'9xl': 128
}
const LENGTH = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em|%|vw|vh|svh|dvh|vmin|vmax|ch|ex|pt|cqi|cqw|lh)$/
function lengthPx(value) {
	const length = value.match(LENGTH)
	if (length) return length[2] === 'px' ? +length[1] : /^(?:rem|em)$/.test(length[2]) ? +length[1] * 16 : Number.NaN
	// clamp() and max() reach their largest argument; min() stops at its smallest.
	const fn = value.match(/^(clamp|min|max|calc)\((.*)\)$/)
	if (!fn) return Number.NaN
	const args = fn[2].split(',').map((arg) => lengthPx(arg.trim()))
	if (fn[1] === 'clamp') return args[2]
	if (fn[1] === 'max') return Math.max(...args)
	if (fn[1] === 'min') return Math.min(...args)
	return Number.NaN
}
function textSizePx(utility) {
	const named = utility.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)(?:\/\S+)?$/)
	if (named) return NAMED_TEXT_PX[named[1]]
	const arbitrary = utility.match(/^text-\[(.+)\](?:\/\S+)?$/)
	if (!arbitrary) return null
	const value = arbitrary[1].replace(/_/g, ' ')
	if (value.startsWith('length:')) return lengthPx(value.slice(7))
	// Tailwind reads a bare var() or a color function as a text color.
	if (/^(?:color:|#|var\(|rgb|hsl|oklch|oklab|lab\(|lch\(|color\(|color-mix\()/.test(value)) return null
	return LENGTH.test(value) || /^(?:clamp|min|max|calc)\(/.test(value) ? lengthPx(value) : null
}

function classTokens(text) {
	return text.replace(/\$\{|[{}'"`]/g, ' ').split(/\s+/)
}

// Splits `md:hover:text-[length:14px]` into its variants and utility; a colon inside brackets is part of the value.
function splitVariants(token) {
	const parts = []
	let depth = 0
	let start = 0
	for (let i = 0; i < token.length; i++) {
		if (token[i] === '[') depth++
		else if (token[i] === ']') depth--
		else if (token[i] === ':' && depth === 0) {
			parts.push(token.slice(start, i))
			start = i + 1
		}
	}
	return { variants: parts, utility: token.slice(start).replace(/^!|!$/g, '') }
}

// Every raw size in a class string, alone or under a breakpoint. A placeholder's size belongs to the field recipe,
// and prose-* variants style article bodies through the typography plugin, so neither counts.
function matchRawTypeSize(content, arbitraryOnly = false) {
	const found = []
	const source = content.replace(/\/\*[\s\S]*?\*\//g, '')
	for (const [literal] of source.matchAll(STRING_LITERAL)) {
		for (const token of classTokens(literal.slice(1, -1))) {
			const { variants, utility } = splitVariants(token)
			if (textSizePx(utility) === null || (arbitraryOnly && !utility.startsWith('text-['))) continue
			if (variants.some((v) => v.startsWith('placeholder') || v.startsWith('prose-'))) continue
			found.push(token)
		}
	}
	return found.length > 0 ? found : null
}

// A class set on a landing holds display type when one of its sizes reaches 18px; the type rules skip it whole,
// because its smaller breakpoint sizes belong to the same headline.
function isDisplaySet(text) {
	return classTokens(text).some((token) => textSizePx(splitVariants(token).utility) >= 18)
}
const blank = (text) => text.replace(/[^\n]/g, ' ')
function withoutLandingDisplay(content) {
	let source = content
	for (const call of [...source.matchAll(/\b(?:clsx|cn)\(/g)].reverse()) {
		let depth = 1
		let i = call.index + call[0].length
		while (depth > 0 && i < source.length) {
			if (source[i] === '(') depth++
			else if (source[i] === ')') depth--
			i++
		}
		const group = source.slice(call.index, i)
		if (isDisplaySet(group)) source = source.slice(0, call.index) + blank(group) + source.slice(i)
	}
	return source.replace(STRING_LITERAL, (literal) => (isDisplaySet(literal) ? blank(literal) : literal))
}

// A control is hued at rest (a brand, error, warning or success border or tint) and hovers to the neutral wash in the
// same class string. Its states come from its own hue (design.md → Tokens → Hover). A conditional
// `selected ? hued : neutral hover` keeps the two in separate literals, so it does not match.
const HUED_REST =
	/(?<![\w:-])(?:border-(?:brand|link|error|warning|success|data-up|data-down)(?:-muted|-strong)?|bg-(?:brand|error|warning|success|data-up|data-down)-(?:faint|tint|tint-strong)|bg-brand-faint|bg-brand-muted)(?![\w-])/
const NEUTRAL_HOVER =
	/(?<![\w-])(?:hover-wash(?:-card)?|(?:[\w\-[\]=]+:)*(?:hover|focus-visible):(?:[\w-]+:)*bg-(?:hover-row|hover-card))(?![\w-])/
// Tailwind drops a class it cannot resolve without a warning. The token utilities in semantics.css are
// property-scoped (@utility bg-brand-tint, @utility border-subtle), so `from-brand-tint`, `divide-subtle` or
// `border-subtle/60` compile to nothing. The names come from the stylesheets, so a new token is covered.
const TOKEN_CSS = execSync('git ls-files -- "src/styles/*.css" "src/styles/**/*.css" src/tailwind.css', {
	cwd: ROOT,
	encoding: 'utf8'
})
	.split('\n')
	.filter(Boolean)
	.map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8'))
	.join('\n')
const TOKEN_UTILITIES = new Set([...TOKEN_CSS.matchAll(/@utility\s+([\w-]+)\s*\{/g)].map((m) => m[1]))
const THEME_NAMES = new Set([...TOKEN_CSS.matchAll(/--(?:color|shadow)-([\w-]+)\s*:/g)].map((m) => m[1]))
const COLOR_PROPS =
	'bg|text|border(?:-[trblxy])?|from|via|to|ring|fill|stroke|divide|outline|decoration|placeholder|caret|accent|shadow'
const UTILITY_COLORS = new Map()
for (const utility of TOKEN_UTILITIES) {
	const m = utility.match(new RegExp(`^(?:${COLOR_PROPS})-(.+)$`))
	if (m) UTILITY_COLORS.set(m[1], utility)
}
const COLOR_CLASS = new RegExp(
	`(?<![\\w-])(?:[\\w\\-[\\]&=.'*@():>]+:)*!?((?:${COLOR_PROPS})-([a-z][\\w-]*))(\\/[\\w.[\\]]+)?(?![\\w-])`,
	'g'
)
function matchUnresolvedTokenUtility(content) {
	const found = []
	for (const [token, utility, name, modifier] of content.matchAll(COLOR_CLASS)) {
		if (TOKEN_UTILITIES.has(utility)) {
			if (modifier) found.push(token)
		} else if (!THEME_NAMES.has(name) && UTILITY_COLORS.has(name)) found.push(token)
	}
	return found.length > 0 ? found : null
}

function matchNeutralHoverOnHuedControl(content) {
	const found = []
	for (const [literal] of content.matchAll(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
		if (literal.includes('${')) continue
		if (HUED_REST.test(literal) && NEUTRAL_HOVER.test(literal)) found.push(literal.slice(0, 80))
	}
	return found.length > 0 ? found : null
}

// A native field whose className draws its own border, fill or radius instead of the Input recipe (design.md →
// "Forms and controls"): its outline, hover, radius, fill, focus and error states drift from every other field.
// Checkbox, radio, range and file inputs are not text fields.
const FIELD_RECIPES =
	/\b(?:inputStyles|textareaStyles|codeInputStyles|codeTextareaStyles|oneTimeCodeInputStyles|fieldFrameInputStyles|searchFieldInputStyles)\b/
function matchHandBuiltField(content) {
	const found = []
	for (const tag of openingTags(content, ['input', 'textarea', 'select'])) {
		if (/\btype=["'{]+(?:checkbox|radio|range|file|hidden|color|submit|button)\b/.test(tag)) continue
		const className = tag.match(/className=(\{[^]*?\}(?=\s+[\w-]+=|\s*\/?>)|"[^"]*")/)?.[1]
		if (!className || FIELD_RECIPES.test(className)) continue
		if (/(?<![\w:-])border(?![\w-])|(?<![\w:-])rounded-(?:sm|md|lg)(?![\w-])/.test(className))
			found.push(tag.slice(0, 60))
	}
	return found.length > 0 ? found : null
}

// A hand-rolled loading placeholder: a pulsing neutral block instead of Skeleton (src/ui/Skeleton.tsx), often filled
// with a text tier at an opacity. A pulsing status dot in a hued color is not a placeholder and does not count.
const NEUTRAL_PULSE_FILL =
	/(?<![\w-])bg-(?:primary|secondary|tertiary|surface-elevated-[12]|border-(?:subtle|medium|strong)|hover-row)(?![\w-])/
function matchHandRolledSkeleton(content) {
	const found = []
	for (const [literal] of content.matchAll(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
		if (/\banimate-pulse\b/.test(literal) && NEUTRAL_PULSE_FILL.test(literal)) found.push(literal.slice(0, 80))
	}
	return found.length > 0 ? found : null
}

function matchChartToolbarAutoMargin(content) {
	// Inside a ChartPanelToolbar, an ml-auto group or a last-of-type:mr-auto hack decides left vs right by
	// hand, and the left side jumps right once the row wraps. The toolbar's `leading` slot owns that split.
	const found = []
	for (const [block] of content.matchAll(/<ChartPanelToolbar\b[\s\S]*?<\/ChartPanelToolbar>/g)) {
		// Dialogs opened from the toolbar lay out their own header; only the toolbar row counts.
		const row = block.replace(/<Ariakit\.Dialog\b[\s\S]*?<\/Ariakit\.Dialog>/g, '')
		for (const [cls] of row.matchAll(/className="[^"]*"/g)) {
			if (/(?:^|[\s"])(?:ml-auto|ms-auto)(?=[\s"])|last-of-type:mr-auto/.test(cls)) found.push(cls)
		}
	}
	return found.length > 0 ? found : null
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
		match: (content) => matchRawTypeSize(content, true),
		landingDisplay: true
	},
	{
		id: 'arbitrary-spacing',
		description:
			'arbitrary margin/padding/gap value (use the space palette: p-2, gap-4, … — see design.md → Spacing and radius)',
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
		pattern: /--(?:pro|sub|sl|ai|research|callout|utr)-[a-zA-Z0-9-]+/g,
		productLeak: true
	},
	{
		id: 'builtin-palette-color',
		description:
			'stock Tailwind palette color (red-500, black/[0.06], white, …) — use a semantic token or a product-theme token',
		pattern:
			/(?<![\w-])(?:text|bg|border|from|to|via|fill|stroke|ring|outline|decoration|accent|caret|divide|shadow|placeholder)-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}|black|white)(?:\/(?:\d{1,3}|\[[^\]]+\]))?(?![\w-])/g
	},
	{
		id: 'brand-fill-as-text',
		description:
			'text-brand colors text with the brand fill, which fails AA in dark mode; links, selected labels and carets use text-link (design.md → Color ramps)',
		pattern: /(?<![\w-])(?:[\w\-[\]&=.'*@():>]+:)*!?text-brand(?![\w-])/g
	},
	{
		id: 'opacity-color-modifier',
		description:
			'a /NN opacity modifier on a color utility; use the ramp step or token for that role (tints, borders and text tiers in design.md → Color ramps)',
		pattern:
			/(?<![\w-])(?:bg|text|border(?:-[trblxyse])?|from|to|via|ring|fill|stroke|divide|outline|decoration|placeholder|shadow|caret|accent)-(?!(?:xs|sm|base|lg|xl|\dxl)\/)(?:[a-z][\w-]*|\([^)\s]*\)|\[[^\]\s]*\])\/(?:\d{1,3}|\[[^\]\s]+\])(?![\w-])/g,
		skipTests: true
	},
	{
		id: 'disabled-opacity',
		description:
			'a disabled state drawn with opacity; controls take text-disabled, border-disabled and bg-disabled (design.md → Color ramps). Only a composite whose children carry their own colors or imagery keeps opacity',
		pattern:
			/(?<![\w-])(?:[\w\-[\]&=.'*@():>]+:)?(?:has-|group-has-)?(?:\[[^\]\s]*\]:)?(?:aria-)?disabled[\w\-[\]=]*:(?:[\w-]+:)*opacity-\d+(?![\w-])/g,
		skipTests: true
	},
	{
		id: 'neutral-hover-on-hued-control',
		description:
			'a control that rests on a hued border or tint hovers to the neutral wash; it hovers to its own tint (bg-brand-tint, bg-error-tint, …), design.md → Tokens',
		match: matchNeutralHoverOnHuedControl,
		skipTests: true
	},
	{
		id: 'fixed-dark-fill',
		description:
			'a dark fill that ignores the theme (a fixed product dark token, LlamaAI ink, stock black or a dark hex). An always-dark surface sets `theme-dark` on its root so the text, borders and controls inside it take their dark values in light mode too (design.md → Always-dark surfaces); after checking that, update the baseline',
		pattern:
			/(?<![\w-]|dark:)(?:(?!dark:)[\w\-[\]=]+:)?bg-(?:sub-dark-[\w-]+|sub-surface-dark[\w-]*|ai-ink(?:-raised)?|ai-black|research-black|black|\[#[0-2][0-9a-fA-F]{5}\])(?:\/\d+)?(?![\w-])/g,
		skipTests: true
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
		id: 'stock-shadow',
		description:
			'stock Tailwind shadow (shadow, shadow-xs … shadow-2xl, shadow-inner) — pick the elevation level: none for cards and in-flow panels, shadow-raised, shadow-overlay or shadow-dialog (design.md → Elevation)',
		match: matchStockShadow
	},
	{
		id: 'product-utility-leak',
		description:
			'product-theme utility class (pro-*/sub-*/sl-*/ai-*) used in core app code — product palettes must not leak outside their surfaces (`dialog` and `pro-dashboard` from themes/pro.css are not tracked: those names also appear as route slugs / aria roles)',
		pattern:
			/(?<![\w-])(?:(?:text|bg|border|from|to|via|fill|stroke|ring|outline|decoration|accent|caret|divide|shadow|placeholder)-(?:pro|sub|sl|ai|utr)-[a-z0-9-]+|pro-info-card)(?![\w-])/g,
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
		id: 'product-role-token',
		description:
			'a product-theme color named for a core role (a product text tier, surface, card, border, line, divider or hover). A product theme holds only accents; the role takes the core token (design.md → Product surfaces)',
		pattern:
			/(?<![\w-])(?:[\w\-[\]&=.'*@():>]+:)*(?:bg|text|border(?:-[trblxy])?|from|via|to|ring|fill|stroke|divide|outline|placeholder)-(?:pro|sub|sl|ai|research|callout|utr)-(?:text|surface|cards?|app|page|panel|heading|border|line|divider|hover|invert|wash|overlay|icon|footer|bg)(?:-[\w-]+)?(?![\w-])/g
	},
	{
		id: 'unresolved-token-utility',
		description:
			'a class Tailwind cannot generate, so it renders nothing: a token utility on another property (`from-brand-tint`, `divide-subtle`; only the @utility in semantics.css exists) or with a /NN modifier (`border-subtle/60`). Use the property the token has, an arbitrary `from-(--bg-brand-tint)`, or the token for the role',
		match: matchUnresolvedTokenUtility,
		skipTests: true
	},
	{
		id: 'implicit-border-color',
		description:
			'width-only border/divide utility with no color source in the same class string (v4 default is currentColor; add border-subtle, border-medium, …; a divide-y takes divide-(--border-subtle), since divide-subtle sets no color)',
		match: matchImplicitBorderColor
	},
	{
		id: 'deprecated-tailwind-spelling',
		description:
			'Tailwind v3-era spelling (leading !, bare rounded, outline-none, x-[var(--…)], bg-gradient-to-*, flex-shrink/grow-*) — use the v4 form (px-1!, rounded-sm, outline-hidden, x-(--…), bg-linear-to-*, shrink/grow-*)',
		match: matchDeprecatedTailwindSpelling
	},
	{
		id: 'raw-popover-surface',
		description:
			'Ariakit.Menu/Popover/ComboboxPopover rendered directly — use MenuSurface, PopoverSurface or ComboboxSurface from src/ui, which wire the drawer wrapper, scrim and close button from one `variant`',
		pattern: /<Ariakit\.(?:Menu|Popover|ComboboxPopover|SelectPopover)\b/g,
		// src/ui owns the wrappers; NestedMenu and the legacy Select/Menu paths are the tracked exceptions.
		uiOwned: true
	},
	{
		// `[^<]` reads past arrow functions (`=>`) in earlier props and stops at the first child element.
		id: 'menu-item-color-class',
		description:
			"status color class on a MenuItem — it never shows, because Tailwind emits the row recipe's .text-primary after it; pass `destructive` for a delete or remove row",
		pattern: /<MenuItem\b[^<]*?className=\{?[`"'][^`"']*\btext-(?:error|data-down|data-up|warning)\b/g
	},
	{
		id: 'raw-dialog-surface',
		description:
			'Ariakit.Dialog rendered directly — use Dialog or SideSheet from src/ui/Dialog.tsx (a size, the shared header and footer, the focus net); the tracked exceptions are the mobile nav sheet, the image lightbox, the onboarding tour, the chat history drawer and the mobile-app gate',
		pattern: /<Ariakit\.Dialog\b/g,
		uiOwned: true,
		// A test may host a component in a plain Ariakit dialog.
		skipTests: true
	},
	{
		id: 'arbitrary-dialog-width',
		description:
			'hand-set --dialog-width — pick a Dialog size (sm 448, md 600, lg 880, xl workspace) or a SideSheet size instead',
		pattern: /\[--dialog-width:/g,
		uiOwned: true
	},
	{
		id: 'dialog-button-pinned-height',
		description:
			'Button or ProButton with h-* or size-* inside a Dialog or SideSheet — the recipe sets control heights, and a pinned one stays 32px in a phone sheet where its row is 44px',
		match: matchPinnedButtonHeightInDialog,
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-built-field',
		description:
			'native input, textarea or select with its own border, fill or radius — use Input or Textarea from src/ui/Input.tsx (one outline, hover, radius, fill, focus, error and type), or Select for a pick',
		match: matchHandBuiltField,
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-rolled-skeleton',
		description:
			'pulsing neutral block as a loading placeholder — use Skeleton from src/ui/Skeleton.tsx, which owns the fill and the reduced-motion rule',
		match: matchHandRolledSkeleton,
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'text-tier-fill',
		description:
			'text color token used as a background (bg-primary/secondary/tertiary) — fills take a surface, border or status token: bg-surface-elevated-2 for an empty bar, bg-border-medium/strong for a rule or marker',
		pattern: /(?<![\w-])(?:[\w\-[\]&=.'*@():>]+:)*bg-(?:primary|secondary|tertiary)(?![\w-])/g
	},
	{
		id: 'hand-rolled-spinner',
		description:
			'hand-rolled animate-spin spinner — use LoadingSpinner from src/ui/Loaders in buttons and inline controls, or LoadingIndicator from src/ui/Status for in-panel loading',
		pattern: /\banimate-spin\b/g,
		// src/ui/Loaders owns the one spinner.
		uiOwned: true
	},
	{
		id: 'ascii-ellipsis',
		description:
			'three ASCII dots ending UI copy ("Saving...") — type the ellipsis character "…" in labels, placeholders and status text',
		pattern: /[A-Za-z]\.\.\.(?=['"`<{}])/g
	},
	{
		id: 'raw-scope-note',
		description:
			'hand-rolled scope or failed-data note (a `px-* pt-* body-sm text-tertiary|text-data-down` paragraph) — render ScopeNote or FailedDataNote from src/ui/ScopeNote under the chart toolbar',
		pattern: /className="px-\d pt-\d (?:pb-\d )?body-sm text-(?:tertiary|data-down)"/g,
		// src/ui/ScopeNote owns the one note.
		uiOwned: true
	},
	{
		id: 'surface-chrome-override',
		description:
			'shadow, background, border, radius or padding passed to MenuSurface/PopoverSurface/ComboboxSurface — the variant owns the surface chrome; className is layout only (width, z-index)',
		pattern:
			/<(?:MenuSurface|PopoverSurface|ComboboxSurface)\b[^>]*?className="[^"]*(?<![\w-])(?:shadow|bg|border|rounded|p[xytblr]?)-[^\s"]*/g
	},
	{
		id: 'toolbar-justify-override',
		description:
			'justify-* passed to TableToolbar/TableToolbarControlGroup/PanelHeader/ChartPanelToolbar — they own justify-end; give the left-side item (search, title, view switch) mr-auto instead',
		pattern:
			/<(?:TableToolbar|TableToolbarControlGroup|PanelHeader|ChartPanelToolbar)\b[^>]*?className="[^"]*(?<![\w-])justify-[a-z]+/g
	},
	{
		id: 'chart-toolbar-auto-margin',
		description:
			'ml-auto group or last-of-type:mr-auto inside ChartPanelToolbar — put the title, view switch or metric chips in its `leading` slot; everything else hugs the right',
		match: matchChartToolbarAutoMargin
	},
	{
		id: 'raw-echarts-init',
		description:
			'echarts.init outside the shared renderers — draw the chart with the src/components/ECharts component for its shape (design.md → Charts); MultiSeriesChart covers time and category axes',
		pattern: /\becharts(?:Core)?\.init\(/g,
		// The shared renderers and the PNG exporter own chart instances.
		ownedBy: ['src/components/ECharts/', 'src/components/ChartExport/'],
		skipTests: true
	},
	{
		id: 'conflicting-named-typography',
		description:
			'named typography utilities own size, weight, family, and line-height; remove conflicting text-*, font-*, leading-*, or same-scope named type utilities',
		match: matchConflictingNamedTypography,
		landingDisplay: true
	},
	{
		id: 'unknown-named-typography',
		description:
			'a heading-*, title-*, label-*, body-* or mono-* class that src/styles/typography.css does not define renders as unstyled text; use one of the named styles in design.md → Typography',
		match: matchUnknownNamedTypography,
		// Test titles are sentences ("label-level maps"), not class strings.
		skipTests: true
	},
	{
		id: 'off-scale-mono-weight',
		description:
			'mono uses two weights: 400 for figures, 700 for the headline number; use mono-* (mono-xl, mono-lg, mono-*-bold) or font-bold, never medium, semibold or extrabold',
		match: matchOffScaleMonoWeight
	},
	{
		id: 'raw-type-pair',
		description:
			'a raw text-* size with a font-* weight is a type style without a name; use the named style for its role in design.md → Typography (title-md, label-md, body-sm, …)',
		match: matchRawTypePair,
		landingDisplay: true,
		skipTests: true
	},
	{
		id: 'raw-type-size',
		description:
			'a raw text-* size, alone or with a breakpoint, is a type style without a name; use the named style for its role in design.md → Typography (body-md, label-sm, heading-sm, …)',
		match: matchRawTypeSize,
		landingDisplay: true,
		skipTests: true
	}
]

// Mid-merge, a conflicted file sits in the index once per stage; --deduplicate
// lists it once so its matches are not counted three times.
const files = execSync(
	'git ls-files --cached --others --exclude-standard --deduplicate -- "src/**/*.tsx" "src/**/*.ts" "src/*.css" "src/**/*.css" "public/**/*.svg"',
	{ cwd: ROOT, encoding: 'utf8' }
)
	.split('\n')
	.filter(Boolean)
	.filter((file) => fs.existsSync(path.join(ROOT, file)))

const buckets = ['core', 'product']
const BUCKET_LABELS = {
	core: 'core application bucket',
	product: 'product surfaces bucket'
}
const counts = Object.fromEntries(buckets.map((bucket) => [bucket, Object.fromEntries(RULES.map((r) => [r.id, 0]))]))
const offenders = Object.fromEntries(
	buckets.map((bucket) => [bucket, Object.fromEntries(RULES.map((r) => [r.id, new Map()]))])
)

for (const file of files) {
	const content = fs.readFileSync(path.join(ROOT, file), 'utf8')
	const bucket = isProductSurfaceFile(file) ? 'product' : 'core'
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
		if (rule.uiOwned && file.startsWith('src/ui/')) continue
		if (rule.ownedBy?.some((prefix) => file.startsWith(prefix))) continue
		const source =
			rule.landingDisplay && LANDING_DISPLAY.some((prefix) => file.startsWith(prefix))
				? withoutLandingDisplay(content)
				: content
		if (rule.skipTests && /(?:^|\/)__tests__\/|\.test\.tsx?$/.test(file)) continue
		if (
			rule.productLeak &&
			(bucket === 'product' ||
				file.startsWith('src/styles/') ||
				file === 'src/tailwind.css' ||
				file.startsWith('public/'))
		)
			continue
		const matches = rule.match ? rule.match(source) : source.match(rule.pattern)
		if (matches) {
			counts[bucket][rule.id] += matches.length
			offenders[bucket][rule.id].set(file, matches.length)
		}
	}
}

if (process.argv.includes('--update')) {
	fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, '\t')}\n`)
	console.log('baseline updated:', counts)
	process.exit(0)
}

const persistedBaseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
const baseline = 'core' in persistedBaseline ? persistedBaseline : { core: persistedBaseline, product: {} }
// Baselines written before the bucket rename ('excluded' → 'product'): read the old key.
if (!baseline.product && baseline.excluded) baseline.product = baseline.excluded
let failed = false

for (const bucket of buckets) {
	console.log(`\n${BUCKET_LABELS[bucket]}`)
	for (const rule of RULES) {
		const now = counts[bucket][rule.id]
		const was = baseline[bucket]?.[rule.id] ?? 0
		const status = now > was ? 'FAIL' : now < was ? 'UNLOCKED' : 'ok'
		console.log(`${status.padEnd(9)} ${rule.id}: ${now} (baseline ${was})`)
		if (now > was) {
			failed = true
			console.log(`  ${rule.description}`)
			const top = [...offenders[bucket][rule.id].entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
			for (const [file, n] of top) console.log(`    ${n}\t${file}`)
		} else if (now < was) {
			failed = true
			console.log(
				`  count dropped below the baseline; run \`bun scripts/policies/check-design-tokens.mjs --update\` to lock it in`
			)
		}
	}
}

process.exit(failed ? 1 : 0)
