import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Icon, ICON_NAMES } from '../Icon'

// The sprite is read from the path Icon renders, so a version bump moves this test with the component.
function spriteSymbolIds() {
	const href = /href="([^"#]+)#/.exec(renderToStaticMarkup(<Icon name="search" />))![1]
	const sprite = readFileSync(join(process.cwd(), 'public', href), 'utf8')
	return [...sprite.matchAll(/<symbol[^>]*\sid="([^"]+)"/g)].map((match) => match[1])
}

test('every icon name has a symbol in the sprite, and every symbol has a name', () => {
	const ids = spriteSymbolIds()
	expect(ICON_NAMES.filter((name) => !ids.includes(name))).toEqual([])
	expect(ids.filter((id) => !(ICON_NAMES as ReadonlyArray<string>).includes(id))).toEqual([])
})

// pages.json names nav and directory icons as plain strings, which typecheck cannot hold to Icon's names.
test('every icon pages.json names exists', () => {
	const pages = readFileSync(join(process.cwd(), 'public', 'pages.json'), 'utf8')
	const names = [...pages.matchAll(/"icon":\s*"([^"]+)"/g)].map((match) => match[1])
	expect(names.filter((name) => !(ICON_NAMES as ReadonlyArray<string>).includes(name))).toEqual([])
})
