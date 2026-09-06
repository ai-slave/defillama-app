// Rewrites hardcoded color/shadow/animation utility classes in the LlamaAI
// surface to the --ai-* product-theme roles defined in styles/themes/llamaai.css.
//
//   node scripts/codemods/ai-color-sweep.mjs <dir-or-file>... [--write]
//
// Uses the TypeScript AST (never regex over source): visits string literals,
// JSX string attributes, and template-literal quasis; tokenizes each class
// list; collapses `x dark:x` pairs whose values map to one flipping role;
// rewrites mapped singles; leaves everything unmapped untouched and reports it.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const mapArg = process.argv.find((a) => a.startsWith('--map='))
const MAP = JSON.parse(
	fs.readFileSync(mapArg ? mapArg.slice(6) : path.join(import.meta.dirname, 'ai-color-map.json'), 'utf8')
)
const exactArg = process.argv.find((a) => a.startsWith('--exact='))
const EXACT = JSON.parse(
	fs.readFileSync(exactArg ? exactArg.slice(8) : path.join(import.meta.dirname, 'ai-exact-token-map.json'), 'utf8')
)
const DARKSIDE = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'ai-dark-side-map.json'), 'utf8'))

const write = process.argv.includes('--write')
const targets = process.argv
	.slice(2)
	.filter((a) => a !== '--write' && !a.startsWith('--map=') && !a.startsWith('--exact='))

const COLOR_UTIL =
	/^((?:[\w[\]()&>~.*/=-]+:)*)(text|bg|border-[trblxyse]|border|from|to|via|fill|stroke|ring|outline|decoration|accent|caret|divide|shadow|placeholder)-((?:\[#[0-9a-fA-F]+\](?:\/(?:[\d.]+|\[[^\]]+\]))?)|(?:\[(?:rgba?|hsla?|oklch)\([^\]]*\)\])|(?:\(--[a-z0-9-]+\)(?:\/(?:[\d.]+|\[[^\]]+\]))?)|(?:(?:black|white)(?:\/(?:[\d.]+|\[[^\]]+\]))?)|(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}(?:\/(?:[\d.]+|\[[^\]]+\]))?)|(?:(?:ai|sub|pro|sl)-[a-z0-9-]+(?:\/(?:[\d.]+|\[[^\]]+\]))?))$/

const lcHex = (k) => k.replace(/\[#([0-9a-fA-F]+)\]/g, (_, h) => `[#${h.toLowerCase()}]`)
const report = new Map() // unmapped token -> count

function rewriteClassList(text) {
	// not a class list if it has no hyphenated utility-shaped token
	if (!/[a-z][\w-]*-/.test(text)) return null
	const tokens = text.split(/(\s+)/) // keep whitespace separators
	const parsed = tokens.map((t, i) => {
		if (/^\s*$/.test(t) || t === '') return null
		if (EXACT[t] !== undefined) return { i, exact: true }
		// variant-prefixed exact tokens (sm:text-[12px], hover:shadow-[...])
		const vm = t.match(/^((?:[\w[\]()&>~.*/=-]+:)+)(.+)$/)
		if (vm && EXACT[vm[2]] !== undefined && EXACT[vm[2]] !== '') return { i, exact: true, variantExact: vm }
		const m = t.match(COLOR_UTIL)
		if (!m) return null
		return { i, variants: m[1], prop: m[2], value: m[3] }
	})
	const items = parsed.filter(Boolean)
	if (items.length === 0) return null

	const out = [...tokens]
	const consumed = new Set()

	// exact tokens (shadows, animations, gradients) first
	for (const it of items) {
		if (!it.exact) continue
		const repl = it.variantExact ? it.variantExact[1] + EXACT[it.variantExact[2]] : EXACT[tokens[it.i]]
		out[it.i] = repl // '' removes the token
		consumed.add(it.i)
	}

	// pair collapse: base token + dark:-variant partner of same prop
	for (const a of items) {
		if (a.exact || consumed.has(a.i) || a.variants.includes('dark:')) continue
		const partner = items.find(
			(b) =>
				b !== a &&
				!b.exact &&
				!consumed.has(b.i) &&
				b.prop === a.prop &&
				b.variants.includes('dark:') &&
				b.variants.replace(/dark:/, '') === a.variants
		)
		if (!partner) continue
		const key = lcHex(`${a.prop}|${a.value}|${partner.value}`)
		const repl = MAP[key]
		if (!repl) continue
		out[a.i] = a.variants + repl
		out[partner.i] = ''
		consumed.add(a.i)
		consumed.add(partner.i)
	}

	// singles
	for (const it of items) {
		if (it.exact || consumed.has(it.i)) continue
		const key = lcHex(`${it.prop}|${it.value}`)
		// dark:-scoped singles resolve against the roles' DARK values first
		let repl = (it.variants.includes('dark:') ? DARKSIDE[key] : undefined) ?? MAP[key]
		// unseen opacity modifier: look up the solid core and re-append the
		// modifier (value-preserving; only when the role itself carries none)
		if (!repl) {
			const mm = it.value.match(/^(.*?)\/((?:[\d.]+|\[[^\]]+\]))$/)
			if (mm) {
				const core = MAP[lcHex(`${it.prop}|${mm[1]}`)]
				if (core && !core.includes('/')) {
					let mod = mm[2].replace(/[[\]]/g, '')
					if (/^0?\.\d+$/.test(mod)) mod = String(parseFloat(mod) * 100)
					repl = `${core}/${mod}`
				}
			}
		}
		if (!repl) {
			report.set(tokens[it.i], (report.get(tokens[it.i]) ?? 0) + 1)
			continue
		}
		out[it.i] = it.variants + repl
		consumed.add(it.i)
	}

	if (consumed.size === 0) return null
	// collapse doubled whitespace left by removed tokens
	return out
		.join('')
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/^ | $/g, (m) => (text.startsWith(' ') || text.endsWith(' ') ? m : ''))
}

function processFile(file) {
	const source = fs.readFileSync(file, 'utf8')
	const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const edits = [] // {start, end, text} — replace the literal's inner text
	const visit = (node) => {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
			const inner = node.getText(sf).slice(1, -1)
			const next = rewriteClassList(inner)
			if (next != null && next !== inner)
				edits.push({ start: node.getStart(sf) + 1, end: node.getEnd() - 1, text: next })
		} else if (ts.isTemplateExpression(node)) {
			const headText = node.head.text
			const headRaw = node.head.rawText ?? headText
			const h = rewriteClassList(headRaw)
			if (h != null && h !== headRaw)
				edits.push({ start: node.head.getStart(sf) + 1, end: node.head.getEnd() - 2, text: h })
			for (const span of node.templateSpans) {
				const raw = span.literal.rawText ?? span.literal.text
				const r = rewriteClassList(raw)
				if (r != null && r !== raw) {
					const isTail = ts.isTemplateTail(span.literal)
					edits.push({ start: span.literal.getStart(sf) + 1, end: span.literal.getEnd() - (isTail ? 1 : 2), text: r })
				}
			}
		}
		ts.forEachChild(node, visit)
	}
	visit(sf)
	if (edits.length === 0) return 0
	let outSrc = source
	for (const e of edits.sort((a, b) => b.start - a.start)) {
		outSrc = outSrc.slice(0, e.start) + e.text + outSrc.slice(e.end)
	}
	if (write) fs.writeFileSync(file, outSrc)
	return edits.length
}

let total = 0
let filesChanged = 0
for (const target of targets) {
	const stat = fs.statSync(target)
	const files = stat.isDirectory()
		? fs
				.readdirSync(target, { recursive: true })
				.filter((f) => /\.(tsx|ts)$/.test(f))
				.map((f) => path.join(target, f))
		: [target]
	for (const f of files) {
		const n = processFile(f)
		if (n) {
			filesChanged++
			total += n
		}
	}
}
console.log(`${write ? 'rewrote' : 'would rewrite'} ${total} literals in ${filesChanged} files`)
if (report.size > 0) {
	console.log('\nunmapped color tokens:')
	for (const [t, n] of [...report.entries()].sort((a, b) => b[1] - a[1])) console.log(` ${n}\t${t}`)
}
