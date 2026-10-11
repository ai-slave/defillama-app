// Control-row audit: loads pages from a running dev server in headless Chrome and lists controls that sit in one row
// but differ in height or center line (a 36px button beside 32px fields, a badge that grows its tab), and controls
// whose content sits off their padding (an invisible flex item pushing a label right). Reading class
// strings cannot find these: they come from layout (flex and grid stretch, subgrid gaps, content taller than the
// label line), so the audit measures the rendered boxes.
//
//   bun run audit:control-rows                    # the default routes on http://localhost:3000
//   bun run audit:control-rows /yields /chains    # only these routes
//   BASE=http://localhost:3001 CHROME_PATH=… bun run audit:control-rows
//
// Desktop width only: control heights come from one scale at every width, so a mismatch shows here too. It exits 1
// when it finds a row to fix. Start the dev server first (`bun run dev:prepared`).
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_ROUTES = [
	'/',
	'/chains',
	'/chain/ethereum',
	'/protocol/aave',
	'/yields',
	'/stablecoins',
	'/dexs',
	'/fees',
	'/bridges',
	'/unlocks',
	'/cexs',
	'/downloads',
	'/metrics',
	'/research',
	'/reports',
	'/newsletters',
	'/ai',
	'/subscription',
	'/exchanges'
]

const base = process.env.BASE ?? 'http://localhost:3000'
const routes = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_ROUTES
const chromePath =
	process.env.CHROME_PATH ??
	(process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome')
const port = 9444

// Runs in the page. Two controls share a row when they overlap vertically by half the shorter one, sit within 48px
// of each other, and their nearest shared flex or grid container is at most three levels above both, so controls in
// neighboring cards are not compared. Heights are compared only between controls drawn as boxes (a border or a
// fill), since a bare icon button beside a 32px button is fine; centers are compared for all. A button inside a
// bordered wrapper that is the visible field is measured by the wrapper.
const PROBE = `(() => {
	const SEL = 'button, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]), textarea, [role=combobox], [role=tab], [role=radio], [role=checkbox], a, label:has(> input[type=radio]), label:has(> input[type=checkbox])'
	const visible = (el) => {
		const cs = getComputedStyle(el)
		if (cs.visibility === 'hidden' || Number(cs.opacity) === 0 || !el.checkVisibility()) return false
		const r = el.getBoundingClientRect()
		return r.width >= 12 && r.height >= 16 && r.height <= 64
	}
	const boxed = (el) => {
		const cs = getComputedStyle(el)
		return parseFloat(cs.borderTopWidth) > 0 || !/rgba\\(0, 0, 0, 0\\)|transparent/.test(cs.backgroundColor)
	}
	const drawnAsControl = (el) => el.tagName !== 'A' || boxed(el)
	// A segment or a field's inner button is measured by the bordered track or wrapper around it, found within two
	// levels (a tooltip anchor can sit in between) and at most 8.5px taller.
	const box = (el) => {
		const r = el.getBoundingClientRect()
		for (let p = el.parentElement, depth = 0; p && depth < 2; p = p.parentElement, depth++) {
			const pr = p.getBoundingClientRect()
			const grow = pr.height - r.height
			if (parseFloat(getComputedStyle(p).borderTopWidth) > 0 && grow > 0 && grow <= 8.5) return pr
		}
		return r
	}
	const ancestors = (el) => {
		const list = []
		for (let n = el.parentElement; n; n = n.parentElement) list.push(n)
		return list
	}
	const sameRow = (a, b) => {
		const pa = ancestors(a)
		const pb = ancestors(b)
		const shared = pa.find((n) => pb.includes(n))
		if (!shared || pa.indexOf(shared) > 2 || pb.indexOf(shared) > 2) return false
		const d = getComputedStyle(shared).display
		return d.includes('flex') || d.includes('grid')
	}
	const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 32)
	const items = [...document.querySelectorAll(SEL)]
		.filter((el) => visible(el) && drawnAsControl(el) && !el.parentElement?.closest(SEL))
		.map((el) => ({ el, r: box(el) }))
	const found = []
	const seen = new Set()
	for (let i = 0; i < items.length; i++) {
		for (let j = i + 1; j < items.length; j++) {
			const a = items[i], b = items[j]
			const overlap = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
			if (overlap < Math.min(a.r.height, b.r.height) / 2) continue
			const gap = Math.max(a.r.left, b.r.left) - Math.min(a.r.right, b.r.right)
			if (gap > 48 || gap < -2) continue
			const dh = boxed(a.el) && boxed(b.el) ? Math.abs(a.r.height - b.r.height) : 0
			const dc = Math.abs((a.r.top + a.r.bottom) / 2 - (b.r.top + b.r.bottom) / 2)
			if ((dh < 1.5 && dc < 1.5) || !sameRow(a.el, b.el)) continue
			const key = label(a.el) + '|' + label(b.el)
			if (seen.has(key)) continue
			seen.add(key)
			found.push([label(a.el), Math.round(a.r.height), label(b.el), Math.round(b.r.height), Math.round(dc * 10) / 10])
		}
	}
	// Content off its padding: a boxed flex control whose visible content starts later than its padding, or sits off
	// center when it is centered, has something invisible taking space (an unpositioned pseudo-element in the gap, a
	// stray margin). Text and icons that are hidden (visibility, sr-only, absolute) do not count.
	const inset = []
	for (const { el } of items) {
		const cs = getComputedStyle(el)
		if (!boxed(el) || !cs.display.includes('flex')) continue
		const parts = []
		const walk = (node) => {
			for (const child of node.childNodes) {
				if (child.nodeType === 3 && child.textContent.trim()) {
					const range = document.createRange()
					range.selectNodeContents(child)
					const r = range.getBoundingClientRect()
					if (r.width > 0 && getComputedStyle(child.parentElement).visibility !== 'hidden') parts.push(r)
				} else if (child.nodeType === 1) {
					const ccs = getComputedStyle(child)
					if (ccs.visibility === 'hidden' || ccs.display === 'none') continue
					const media = child.tagName === 'svg' || child.tagName === 'IMG'
					// Positioned decoration and sr-only text sit outside the flow; a positioned image (a themed logo) is content.
					if ((ccs.position === 'absolute' || ccs.position === 'fixed') && !media) continue
					// An icon, an image or a drawn box inside the control (a count badge, an icon tile) counts by its edge.
					if (media || boxed(child)) {
						const r = child.getBoundingClientRect()
						if (r.width > 0) parts.push(r)
					} else walk(child)
				}
			}
		}
		walk(el)
		if (parts.length === 0) continue
		const r = el.getBoundingClientRect()
		const left = Math.min(...parts.map((p) => p.left))
		const right = Math.max(...parts.map((p) => p.right))
		const lead = left - r.left - parseFloat(cs.borderLeftWidth) - parseFloat(cs.paddingLeft)
		const trail = r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight) - right
		if (lead < -0.5 || trail < -0.5) continue
		const centered = cs.justifyContent === 'center'
		// A control whose first real child starts on its padding edge lays out correctly; an offset inside that child
		// (a padded icon tile in a two-state switch) is the child's design. Empty children do not count as first.
		const firstChild = [...el.children]
			.filter((child) => {
				const ccs = getComputedStyle(child)
				return child.getBoundingClientRect().width > 0 && ccs.position !== 'absolute' && ccs.display !== 'none'
			})
			.map((child) => child.getBoundingClientRect().left)
			.concat(
				[...el.childNodes]
					.filter((node) => node.nodeType === 3 && node.textContent.trim())
					.map((node) => {
						const range = document.createRange()
						range.selectNodeContents(node)
						return range.getBoundingClientRect().left
					})
			)
		const childLead = Math.min(...firstChild) - r.left - parseFloat(cs.borderLeftWidth) - parseFloat(cs.paddingLeft)
		if (!centered && childLead <= 1.5) continue
		if (Math.abs(lead - trail) > 1.5 && (centered || lead > 1.5))
			inset.push([label(el), Math.round(lead * 10) / 10, Math.round(trail * 10) / 10, el.tagName.toLowerCase() + '.' + String(el.className).split(/\\s+/).slice(0, 6).join('.')])
	}
	return { rows: found, inset }
})()`

const chrome = spawn(chromePath, [
	'--headless=new',
	`--remote-debugging-port=${port}`,
	`--user-data-dir=${mkdtempSync(join(tmpdir(), 'control-rows-'))}`,
	'--hide-scrollbars',
	'--no-first-run',
	'--no-default-browser-check',
	'about:blank'
])
chrome.stderr.on('data', () => {})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let pageTarget: { type: string; webSocketDebuggerUrl: string } | undefined
for (let attempt = 0; attempt < 50 && !pageTarget; attempt++) {
	await sleep(200)
	const targets: Array<{ type: string; webSocketDebuggerUrl: string }> = await fetch(
		`http://127.0.0.1:${port}/json/list`
	)
		.then((res) => res.json())
		.catch(() => [])
	pageTarget = targets.find((target) => target.type === 'page')
}
if (!pageTarget) throw new Error(`Chrome did not start at ${chromePath}; set CHROME_PATH`)

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
let nextId = 1
const pending = new Map<number, (message: any) => void>()
let onLoad: (() => void) | null = null
ws.addEventListener('message', (event) => {
	const message = JSON.parse(String(event.data))
	if (message.id) pending.get(message.id)?.(message)
	else if (message.method === 'Page.loadEventFired') onLoad?.()
})
const send = (method: string, params: object = {}) =>
	new Promise<any>((resolve) => {
		const id = nextId++
		pending.set(id, resolve)
		ws.send(JSON.stringify({ id, method, params }))
	})
const evaluate = async (expression: string) =>
	(await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

const nextLoad = () =>
	new Promise<void>((resolve) => {
		onLoad = resolve
	})

let total = 0
for (const route of routes) {
	const loaded = nextLoad()
	await send('Page.navigate', { url: base + route })
	await Promise.race([loaded, sleep(30_000)])
	await sleep(4000)
	// Scroll once through the page so lazily mounted sections render before the measure.
	await evaluate(
		'(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) } scrollTo(0, 0) })()'
	)
	await sleep(1000)
	const {
		rows,
		inset
	}: { rows: Array<[string, number, string, number, number]>; inset: Array<[string, number, number, string]> } =
		(await evaluate(PROBE)) ?? { rows: [], inset: [] }
	total += rows.length + inset.length
	console.log(
		`${route}  ${rows.length + inset.length === 0 ? 'ok' : `${rows.length} row(s), ${inset.length} inset(s)`}`
	)
	for (const [a, ah, b, bh, dc] of rows) console.log(`  ${a} (${ah}px) beside ${b} (${bh}px), centers ${dc}px apart`)
	for (const [name, lead, trail, where] of inset)
		console.log(`  ${name}: content ${lead}px past its left padding, ${trail}px before its right (${where})`)
}

ws.close()
chrome.kill()
process.exit(total > 0 ? 1 : 0)
