// QA gate for color-sweep codemods (written for the LlamaAI --ai-* sweep;
// adapt ROOT/target dirs and the role-value source when reusing): for every changed file, compare each class
// literal's ORIGINAL (git HEAD) vs CURRENT rendering per mode, and flag:
//  (a) big per-mode color drift (ΔRGB channel-mean > threshold)
//  (b) state collapse: a hover:/focus:/active: token that became identical to
//      its base counterpart in the same literal
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const ROOT = '/Users/mint/p/defillama-app'
const THRESHOLD = 40

// role -> [light, dark] resolved from the css file
const css = fs.readFileSync(`${ROOT}/src/styles/legacy-llama-ai.css`, 'utf8')
const rootBlock = css.match(/:root \{([\s\S]*?)\n\}/)[1]
const darkBlock = css.match(/html\.dark \{([\s\S]*?)\n\}/)[1]
const parseVars = (block) => {
	const out = {}
	for (const m of block.matchAll(/--ai-([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim()
	return out
}
const light = parseVars(rootBlock)
const dark = { ...light, ...parseVars(darkBlock) }

const toRGB = (raw) => {
	if (!raw) return null
	const v = raw.trim()
	let m
	if ((m = v.match(/^#([0-9a-fA-F]{6})$/))) {
		const h = m[1]
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
	}
	if ((m = v.match(/^#([0-9a-fA-F]{3})$/))) {
		const h = m[1]
		return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1]
	}
	if ((m = v.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)$/))) return [+m[1], +m[2], +m[3], +m[4]]
	if ((m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/)))
		return [+m[1], +m[2], +m[3], m[4] ? +m[4] : 1]
	return null
}

const BUILTIN = {
	'red-50': '#fef2f2',
	'red-100': '#fee2e2',
	'red-200': '#fecaca',
	'red-300': '#fca5a5',
	'red-400': '#f87171',
	'red-500': '#ef4444',
	'red-600': '#dc2626',
	'red-700': '#b91c1c',
	'red-800': '#991b1b',
	'red-900': '#7f1d1d',
	'red-950': '#450a0a',
	'amber-100': '#fef3c7',
	'amber-200': '#fde68a',
	'amber-400': '#fbbf24',
	'amber-500': '#f59e0b',
	'amber-600': '#d97706',
	'amber-700': '#b45309',
	'amber-900': '#78350f',
	'yellow-400': '#facc15',
	'yellow-500': '#eab308',
	'yellow-600': '#ca8a04',
	'green-400': '#4ade80',
	'green-500': '#22c55e',
	'emerald-400': '#34d399',
	'emerald-600': '#059669',
	'blue-500': '#3b82f6',
	'sky-400': '#38bdf8',
	'indigo-500': '#6366f1',
	'violet-400': '#a78bfa',
	'violet-500': '#8b5cf6',
	'gray-100': '#f3f4f6',
	'gray-200': '#e5e7eb',
	'gray-300': '#d1d5db',
	'gray-400': '#9ca3af',
	'gray-700': '#374151',
	'gray-800': '#1f2937',
	black: '#000000',
	white: '#ffffff'
}

const valueToRGB = (val, mode) => {
	// val: utility value part (hex bracket, builtin, black/white, ai role name)
	let alpha = 1
	const am = val.match(/^(.*)\/(\[[^\]]+\]|[\d.]+)$/)
	let core = val
	if (am) {
		core = am[1]
		const raw = am[2].replace(/[[\]]/g, '')
		alpha = parseFloat(raw) > 1 ? parseFloat(raw) / 100 : parseFloat(raw)
	}
	let m
	let rgb = null
	if ((m = core.match(/^\[(#[0-9a-fA-F]+)\]$/))) rgb = toRGB(m[1].slice(0, 7))
	else if ((m = core.match(/^\[(rgba?\([^\]]+\))\]$/))) rgb = toRGB(m[1].replace(/_/g, ' '))
	else if (core.startsWith('ai-')) {
		const roleVal = (mode === 'dark' ? dark : light)[core.slice(3)]
		rgb = toRGB(roleVal)
		if (!rgb && roleVal) return 'complex' // gradients/shadows
	} else if (BUILTIN[core]) rgb = toRGB(BUILTIN[core])
	if (!rgb) return null
	return [rgb[0], rgb[1], rgb[2], rgb[3] * alpha]
}

const UTIL =
	/^((?:[\w[\]()&>~.*=-]+:)*)(text|bg|border|from|to|via|fill|stroke|ring|outline|decoration|accent|caret|divide|placeholder)-(.+)$/
const STRING_LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g

// resolve a class list into {scopeKey: rgba} where scopeKey = variants|prop, per mode
function resolve(text, mode) {
	const out = {}
	for (const t of text.split(/\s+/)) {
		const m = t.match(UTIL)
		if (!m) continue
		const [, variants, prop, value] = m
		const rgb = valueToRGB(value, mode)
		if (rgb === null) continue
		const isDark = variants.includes('dark:')
		if (mode === 'dark' ? false : isDark) continue // in light mode skip dark: tokens
		if (mode === 'dark' && isDark) {
			out[`${variants.replace(/dark:/, '')}|${prop}`] = rgb // dark: token overrides base in dark
			continue
		}
		const key = `${variants}|${prop}`
		if (!(key in out) || mode === 'light') out[key] = out[key] ?? rgb
		if (mode === 'dark' && !(key in out)) out[key] = rgb
		out[key] = out[key] ?? rgb
	}
	// second pass for dark mode: base tokens fill scopes not overridden
	return out
}

const changed = execSync(
	'git diff --name-only HEAD -- "src/containers/LlamaAI" "src/pages/ai" "src/components/EntityQuestionsStrip" "src/components/LlamaAIFloatingButton"',
	{ cwd: ROOT, encoding: 'utf8' }
)
	.split('\n')
	.filter((f) => /\.(tsx|ts)$/.test(f))

let flags = 0
for (const file of changed) {
	let orig
	try {
		orig = execSync(`git show HEAD:"${file}"`, { cwd: ROOT, encoding: 'utf8' })
	} catch {
		continue
	}
	const curr = fs.readFileSync(`${ROOT}/${file}`, 'utf8')
	const oLits = [...orig.matchAll(STRING_LITERAL)].map((m) => m[0].slice(1, -1))
	const cLits = [...curr.matchAll(STRING_LITERAL)].map((m) => m[0].slice(1, -1))
	if (oLits.length !== cLits.length) {
		console.log(`SKEW ${file}: literal count ${oLits.length} -> ${cLits.length} (manual review)`)
		continue
	}
	for (let i = 0; i < oLits.length; i++) {
		if (oLits[i] === cLits[i]) continue
		for (const mode of ['light', 'dark']) {
			const a = resolve(oLits[i], mode)
			const b = resolve(cLits[i], mode)
			for (const key of Object.keys(a)) {
				const av = a[key]
				const bv = b[key]
				if (av === 'complex' || bv === 'complex') continue
				if (!bv) continue // token removed (pair collapse handles via role) — skip
				// composite alpha over the mode surface so solid<->alpha swaps compare fairly
				const surface = mode === 'dark' ? [26, 26, 26] : [255, 255, 255]
				const comp = (c) => [0, 1, 2].map((ch) => c[ch] * c[3] + surface[ch] * (1 - c[3]))
				const ac = comp(av),
					bc = comp(bv)
				const d = Math.abs(ac[0] - bc[0]) / 3 + Math.abs(ac[1] - bc[1]) / 3 + Math.abs(ac[2] - bc[2]) / 3
				if (d > THRESHOLD) {
					flags++
					console.log(`DRIFT ${file} [${mode}] ${key}: ${JSON.stringify(av)} -> ${JSON.stringify(bv)}`)
					console.log(`   was: ${oLits[i].slice(0, 110)}`)
					console.log(`   now: ${cLits[i].slice(0, 110)}`)
				}
			}
		}
		// state collapse check: hover/focus token identical to base token, but wasn't before
		const collapse = (text) => {
			const map = {}
			for (const t of text.split(/\s+/)) {
				const m = t.match(UTIL)
				if (!m) continue
				map[`${m[1]}|${m[2]}`] = m[3]
			}
			const issues = []
			for (const [k, v] of Object.entries(map)) {
				const mm = k.match(/^(hover:|focus:|focus-visible:|active:)\|(.+)$/)
				if (mm && map[`|${mm[2]}`] === v) issues.push(k)
			}
			return issues
		}
		const before = new Set(collapse(oLits[i]))
		for (const k of collapse(cLits[i])) {
			if (!before.has(k)) {
				flags++
				console.log(`COLLAPSE ${file}: ${k} now equals base`)
				console.log(`   was: ${oLits[i].slice(0, 110)}`)
				console.log(`   now: ${cLits[i].slice(0, 110)}`)
			}
		}
	}
}
console.log(`\n${flags} flags across ${changed.length} files (threshold ${THRESHOLD})`)
