// @vitest-environment happy-dom
import { expect, test } from 'vitest'
import { tabTo } from '../keyboard'

test('tabTo presses Tab on the focused element, then focuses the target', async () => {
	const [from, to] = [document.createElement('button'), document.createElement('button')]
	document.body.append(from, to)
	from.focus()
	const keys: Array<string> = []
	from.addEventListener('keydown', (event) => keys.push(`${event.key} on ${document.activeElement === from}`))
	await tabTo(to)
	expect(keys).toEqual(['Tab on true'])
	expect(document.activeElement).toBe(to)
	from.remove()
	to.remove()
})
