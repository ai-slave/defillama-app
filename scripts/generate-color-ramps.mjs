// Generates the 12-step color ramps in src/styles/primitives.css.
//
//   bun scripts/generate-color-ramps.mjs
//
// Each step has the same WCAG contrast against the canvas in every hue, so a
// step plays one role in every hue (design.md → "Color ramps"): step 11 text
// passes AA on steps 1–4 of any hue, and white text passes on every step 9.
// Colors are solved in OKLCH (fixed hue, chroma capped by the sRGB gamut,
// lightness solved for the target contrast) and written as hex, so every
// browser, chart canvas and export renders the same value.
//
// Edit the inputs below and rerun; never hand-edit the generated block.

import fs from 'node:fs'

const FILE = new URL('../src/styles/primitives.css', import.meta.url)
const START = '/* generated:color-ramps:start */'
const END = '/* generated:color-ramps:end */'

const CANVAS = { light: '#ffffff', dark: '#090b0c' }

// Contrast of each step against the canvas. Steps 1–4 match the app's
// surfaces; 9 is the brand fill's contrast; 11 is text.
const TARGETS = {
	light: [1.07, 1.16, 1.25, 1.36, 1.5, 1.7, 2.1, 2.9, 5.34, 5.9, 6.5, 14],
	dark: [1.08, 1.13, 1.22, 1.3, 1.45, 1.65, 2.0, 2.7, 3.69, 4.3, 7.0, 15]
}

// Share of the hue's chroma per step: tints and borders stay quiet so status colors do not
// outshout the data around them; fills and text carry the hue.
const CHROMA_SHARE = [0.05, 0.08, 0.13, 0.18, 0.24, 0.34, 0.45, 0.75, 1, 1, 0.95, 0.55]

// hue and chroma in OKLCH. Neutral is achromatic in light and keeps the dark
// surfaces' cool bias in dark.
const HUES = {
	neutral: { light: { h: 0, c: 0 }, dark: { h: 229, c: 0.004 }, flat: true },
	blue: { h: 259, c: 0.18 },
	emerald: { h: 155, c: 0.17 },
	crimson: { h: 20, c: 0.21 },
	amber: { h: 62, c: 0.16 },
	violet: { h: 295, c: 0.2 }
}

// Steps pinned to values the app already ships, so surfaces and the brand fill do not move.
const PINS = {
	light: { 'neutral-1': '#f7f7f7', 'neutral-2': '#eeeeee', 'neutral-4': '#dedede', 'blue-9': '#1f67d2' },
	dark: { 'neutral-1': '#131516', 'neutral-2': '#181a1b', 'neutral-4': '#232628', 'blue-9': '#1f67d2' }
}

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toGamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function oklchToLinearRgb(l, c, h) {
	const a = c * Math.cos((h * Math.PI) / 180)
	const b = c * Math.sin((h * Math.PI) / 180)
	const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
	return [
		4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
		-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
		-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S
	]
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)
const toHex = (rgb) =>
	`#${rgb
		.map((v) =>
			Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`

export function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
	const x = luminance(a)
	const y = luminance(b)
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

// Binary search on lightness: light-mode steps darken as contrast rises, dark-mode steps lighten.
function solve(h, c, target, mode) {
	let lo = 0
	let hi = 1
	let hex
	for (let i = 0; i < 50; i++) {
		const l = (lo + hi) / 2
		let chroma = c
		while (chroma > 0 && !inGamut(oklchToLinearRgb(l, chroma, h))) chroma -= 0.001
		hex = toHex(oklchToLinearRgb(l, chroma, h))
		const tooLow = contrast(hex, CANVAS[mode]) < target
		if (mode === 'dark' ? tooLow : !tooLow) lo = l
		else hi = l
	}
	return hex
}

export function generateRamps() {
	const ramps = { light: {}, dark: {} }
	for (const mode of ['light', 'dark']) {
		for (const [name, hue] of Object.entries(HUES)) {
			const { h, c } = hue.flat ? hue[mode] : hue
			ramps[mode][name] = TARGETS[mode].map(
				(target, i) => PINS[mode][`${name}-${i + 1}`] ?? solve(h, hue.flat ? c : c * CHROMA_SHARE[i], target, mode)
			)
		}
	}
	return ramps
}

function block(ramps) {
	const lines = (mode) =>
		Object.entries(ramps[mode])
			.map(([name, steps]) => steps.map((hex, i) => `\t--${name}-${i + 1}: ${hex};`).join('\n'))
			.join('\n\n')
	return `${START}\n:root {\n${lines('light')}\n}\n\nhtml.dark,\n.theme-dark {\n${lines('dark')}\n}\n${END}`
}

if (import.meta.main) {
	const css = fs.readFileSync(FILE, 'utf8')
	const from = css.indexOf(START)
	const to = css.indexOf(END)
	if (from === -1 || to === -1) throw new Error(`${FILE.pathname} is missing the ${START} … ${END} markers`)
	fs.writeFileSync(FILE, css.slice(0, from) + block(generateRamps()) + css.slice(to + END.length))
	console.log('Wrote color ramps to src/styles/primitives.css')
}
