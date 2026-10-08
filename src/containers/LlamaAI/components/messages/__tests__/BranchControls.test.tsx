// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { BranchArrows } from '../BranchControls'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const siblings = [
	{ messageId: 'm1', leafMessageId: 'leaf-1' },
	{ messageId: 'm2', leafMessageId: 'leaf-2' }
]

function Versions() {
	const [current, setCurrent] = useState(1)
	return (
		<BranchArrows
			info={{ currentVersion: current, totalVersions: 2, siblings }}
			onSwitch={(leaf) => setCurrent(siblings.findIndex((sibling) => sibling.leafMessageId === leaf) + 1)}
		/>
	)
}

test('stepping to the last version keeps focus on the arrow that just disabled itself', async () => {
	await act(async () => root.render(<Versions />))
	const next = container.querySelector<HTMLButtonElement>('[aria-label="Next version"]')!
	const previous = container.querySelector<HTMLButtonElement>('[aria-label="Previous version"]')!
	expect(previous.getAttribute('aria-disabled')).toBe('true')

	act(() => next.focus())
	await act(async () => next.click())

	expect(container.textContent).toContain('2/2')
	expect(next.getAttribute('aria-disabled')).toBe('true')
	expect(document.activeElement).toBe(next)
	expect(previous.getAttribute('aria-disabled')).toBeNull()

	// A disabled arrow swallows presses instead of switching again.
	await act(async () => next.click())
	expect(container.textContent).toContain('2/2')
})
