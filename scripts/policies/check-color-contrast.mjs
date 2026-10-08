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
 *
 *   bun scripts/policies/check-color-contrast.mjs
 */

const FILES = ['src/styles/primitives.css', 'src/styles/semantics.css']
const TEXT = [
	'text-primary',
	'text-secondary',
	'text-tertiary',
	'text-link',
	'text-data-up',
	'text-data-down',
	'text-data-up-alt',
	'text-data-down-alt',
	'text-warning',
	'success',
	'error'
]
const SURFACES = ['bg-page', 'bg-surface', 'bg-surface-elevated-1', 'bg-surface-elevated-2', 'bg-overlay']
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
			grounds[`hover-row over ${surface}`] = paint(color('hover-row'), color(surface))
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

	for (const ramp of RAMPS) {
		for (const step of [1, 2, 3, 4]) {
			const ratio = contrast(color(`${ramp}-11`), color(`${ramp}-${step}`))
			if (ratio < 4.5) failures.push(`${mode}: --${ramp}-11 on --${ramp}-${step} is ${ratio.toFixed(2)}:1`)
		}
		const white = contrast('#ffffff', color(`${ramp}-9`))
		if (white < 4.5) failures.push(`${mode}: white on --${ramp}-9 is ${white.toFixed(2)}:1`)
	}
}

if (failures.length > 0) {
	console.error('Color contrast below WCAG AA (design.md → "Color ramps"):')
	for (const failure of failures) console.error(`  ${failure}`)
	process.exit(1)
}
console.log('Color contrast policy: all text tokens and ramp pairs pass AA in light and dark.')
