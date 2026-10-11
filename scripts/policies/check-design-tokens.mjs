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
//
// A rule's `exceptions` names files where the pattern is a deliberate choice,
// each with its reason; they are not counted, so a baseline above zero is
// always debt. Add one only with a reason the shared part cannot meet.
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
	// Research's own search over its articles, opened from the Research landing and the phone nav.
	'src/components/ResearchSearchDialog.tsx',
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

// A grid or wrapping row pulled one pixel left so its cells' left lines fall outside a clipping box. Breakpoint
// variants count too: `-ml-px md:grid` is the same trick.
function isDividedGridTrick(classes) {
	const tokens = new Set(classes.split(/[\s'"`]+/).map((token) => token.slice(token.lastIndexOf(':') + 1)))
	return tokens.has('-ml-px') && (tokens.has('grid') || tokens.has('flex-wrap'))
}

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
	/^(?:text-(?:xs|sm|base|lg|xl|[2-9]xl|\[(?!#|rgba?\(|hsla?\(|oklch\(|var\(|--|color)[^\]]+\])|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|sans|mono|\[[^\]]+\])|leading-.+)$/
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
// Every custom property the stylesheets define. A `border-(--name)` whose variable is defined nowhere resolves to
// nothing, and the border falls back to the text colour.
const DEFINED_PROPERTIES = new Set([...TOKEN_CSS.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
const VAR_CLASS = new RegExp(`(?<![\\w-])(?:[\\w\\-[\\]&=.'*@():>]+:)*!?(?:${COLOR_PROPS})-\\((--[\\w-]+)\\)`, 'g')
function matchUnresolvedTokenUtility(content) {
	const found = []
	for (const [token, utility, name, modifier] of content.matchAll(COLOR_CLASS)) {
		if (TOKEN_UTILITIES.has(utility)) {
			if (modifier) found.push(token)
		} else if (!THEME_NAMES.has(name) && UTILITY_COLORS.has(name)) found.push(token)
	}
	for (const [token, property] of content.matchAll(VAR_CLASS)) {
		// A variable the file sets itself (an inline style or a [--name:…] class) is defined where it is used.
		if (DEFINED_PROPERTIES.has(property) || content.includes(`'${property}'`) || content.includes(`[${property}:`))
			continue
		found.push(token)
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
// The class strings a literal carries: a template's static text and each quoted branch inside its `${…}` on their own,
// so a pulse in one branch never pairs with a fill in another.
function classStrings(literal) {
	if (!literal.startsWith('`')) return [literal]
	const branches = [...literal.matchAll(/\$\{([^}]*)\}/g)].flatMap(([, expression]) =>
		[...expression.matchAll(/(['"])(?:(?!\1)[^\\\n]|\\.)*\1/g)].map(([quoted]) => quoted)
	)
	const staticText = literal.replace(/\$\{[^}]*\}/g, ' ')
	return [staticText, ...branches.map((branch) => `${staticText} ${branch}`)]
}

function matchHandRolledSkeleton(content) {
	const found = []
	for (const [literal] of content.matchAll(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
		// A placeholder block has a size; a pulsing status dot without one in the same string is a state, not a skeleton.
		for (const classes of classStrings(literal)) {
			if (
				/\banimate-pulse\b/.test(classes) &&
				NEUTRAL_PULSE_FILL.test(classes) &&
				/(?<![\w-])(?:h|w|size)-/.test(classes)
			)
				found.push(classes.slice(0, 80))
		}
	}
	return found.length > 0 ? found : null
}

// A hex fill counts as dark when white text on it passes 4.5:1 (relative luminance below 0.18); a bright dot does not.
function isDarkHex(hex) {
	const channel = (index) => {
		const value = parseInt(hex.slice(index, index + 2), 16) / 255
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	}
	return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4) < 0.18
}

const FIXED_DARK_FILL =
	/(?<![\w-]|dark:)(?:(?!dark:)[\w\-[\]=]+:)?bg-(?:sub-dark-[\w-]+|sub-surface-dark[\w-]*|ai-ink(?:-raised)?|ai-black|research-black|black|\[#([0-9a-fA-F]{6})\])(?:\/\d+)?(?![\w-])/g
function matchFixedDarkFill(content) {
	const found = []
	for (const [literal] of content.matchAll(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1/g)) {
		// A fill with its own bare opacity-NN is a scrim over imagery, not a surface that text sits on; a state variant such as
		// disabled:opacity-50 still counts.
		if (/(?<![\w:-])opacity-\d+/.test(literal)) continue
		for (const [match, hex] of literal.matchAll(FIXED_DARK_FILL)) if (!hex || isDarkHex(hex)) found.push(match)
	}
	return found.length > 0 ? found : null
}

// Matches inside comments (a JSDoc @example) are documentation, not code.
function withoutComments(content) {
	// A comment starts a line or follows whitespace; `image/*` in a string or a `//` inside a URL is not one.
	return content.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/(^|\s)\/\/.*$/gm, '$1')
}

// A JSX opening tag from its `<`: braces and quotes keep a `>` inside a prop value or an arrow from ending it.
function openingTag(source, start) {
	let depth = 0
	let quote = null
	for (let i = start + 1; i < source.length; i++) {
		const char = source[i]
		if (quote) {
			if (char === quote) quote = null
		} else if (char === '"' || char === "'" || char === '`') quote = char
		else if (char === '{') depth++
		else if (char === '}') depth--
		else if (char === '>' && depth === 0) return source.slice(start, i + 1)
	}
	return source.slice(start)
}

function matchUngatedHover(content) {
	// Walk the CSS blocks: a `:hover` selector counts unless an enclosing @media requires `hover: hover`.
	// Scrollbar thumbs are left out: only a pointer can reach them.
	const css = withoutComments(content)
	const preludes = []
	const hits = []
	let start = 0
	for (let i = 0; i < css.length; i++) {
		const char = css[i]
		if (char === '{') {
			const prelude = css.slice(start, i).trim()
			const gated = preludes.some((outer) => outer.startsWith('@media') && /hover:\s*hover/.test(outer))
			if (!prelude.startsWith('@') && prelude.includes(':hover') && !prelude.includes('scrollbar') && !gated)
				hits.push(prelude)
			preludes.push(prelude)
			start = i + 1
		} else if (char === '}') {
			preludes.pop()
			start = i + 1
		} else if (char === ';') {
			start = i + 1
		}
	}
	return hits.length > 0 ? hits : null
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
		exceptions: {
			'src/containers/MCP/index.tsx':
				"the terminal mock's window-control dots: macOS's close, minimise and zoom colours, the same in both modes",
			'src/containers/MarketMakers/DocsFigures.tsx':
				"the docs figures' frames: backdrops matched to their photographic background images, and a rule around a screenshot on its fixed light canvas, the same in both modes"
		},
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
		id: 'ungated-hover',
		description:
			'a hand-written :hover rule outside @media (hover: hover) sticks after a tap on a touch screen; put the :hover selector inside the media query and keep :focus-visible and :active outside it (design.md → Hover)',
		cssOnly: true,
		match: matchUngatedHover
	},
	{
		id: 'per-field-color-scheme',
		description:
			'color-scheme follows the mode globally (src/tailwind.css), so native controls are already dark in dark mode; remove the scheme-* class',
		pattern: /\bscheme-(?:dark|light|normal)\b/g
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
		exceptions: {
			'src/containers/Exchanges/ComplianceCells.tsx':
				'the five KYC requirement chips each take a category hue (sky, violet, amber, teal, indigo); the ramps hold only blue, emerald, crimson, amber and violet, and three of those carry status meaning',
			'src/containers/Investors/dashboards/berachain/BerachainHeader.tsx':
				"the Launch App pill's black label on Berachain's orange brand fill, which stays the same in both modes; a text token turns white in dark mode",
			'src/containers/Investors/dashboards/thorchain/ThorchainHeader.tsx':
				"the Launch App pill's black label on THORChain's cyan-green brand gradient, which stays the same in both modes; a text token turns white in dark mode"
		},
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
		exceptions: {
			'src/containers/Exchanges/ComplianceCells.tsx':
				"the KYC requirement chips' tint and outline are steps of their category hue; sky, teal and indigo have no ramp"
		},
		description:
			'a /NN opacity modifier on a color utility; use the ramp step or token for that role (tints, borders and text tiers in design.md → Color ramps)',
		pattern:
			/(?<![\w-])(?:bg|text|border(?:-[trblxyse])?|from|to|via|ring|fill|stroke|divide|outline|decoration|placeholder|shadow|caret|accent)-(?!(?:xs|sm|base|lg|xl|\dxl)\/)(?:[a-z][\w-]*|\([^)\s]*\)|\[[^\]\s]*\])\/(?:\d{1,3}|\[[^\]\s]+\])(?![\w-])/g,
		skipTests: true
	},
	{
		id: 'disabled-opacity',
		exceptions: {
			'src/ui/UploadTile.tsx':
				'ImageReplaceTile disables a tile showing the current image; a disabled token cannot dim imagery',
			'src/containers/Articles/editor/ArticleChartPicker.tsx':
				'an entity row with its logo; a disabled token cannot dim the logo',
			'src/containers/LlamaAI/components/GoldCta.tsx':
				"the gold gradient CTA's auth-loading placeholder; the disabled fill would swap the gold for grey and flash on every load of /ai",
			'src/containers/ProDashboard/components/ComparisonWizard/steps/SelectItemsStep.tsx':
				'an item row with its token logo; a disabled token cannot dim the logo',
			'src/containers/LlamaAI/components/charts/ChartStyleEditor.tsx':
				'the colour swatches dim with the locked form during a save; a disabled token cannot dim the colour they show',
			'src/containers/ProDashboard/components/CreateDashboardPicker.tsx':
				'option cards whose brand icon tiles carry their own colour, dimmed as one while a dashboard is created'
		},
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
		exceptions: {
			'src/containers/MarketMakers/DocsFigures.tsx':
				"the docs figures' backdrops, matched to their photographic background images; they hold only screenshots, never theme-aware text"
		},
		description:
			'a dark fill that ignores the theme (a fixed product dark token, LlamaAI ink, stock black or a dark hex). An always-dark surface sets `theme-dark` on its root so the text, borders and controls inside it take their dark values in light mode too (design.md → Always-dark surfaces); after checking that, update the baseline',
		match: matchFixedDarkFill,
		skipTests: true
	},
	{
		id: 'arbitrary-color-function',
		exceptions: {
			'src/containers/MarketMakers/colors.ts':
				"the breakdown table's heat scale: one hue at nine alphas over the card, spelled out as static classes so Tailwind emits them"
		},
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
			'product-theme utility class (pro-*/sub-*/sl-*/ai-*/utr-*/research-*/callout-*) used in core app code — product palettes must not leak outside their surfaces (`dialog` and `pro-dashboard` from themes/pro.css are not tracked: those names also appear as route slugs / aria roles)',
		pattern:
			/(?<![\w-])(?:(?:text|bg|border|from|to|via|fill|stroke|ring|outline|decoration|accent|caret|divide|shadow|placeholder)-(?:pro|sub|sl|ai|utr|research|callout)-[a-z0-9-]+|pro-info-card)(?![\w-])/g,
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
		exceptions: {
			'src/ui/MetricChip.tsx': "the chip's outline is its series colour, set inline from its `color` prop",
			'src/containers/LlamaAI/components/messages/CitationPill.tsx':
				'a shared citation box constant; both of its uses add the border colour',
			'src/containers/Subscription/components.tsx':
				"a one-side border fragment joined into ComparisonCell's class string, which sets border-subtle",
			'src/containers/Subscription/sections/SubscriptionComparisonSection.tsx':
				'a one-side border fragment passed to ComparisonCell, which sets border-subtle'
		},
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
		// src/ui owns the wrappers; NestedMenu and the legacy Select/Menu paths live there.
		uiOwned: true,
		skipTests: true,
		exceptions: {
			'src/containers/Articles/editor/ArticleEditorControls.tsx':
				'a table toolbar floating over the editor: it never takes focus and stays open while the reader types',
			'src/containers/Articles/editor/SuggestionPopover.tsx':
				"the editor's suggestion list, anchored to the caret, with focus left in the editor",
			'src/containers/LlamaAI/components/TextSelectionPopup.tsx':
				'actions anchored to a text selection, with focus left in the prose',
			'src/containers/LlamaAI/components/OnboardingWalkthrough.tsx':
				"the tour's pointer bubble: an arrowed card anchored to the spotlight, above the tour's own layer"
		}
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
			'Ariakit.Dialog rendered directly — use Dialog or SideSheet from src/ui/Dialog.tsx (a size, the shared header and footer, the focus net)',
		pattern: /<Ariakit\.Dialog\b/g,
		uiOwned: true,
		// A test may host a component in a plain Ariakit dialog.
		skipTests: true,
		exceptions: {
			'src/components/Nav/Mobile/Menu.tsx':
				'the phone nav drawer: it stays a side drawer on phones, where SideSheet becomes a bottom sheet, and keeps its scroll and open sections',
			'src/containers/LlamaAI/components/ImagePreviewModal.tsx':
				'a full-screen image lightbox with no header or footer',
			'src/containers/LlamaAI/components/OnboardingWalkthrough.tsx':
				"the tour's intro and closing cards, which sit above the tour's spotlight layer",
			'src/containers/LlamaAI/index.tsx':
				'the chat history drawer: non-modal, opening from the left inside the chat area',
			'src/containers/MobileApp/LlamaAIMobileAppGate.tsx': 'a full-screen takeover that a click outside cannot dismiss'
		}
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
		skipTests: true,
		exceptions: {
			'src/containers/Articles/editor/ArticleEditorCanvas.tsx':
				"the link bubble's borderless URL box, inside the bubble's own frame (src/ui/Field.tsx, hideLabel)",
			'src/containers/Downloads/sql/notebook/MarkdownCell.tsx':
				"a notebook cell's source editor, which edits in place in the cell's own frame"
		}
	},
	{
		id: 'hand-built-search-field',
		description:
			'a search field assembled from searchFieldIconStyles and searchFieldInputPlacementStyles — render SearchField from src/ui/SearchField.tsx (the icon, the Input recipe, an accessible `label`, the clear × and its focus return), with a searchField*WrapperStyles constant as `className` for placement',
		match: (content) => withoutComments(content).match(/\bsearchField(?:Icon|InputPlacement)Styles\b/g),
		exceptions: {
			'src/components/Select/VirtualizedSelect.tsx':
				'the Combobox store owns the value, so the field renders the Input through `render` on ComboboxInput',
			'src/containers/Articles/admin/ArticleMultiPicker.tsx':
				'the Combobox store owns the value, so the field renders the Input through `render`',
			'src/containers/Articles/admin/ArticlePicker.tsx':
				'the Combobox store owns the value, so the field renders the Input through `render`; its × also clears the picked article',
			'src/containers/Articles/editor/ArticlePageAssetPicker.tsx':
				'the Combobox store owns the value, so the field renders the Input through `render`',
			'src/containers/LlamaAI/components/sidebar/AgenticSidebar.tsx':
				"the sidebar search's × closes the field and hands focus to the search toggle, and a spinner takes its place while results load; SearchField's × only clears the text",
			'src/containers/ProDashboard/components/AddChartModal/MetricSentenceBuilder.tsx':
				'the subject search is a Combobox whose store owns the value, so the field renders the Input through `render`',
			'src/containers/Raises/Search.tsx':
				'the Combobox store owns the value, so the field renders the Input through `render`',
			'src/pages/directory.tsx': 'the Combobox store owns the value, so the field renders the Input through `render`'
		},
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'native-select',
		description:
			'native <select> — use Select (or SelectWithCombobox for a long or searchable list) from src/components/Select, which owns the trigger, the phone drawer and disabled options',
		pattern: /<select\b/g,
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
		exceptions: {
			'src/containers/ProDashboard/components/ProDashboardLoader.tsx':
				"the Pro route loader's branded llama, a deliberate brand moment on a full-page load; its rings stop under reduced motion"
		},
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
		// JSX text can end the copy on its own line, before the closing tag.
		pattern: /[A-Za-z]\.\.\.(?=['"`<{}]|[ \t]*\n)/g
	},
	{
		id: 'eyebrow-section-heading',
		description:
			'an uppercase eyebrow set as a section heading (an <h2>-<h4> with `uppercase`) — write the heading in sentence case with className="heading-xs", as the rest of the app does; a small label above a figure is a <p> or <span>, not a heading',
		pattern: /<h[2-4]\b[^>]*?className="[^"]*(?<![\w-])uppercase(?![\w-])/g,
		uiOwned: true
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
		id: 'chart-fill-literal',
		exceptions: {
			'src/containers/UniversalTokenRating/TokenPageLive.tsx':
				'two stacked charts split one ChartPanelBody, so each shrinks below the 360px floor (`min-h-0 flex-1`)'
		},
		description:
			'a chart sized with a literal `containerClassName` (`flex-1 min-h-[360px]`): pass CHART_FILL from src/ui/ChartPanel.tsx, plus a min-h-* class for a deliberately taller or shorter chart, so every chart follows the shared floor',
		match: (content) => content.match(/\bcontainerClassName="[^"]*\b(?:flex-1|min-h-\[)[^"]*"/g),
		skipTests: true
	},
	{
		id: 'lazy-chart-without-boundary',
		description:
			'a shared chart loaded with lazy() and no Suspense in the same file: the nearest boundary is a page- or tab-level one, so the whole region renders blank until the chart code arrives, then jumps. Wrap the chart in Suspense with a ChartPanelBodyLoading (or ChartPanelExportShellLoading) of its height (src/ui/ChartPanel.tsx); next/dynamic takes a sized loading part as `loading`',
		match: (content) => {
			const lazyCharts = content.match(/\blazy\(\s*\(\)\s*=>\s*import\(\s*['"]~\/components\/ECharts\//g)
			const dynamicCharts = content.match(/\bdynamic\(\s*\(\)\s*=>\s*import\(\s*['"]~\/components\/ECharts\//g)
			const found = []
			if (lazyCharts && !/\bSuspense\b/.test(content)) found.push(...lazyCharts)
			if (dynamicCharts && !/\bloading\s*:/.test(content)) found.push(...dynamicCharts)
			return found.length > 0 ? found : null
		},
		skipTests: true
	},
	{
		id: 'kept-mounted-surface',
		exceptions: {
			'src/containers/Articles/editor/ArticleChartPicker.tsx':
				'the editor renders the picker only while it is open (chartDialogOpen), and a new key starts each opening',
			'src/containers/Articles/editor/ArticleEditorControls.tsx':
				'the table toolbar mounts only while a table is selected, and its store opens on mount',
			'src/containers/Articles/editor/ArticleMetaDialog.tsx':
				'holds unsaved schedule, guest-author and topic drafts in local state, which unmounting on hide would drop; editor page only',
			'src/containers/Articles/editor/SuggestionPopover.tsx':
				'mounted only while a suggestion is active, on a store that starts open'
		},
		description:
			'a dialog, side sheet, popover, menu or hovercard that stays in the DOM while closed: Ariakit keeps a closed surface mounted unless it unmounts on hide, so pass `unmountOnHide`, or render it only while open with a literal `open`. A surface kept mounted on purpose (`unmountOnHide={false}`) renders its content once `useDeferredValue(true, false) || open` holds, so it is never built inside hydration (src/ui/PopoverSurface.tsx, src/ui/Dialog.tsx)',
		match: (content) => {
			const source = withoutComments(content)
			const found = []
			for (const surface of source.matchAll(
				/<(?:Ariakit\.(?:Dialog|Popover|Menu|SelectPopover|ComboboxPopover|Hovercard)|Dialog|SideSheet)\b/g
			)) {
				const tag = openingTag(source, surface.index)
				if (!/\bunmountOnHide\b/.test(tag) && !/\sopen(?=[\s/>])/.test(tag)) found.push(surface[0])
			}
			if (/unmountOnHide=\{false\}/.test(source) && !/useDeferredValue\(true, false\)/.test(source))
				found.push('unmountOnHide={false}')
			return found.length > 0 ? found : null
		},
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-coloured-change',
		exceptions: {
			'src/containers/Bridges/BridgesLargeTxsTable.tsx':
				'a Deposit or Withdrawal label names a direction, not a movement',
			'src/containers/Bridges/Transactions.tsx': 'the deposit or withdrawal direction pill, a tinted label',
			'src/containers/DeFiWatchlist/index.tsx':
				'the Positive and Negative filter labels name a direction, beside their checkboxes',
			'src/containers/Exchanges/ProfileExecution.tsx': 'an execution cost, red when it costs the trader',
			'src/containers/ProDashboard/ui/ProBadge.tsx': "the Pro metric card's change pill, which tints its fill",
			'src/containers/ProtocolOverview/IncomeStatement.tsx':
				'earnings coloured as a profit or a loss, a level, not a movement',
			'src/components/ECharts/shared/chartTheme.ts': 'maps the tokens to the colours ECharts draws with',
			'src/containers/Yields/Tables/YieldsCells.tsx': 'a signed APY is a rate that can go negative, not a movement',
			'src/containers/Yields/poolDetail/ExitReliabilityPanel.tsx':
				'the no-interruptions note, set in the positive hue of the measured-on-chain well',
			'src/containers/Yields/poolDetail/PoolGrowthChart.tsx': 'an unrecovered drawdown, a status beside the figures'
		},
		description:
			'a movement coloured by hand with text-data-up/down — render Change from src/ui/Change.tsx (unit percent, usd, count or pp), or pass `change` data to SummaryChange, StatTile, InlineStatStrip or SmolStatCard; Change owns the sign, the format and the zero colour',
		// The aliases count too: --yield-positive-text is --text-data-up, and var() or text-(--…) reach the same colour.
		match: (content) =>
			withoutComments(content).match(
				/(?:(?<![\w-])text-data-(?:up|down)|--(?:text-|color-)?data-(?:up|down)|--yield-(?:positive|negative)-text)(?![\w-])/g
			),
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-built-status-badge',
		exceptions: {
			'src/containers/Articles/editor/ArticleEditorHeader.tsx':
				'the save-state button, tinted while a save fails or waits',
			'src/containers/Articles/editor/RevisionHistoryDrawer.tsx': 'added and removed text in a revision diff',
			'src/containers/Downloads/sql/ErrorBanner.tsx': "a failed query's message box and the code it names",
			'src/containers/Downloads/sql/TableChipRail.tsx':
				'a table still loading into the console: dashed until it registers, red if it failed',
			'src/containers/Downloads/sql/notebook/NotebookView.tsx': 'a warning message box above the notebook',
			'src/containers/Exchanges/ExchangeRegionalInformation.tsx': 'an icon tile beside the not-available heading',
			'src/containers/LlamaAI/components/AlertArtifact.tsx': "an alert's icon tile",
			'src/containers/LlamaAI/components/FeedbackForm.tsx': 'the picked thumbs-up or thumbs-down button',
			'src/containers/LlamaAI/components/alerts/EmptyAlertsState.tsx': 'the empty state icon tile',
			'src/containers/LlamaAI/components/alerts/ui.tsx': "an alert's icon tile"
		},
		description:
			'a status coloured by hand with a success, warning or error tint and its text colour — render StatusBadge from src/ui/StatusBadge.tsx with status good, caution, bad or neutral; map the product value to a status, never to classes',
		// One class string that pairs a status tint at rest with that status's text colour is a status pill drawn by hand. A
		// tint behind a state variant (hover:bg-error-tint) is a wash, not a status.
		match: (content) => {
			const found = []
			for (const [literal] of withoutComments(content).matchAll(STRING_LITERAL)) {
				const tone = literal.match(/(?<![\w:-])bg-(success|warning|error)-(?:faint|tint|tint-strong)(?![\w-])/)
				if (tone && new RegExp(`(?<![\\w-])text-${tone[1]}(?![\\w-])`).test(literal)) found.push(tone[0])
			}
			return found.length > 0 ? found : null
		},
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-built-status-dot',
		exceptions: {
			'src/components/Nav/shared.tsx':
				'the attention marker on a nav link, which draws the eye rather than naming a state',
			'src/containers/Articles/editor/RevisionHistoryDrawer.tsx':
				"the revision timeline's event glyphs, told apart by shape as well as colour",
			'src/containers/AttestationLanding/index.tsx':
				"the attestation demo's animated verification lights, with a brand recheck state, sized to the illustration",
			'src/containers/Yields/VaultRisk/primitives/MofNPips.tsx': 'an m-of-n signer threshold, one pip per signer',
			'src/pages/token-rights.tsx': 'a token right on or off, a filled or hollow dot in one hue'
		},
		description:
			'a status dot coloured by hand: a small round bg-success, bg-warning or bg-error mark — render StatusDot from src/ui/StatusBadge.tsx with status good, caution, bad or neutral, and `label` when no text beside it names the state',
		// One class string with a 4–8px round box and a solid status fill is a status dot drawn by hand. A dot doing
		// another job (a marker, a pip, a glyph told apart by shape) is a listed exception.
		match: (content) => {
			const found = []
			for (const [literal] of withoutComments(content).matchAll(STRING_LITERAL)) {
				const has = (token) => new RegExp(`(?<![\\w:-])${token}(?![\\w-])`).test(literal)
				if (has('rounded-full') && has('size-(?:1\\.5|1|2)(?!\\.)') && has('bg-(?:success|warning|error)'))
					found.push(literal.slice(0, 80))
			}
			return found.length > 0 ? found : null
		},
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'raw-kbd',
		description:
			'a keyboard hint drawn as a raw <kbd> — render Keycap from src/ui/Keycap.tsx, `onBrand` inside a brand-filled button',
		match: (content) => withoutComments(content).match(/<kbd\b/g),
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-built-empty-state',
		exceptions: {
			'src/components/Newsletter/NewsletterSignup.tsx': 'the subscribed confirmation, a success check in a tinted disc',
			'src/containers/Articles/admin/BannerForm.tsx':
				"a banner preview's placeholder, drawn at the banner's own size until an image is chosen",
			'src/containers/Articles/profile/AuthorProfileForm.tsx': "the author's avatar placeholder",
			'src/pages/ai/index.tsx': "the demo video's play button",
			'src/pages/sheets/auth.tsx': 'the signed-in confirmation, a success check in a tinted disc',
			'src/pages/support.tsx': 'the request-sent confirmation, a success check in a tinted disc'
		},
		description:
			'an empty state built by hand: an icon disc or a dashed text-centred well — render EmptyState from src/ui/Status.tsx (size md or lg, framed for a dashed well); a quick no-match in a list, popover or table is NoResults',
		// An icon disc is a sized rounded-full box with a fill that centres its icon; a dashed box that centres quiet text is
		// an empty well. A dashed box with a hover state is a control (DashedTile, UploadTile), not a well.
		match: (content) => {
			const found = []
			for (const [literal] of withoutComments(content).matchAll(STRING_LITERAL)) {
				const has = (token) => new RegExp(`(?<![\\w:-])${token}(?![\\w-])`).test(literal)
				if (
					has('rounded-full') &&
					has('size-(?:1[0-9]|20)') &&
					has('bg-[\\w-]+') &&
					has('(?:justify|place-items)-center')
				)
					found.push('icon disc')
				else if (
					has('border-dashed') &&
					!literal.includes('hover:') &&
					(has('text-center') || (has('justify-center') && has('text-(?:tertiary|secondary)')))
				)
					found.push('dashed well')
			}
			return found.length > 0 ? found : null
		},
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-built-divided-grid',
		description:
			"stat cells sharing hairlines drawn by hand: a grid or wrapping row pulled one pixel left (-ml-px) so its cells' left lines fall outside a clipping box — render the cells in DividedGrid (src/ui/DividedGrid.tsx), passing the grid classes as `columns`, and drop the cells' border and first:/nth-child rules",
		match: (content) => {
			const found = []
			for (const [literal] of withoutComments(content).matchAll(STRING_LITERAL)) {
				if (classStrings(literal).some(isDividedGridTrick)) found.push(literal.slice(0, 80))
			}
			return found.length > 0 ? found : null
		},
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'hand-built-card',
		description:
			'a card surface drawn by hand (rounded-md, -lg, -xl or -2xl with border-subtle and bg-surface) — render Card from src/ui/Card.tsx with a padding step (none, sm, base, md, strip), or Panel for a titled shell; className keeps only placement',
		match: (content) =>
			withoutComments(content).match(/\brounded-(?:md|lg|xl|2xl) border border-subtle bg-surface(?=[\s"'`])/g),
		exceptions: {
			'src/components/NotFoundPage.tsx': 'the 404 frame keeps a 4px inset around its full-bleed illustration',
			'src/components/Select/SelectWithCombobox.tsx':
				'the Only button inside a select row, a control rather than a card',
			'src/containers/AttestationLanding/index.tsx': 'a venue label pill in the flow diagram',
			'src/containers/Downloads/index.tsx': 'the API host chip in the downloads hero, set in mono',
			'src/containers/Downloads/sql/SqlWorkspace.tsx': 'the one-line engine status strip above the editor, 8px by 12px',
			'src/containers/Downloads/sql/TableChipRail.tsx':
				'the one-line no-tables strip, 8px by 12px like the engine status strip',
			'src/containers/LlamaAI/projects/ProjectFilesPanel.tsx':
				'a connected GitHub repo row with its branch badge and Disconnect control',
			'src/containers/ProDashboard/components/AddChartModal/UnifiedTableTab/index.tsx':
				'the one-line note that stands in for the data-view list when every view is shown, 8px by 12px',
			'src/components/RowLinksWithDropdown/index.tsx': 'a segmented row of links, a control rather than a card',
			'src/containers/DesignSystem/foundations.tsx': 'a specimen swatch on the dev-only design system page',
			'src/containers/DesignSystem/shared.tsx': 'the specimen frame on the dev-only design system page',
			'src/containers/Exchanges/MicaCells.tsx': 'a 28px icon tile in a table cell',
			'src/containers/Investors/dashboards/flare/ui.tsx':
				"a callout with the partner's 3px accent edge and its wider left inset",
			'src/containers/LlamaAI/components/AlertsModal.tsx':
				"an alert row whose 14px vertical inset lines up with the modal's list rows",
			'src/containers/LlamaAI/components/LlamaAITipBanner.tsx': 'a one-line tip strip under the composer, 10px by 14px',
			'src/containers/LlamaAI/components/NotificationPermissionBanner.tsx': 'the same tip strip as LlamaAITipBanner',
			'src/containers/LlamaAI/components/TipOrNotifyBanner.tsx': 'the same tip strip as LlamaAITipBanner',
			'src/containers/LlamaAI/components/QueueChips.tsx': 'queued prompt rows, 8px by 12px, under the composer',
			'src/containers/LlamaAI/components/charts/ChartRenderer.tsx':
				'the chart frame with its tab row pulled into the top inset',
			'src/containers/LlamaAI/components/sidebar/AgenticSidebar.tsx': 'the folded 44px icon rail',
			'src/containers/LlamaAI/components/status/StreamingStatus.tsx':
				'a status block that tightens below sm and indents behind a 2px left edge under an active task',
			'src/containers/LlamaAI/dailyBrief/HomeDailyBrief.tsx': 'a question button with its own pressed fill',
			'src/containers/ProDashboard/components/AddChartModal/MetricTab.tsx': 'a picker block that tightens below sm',
			'src/containers/ProtocolRankings/Table.tsx': 'the chrome is off when the table is embedded borderless',
			'src/containers/TokenRights/TokenRightsByProtocol.tsx': 'the chrome is on only when the section is embedded',
			'src/containers/UniversalTokenRating/TopMovers.tsx': 'a scrolling bar of mover chips',
			'src/pages/ai/index.tsx':
				"the LlamaAI marketing landing's feature cards keep the landing's larger radius and inset",
			'src/containers/MobileApp/index.tsx':
				"the mobile app landing's feature cards keep the landing's larger radius and inset",
			'src/containers/Sheets/index.tsx': 'the Sheets marketing landing keeps its larger radius on its dark surface',
			'src/pages/sheets/auth.tsx': "the add-on's sign-in card keeps the Sheets landing look"
		},
		uiOwned: true,
		skipTests: true
	},
	{
		id: 'raw-echarts-init',
		exceptions: {
			'src/containers/Unlocks/TreemapChart/index.tsx':
				'the unlocks year → month → token drill-down with token icons and a step-back trail; the shared treemaps hold one level and hide the native trail',
			'src/containers/ProDashboard/server/ogImage/renderChartSvg.ts':
				"the share image's sparkline, rendered on the server to an SVG string; the shared renderers are client components that need a DOM node"
		},
		description:
			'echarts.init outside the shared renderers — draw the chart with the src/components/ECharts component for its shape (design.md → Charts); MultiSeriesChart covers time and category axes',
		match: (content) => withoutComments(content).match(/\becharts(?:Core)?\.init\(/g),
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
		id: 'raw-mono-family',
		exceptions: {
			'src/containers/AttestationLanding/index.tsx':
				'the animated equation sizes its figures to its container (attn-equation-value), which no named style can'
		},
		description:
			"font-mono picks the family and leaves size, weight and line height to whatever it sits in; use mono-md or mono-sm for figures, code, addresses and hashes, mono-*-bold for the number a block exists to show, and the sentence's own Inter for a number or word inside a sentence (design.md → Typography)",
		// font-jetbrains is no longer a utility, so it would render as Inter without a warning.
		match: (content) =>
			withoutComments(content).match(/(?<![\w-])font-(?:mono|jetbrains)(?![\w-])|var\(--font-(?:mono|jetbrains)\b/g),
		uiOwned: true,
		skipTests: true
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

const exceptionHits = new Set()
for (const file of files) {
	const content = fs.readFileSync(path.join(ROOT, file), 'utf8')
	const bucket = isProductSurfaceFile(file) ? 'product' : 'core'
	for (const rule of RULES) {
		if (
			file.endsWith('.css') &&
			![
				'explicit-thin-scrollbar',
				'ungated-hover',
				'legacy-token-reference',
				'prefixed-design-token',
				'arbitrary-standard-radius'
			].includes(rule.id)
		)
			continue
		if (rule.cssOnly && !file.endsWith('.css')) continue
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
		// A listed exception is a deliberate choice with its reason beside it, not debt: it is shown, not counted.
		if (rule.exceptions?.[file]) {
			if (matches) exceptionHits.add(`${rule.id} ${file}`)
			continue
		}
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

// An exception whose file no longer matches would sit in the list unseen and excuse the next real violation there.
console.log('\nlisted exceptions (not counted)')
for (const rule of RULES) {
	if (!rule.exceptions) continue
	const listed = Object.keys(rule.exceptions)
	const stale = listed.filter((file) => !exceptionHits.has(`${rule.id} ${file}`))
	console.log(`${(stale.length > 0 ? 'FAIL' : 'ok').padEnd(9)} ${rule.id}: ${listed.length}`)
	for (const file of stale) {
		failed = true
		console.log(`  stale: ${file} no longer matches; remove it from the rule's exceptions`)
	}
}

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
