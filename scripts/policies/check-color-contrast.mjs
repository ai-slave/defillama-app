import fs from 'node:fs'
import { contrast } from '../generate-color-ramps.mjs'

/*
 * Color contrast policy (design.md → "Color ramps"). Resolves the semantic tokens through the ramps in both modes
 * and refuses a value change that drops text below WCAG AA where the app puts it:
 *
 * 1. Every text token at 4.5:1 or more on every surface, on the neutral hover wash over each surface, on the
 *    selected brand tint and on every faint, tint and tint-strong token.
 * 2. text-on-brand at 4.5:1 or more on bg-brand, and border-strong at 3:1 or more on every surface.
 * 3. Every ramp keeps its pair rules: step 11 at 4.5:1 or more on steps 1–4, and white at 4.5:1 or more on step 9.
 * 4. Every chart color in src/constants/colors.ts (CHART_COLORS, OTHERS_COLOR, CHART_UP, CHART_DOWN) at 3:1 or more
 *    on the page and surface in both modes, so one value serves both themes and PNG exports.
 * 5. Every token copy in canvas code (MIRRORS: Monaco and ECharts cannot read var()) still equals its token in that
 *    mode, so a ramp or token change cannot leave a copy behind. A copy is written `cssVar: '--x', light: '…',
 *    dark: '…'` (one token in both modes) or `light: ['--x', '…']` / `dark: ['--y', '…']` (a token per mode).
 * 6. Every surface that nests in another sits at least one ramp step from it (design.md → "Color ramps", after
 *    https://stripe.com/blog/accessible-color-systems): a borderless box or trigger on its parent's step vanishes into
 *    it (an elevated-1 box inside a dialog, for one). The same holds for the disabled fill on every surface, since a
 *    disabled primary button and switch track have no border.
 *
 *   bun scripts/policies/check-color-contrast.mjs
 */

const FILES = ['src/styles/primitives.css', 'src/styles/semantics.css']
// The chart palette is TS (canvas cannot read var()): read its hex literals from the palette block.
const paletteSource = fs.readFileSync('src/constants/colors.ts', 'utf8')
const paletteBlock = paletteSource.slice(
	paletteSource.indexOf('export const CHART_COLORS'),
	paletteSource.indexOf('const toLinear')
)
const sectorBlock = paletteSource.slice(paletteSource.indexOf('export const SECTOR_COLORS'))
const CHART_SERIES_COLORS = [
	paletteSource.match(/export const oldBlue = '(#[0-9a-fA-F]{6})'/)[1],
	...[...paletteBlock.matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]),
	// The eleventh sector color beside the palette.
	...[...sectorBlock.slice(0, sectorBlock.indexOf('\n}')).matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1])
]
// Meaning colors kept as [light, dark] pairs (asset brands, the token rating page's metrics): each value is checked
// on the mode it is drawn in.
const MODE_PAIRS = ['ASSET_BRAND_COLORS', 'UTR_METRIC_COLORS'].flatMap((name) => {
	const start = paletteSource.indexOf(`export const ${name}`)
	const block = paletteSource.slice(start, paletteSource.indexOf('} as const', start))
	return [...block.matchAll(/\[\s*(?:'(#[0-9a-fA-F]{6})'|oldBlue),\s*(?:'(#[0-9a-fA-F]{6})'|oldBlue)\s*\]/g)].map(
		(m) => ({
			name,
			light: m[1] ?? CHART_SERIES_COLORS[0],
			dark: m[2] ?? CHART_SERIES_COLORS[0]
		})
	)
})

const TEXT = [
	'text-primary',
	'text-secondary',
	'text-tertiary',
	'text-link',
	'text-data-up',
	'text-data-down',
	'text-warning',
	'text-success',
	'text-error'
]
const SURFACES = ['bg-page', 'bg-surface', 'bg-surface-elevated-1', 'bg-surface-elevated-2', 'bg-overlay']
// One ramp step: the closest two steps in either mode are dark neutral-1 and neutral-2 (1.05:1), so a pair under this
// shares a step.
const NESTED_STEP = 1.04
// [parent, child]: the ladder, and the steps an emphasis box or a trigger and its hover take inside an overlay.
const NESTED_SURFACES = [
	['bg-page', 'bg-surface'],
	['bg-surface', 'bg-surface-elevated-1'],
	['bg-surface-elevated-1', 'bg-surface-elevated-2'],
	['bg-overlay', 'bg-surface-elevated-1'],
	['bg-overlay', 'bg-surface-elevated-2'],
	...SURFACES.map((surface) => [surface, 'bg-disabled'])
]
const RAMPS = ['neutral', 'blue', 'emerald', 'crimson', 'amber', 'violet']

// Top-level declarations per selector. The token files hold only flat `:root` and `html.dark` blocks.
function declarations(css, selector) {
	const out = {}
	// A block whose selector list names the selector: `html.dark,\n.theme-dark {` counts for html.dark.
	const block = /(?:^|\n)([^{}\n][^{}]*?)\s*\{([^}]*)\}/g
	for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(block)) {
		if (!selectors.split(',').some((s) => s.trim() === selector)) continue
		for (const [, name, value] of body.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/--([\w-]+):\s*([^;]+);/g)) {
			out[name] = value.trim()
		}
	}
	return out
}

function tokens(mode) {
	const css = FILES.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
	return mode === 'light'
		? declarations(css, ':root')
		: { ...declarations(css, ':root'), ...declarations(css, 'html.dark') }
}

function resolve(map, name) {
	const value = map[name]
	if (value === undefined) throw new Error(`--${name} is not defined`)
	const ref = value.match(/^var\(--([\w-]+)\)$/)
	return ref ? resolve(map, ref[1]) : value
}

const rgba = (hex) =>
	[1, 3, 5, 7].map((i) =>
		i === 7 ? (hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1) : parseInt(hex.slice(i, i + 2), 16)
	)
const over = (top, alpha, under) => {
	const [r1, g1, b1] = rgba(top)
	const [r2, g2, b2] = rgba(under)
	const channels = [r1 * alpha + r2 * (1 - alpha), g1 * alpha + g2 * (1 - alpha), b1 * alpha + b2 * (1 - alpha)]
	return `#${channels.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}
const paint = (top, under) => over(top.slice(0, 7), rgba(top)[3], under)

const failures = []
for (const mode of ['light', 'dark']) {
	const map = tokens(mode)
	const color = (name) => resolve(map, name)
	const grounds = {}
	for (const surface of SURFACES) {
		grounds[surface] = color(surface)
		// Elevation 2 is itself a hover step for triggers on elevation 1 and never takes a wash (design.md → Tokens).
		if (surface !== 'bg-surface-elevated-2')
			grounds[`hover-row over ${surface}`] = paint(color('bg-hover-row'), color(surface))
	}
	for (const surface of ['bg-page', 'bg-surface']) {
		const tint = paint(color('bg-brand-muted'), color(surface))
		// A selected control takes no hover wash (semantics.css → hover-wash), so only the resting tint counts.
		grounds[`bg-brand-muted over ${surface}`] = tint
	}
	// Every tint token: text of any role may sit on any tint (a badge, a banner, a soft button).
	for (const name of Object.keys(map).filter((token) => /^bg-[\w-]+-(faint|tint|tint-strong)$/.test(token))) {
		grounds[`--${name}`] = color(name)
	}

	for (const text of TEXT) {
		for (const [ground, hex] of Object.entries(grounds)) {
			const ratio = contrast(color(text), hex)
			if (ratio < 4.5) failures.push(`${mode}: --${text} on ${ground} is ${ratio.toFixed(2)}:1`)
		}
	}
	const onBrand = contrast(color('text-on-brand'), color('bg-brand'))
	if (onBrand < 4.5) failures.push(`${mode}: --text-on-brand on --bg-brand is ${onBrand.toFixed(2)}:1`)

	// Unchecked checkboxes and other high-emphasis outlines need 3:1 against the surface they sit on.
	for (const surface of SURFACES) {
		const ratio = contrast(paint(color('border-strong'), color(surface)), color(surface))
		if (ratio < 3) failures.push(`${mode}: --border-strong on --${surface} is ${ratio.toFixed(2)}:1`)
	}

	for (const [parent, child] of NESTED_SURFACES) {
		const ratio = contrast(color(child), color(parent))
		if (ratio < NESTED_STEP) failures.push(`${mode}: --${child} on --${parent} is ${ratio.toFixed(3)}:1`)
	}

	for (const series of CHART_SERIES_COLORS) {
		for (const surface of ['bg-page', 'bg-surface']) {
			const ratio = contrast(series, color(surface))
			if (ratio < 3) failures.push(`${mode}: chart color ${series} on --${surface} is ${ratio.toFixed(2)}:1`)
		}
	}

	for (const pair of MODE_PAIRS) {
		const series = mode === 'dark' ? pair.dark : pair.light
		for (const surface of ['bg-page', 'bg-surface']) {
			const ratio = contrast(series, color(surface))
			if (ratio < 3) failures.push(`${mode}: ${pair.name} ${series} on --${surface} is ${ratio.toFixed(2)}:1`)
		}
	}

	for (const ramp of RAMPS) {
		for (const step of [1, 2, 3, 4]) {
			const ratio = contrast(color(`${ramp}-11`), color(`${ramp}-${step}`))
			if (ratio < 4.5) failures.push(`${mode}: --${ramp}-11 on --${ramp}-${step} is ${ratio.toFixed(2)}:1`)
		}
		const white = contrast('#ffffff', color(`${ramp}-9`))
		if (white < 4.5) failures.push(`${mode}: white on --${ramp}-9 is ${white.toFixed(2)}:1`)
	}
}

const MIRRORS = [
	'src/components/ECharts/shared/chartTheme.ts',
	'src/components/ECharts/MultiSeriesChart/eventRail.ts',
	'src/containers/Downloads/sql/editorTheme.ts'
]
const sameColor = (a, b) => a?.toLowerCase().replace(/\s+/g, '') === b.toLowerCase().replace(/\s+/g, '')
const modeMaps = { light: tokens('light'), dark: tokens('dark') }
const mirrorFailures = []
for (const file of MIRRORS) {
	const source = fs.readFileSync(file, 'utf8')
	const copies = []
	for (const [, name, light, dark] of source.matchAll(
		/cssVar:\s*'--([\w-]+)',\s*light:\s*'([^']+)',\s*dark:\s*'([^']+)'/g
	)) {
		copies.push(['light', name, light], ['dark', name, dark])
	}
	for (const [, mode, name, value] of source.matchAll(/\b(light|dark):\s*\['--([\w-]+)',\s*'([^']+)'\]/g)) {
		copies.push([mode, name, value])
	}
	for (const [mode, name, value] of copies) {
		const token = resolve(modeMaps[mode], name)
		if (!sameColor(token, value))
			mirrorFailures.push(`${file}: ${mode} copy of --${name} is ${value}, the token is ${token}`)
	}
}
if (mirrorFailures.length > 0) {
	console.error('Token copies out of date (rule 5):')
	for (const failure of mirrorFailures) console.error(`  ${failure}`)
	process.exit(1)
}

if (failures.length > 0) {
	console.error('Color contrast below WCAG AA or nested surfaces too close (design.md → "Color ramps"):')
	for (const failure of failures) console.error(`  ${failure}`)
	process.exit(1)
}
console.log(
	'Color contrast policy: all text tokens, nested surfaces, ramp pairs, chart colors and token copies pass in light and dark.'
)
