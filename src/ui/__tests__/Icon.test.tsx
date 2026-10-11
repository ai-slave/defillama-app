import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Icon, ICON_GROUPS, ICON_NAMES, ICON_SPRITE } from '../Icon'

const sprite = readFileSync(join(process.cwd(), 'public', ICON_SPRITE), 'utf8')
const symbols = [...sprite.matchAll(/<symbol\s([^>]*)>([\s\S]*?)<\/symbol>/g)].map(([, attrs, body]) => ({
	id: /\bid="([^"]+)"/.exec(attrs)![1],
	attrs,
	body
}))

test('Icon renders the sprite ICON_SPRITE names', () => {
	expect(renderToStaticMarkup(<Icon name="search" />)).toBe(
		`<svg fill="none"><use href="${ICON_SPRITE}#search"></use></svg>`
	)
})

test('the sprite lists every icon once, in ICON_GROUPS order, under its group comment', () => {
	const groups: Array<[string, Array<string>]> = []
	for (const [, label, id] of sprite.matchAll(/<!-- (.+?) -->|<symbol\s[^>]*\bid="([^"]+)"/g)) {
		if (label) groups.push([label, []])
		else groups.at(-1)![1].push(id)
	}
	expect(groups).toEqual(ICON_GROUPS.map(([label, names]) => [label, [...names]]))
})

// Interface icons share Lucide's grid: a 24px canvas, a 2px stroke and currentColor, so any two sit evenly in a row and
// follow their control's color. Brand logos keep their own shapes and colors, and DefiLlama's product marks their own
// art on a square canvas.
const OWN_ART = new Set<string>(['DefiLlama', 'Brands'])
// Two status marks are solid so they read at a glance: the verified seal, and the warning triangle, whose knockout
// mark is white because the triangle is only ever drawn in a status color.
const STYLE_EXCEPTIONS = new Set(['badge-check', 'alert-triangle-filled'])
// These leave fill off the symbol so `fill-current` on the Icon can show an on state; a fill on the symbol would win.
const FILLABLE = new Set(['star', 'bookmark', 'pin'])

test('interface icons follow the Lucide grid, stroke and color rules', () => {
	const ownArt = new Set<string>(ICON_GROUPS.flatMap(([label, names]) => (OWN_ART.has(label) ? names : [])))
	const problems: Array<string> = []
	for (const { id, attrs, body } of symbols) {
		const viewBox = /viewBox="([^"]+)"/.exec(attrs)?.[1] ?? ''
		const [, , width, height] = viewBox.split(' ')
		if (ownArt.has(id)) {
			if (width !== height) problems.push(`${id}: viewBox ${viewBox} is not square`)
			continue
		}
		if (STYLE_EXCEPTIONS.has(id)) continue
		if (FILLABLE.has(id) === /\bfill="/.test(attrs)) problems.push(`${id}: fill on the symbol`)
		const svg = attrs + body
		if (viewBox !== '0 0 24 24') problems.push(`${id}: viewBox ${viewBox}`)
		if (/transform=|clip-path|<style|<defs/.test(svg)) problems.push(`${id}: transform, clip-path or style`)
		for (const [, color] of svg.matchAll(/\b(?:fill|stroke)="([^"]+)"/g)) {
			if (color !== 'none' && color !== 'currentColor') problems.push(`${id}: color ${color}`)
		}
		const widths = [...svg.matchAll(/stroke-width="([^"]+)"/g)].map((match) => match[1])
		if (widths.some((strokeWidth) => strokeWidth !== '2')) problems.push(`${id}: stroke-width ${widths.join(', ')}`)
		if (!attrs.includes('stroke="currentColor"') || widths.length === 0)
			problems.push(`${id}: not a currentColor stroke`)
	}
	expect(problems).toEqual([])
})

test('every icon name has a symbol in the sprite, and every symbol has a name', () => {
	const ids = symbols.map((symbol) => symbol.id)
	expect(ICON_NAMES.filter((name) => !ids.includes(name))).toEqual([])
	expect(ids.filter((id) => !(ICON_NAMES as ReadonlyArray<string>).includes(id))).toEqual([])
})

// pages.json names nav and directory icons as plain strings, which typecheck cannot hold to Icon's names.
test('every icon pages.json names exists', () => {
	const pages = readFileSync(join(process.cwd(), 'public', 'pages.json'), 'utf8')
	const names = [...pages.matchAll(/"icon":\s*"([^"]+)"/g)].map((match) => match[1])
	expect(names.filter((name) => !(ICON_NAMES as ReadonlyArray<string>).includes(name))).toEqual([])
})
