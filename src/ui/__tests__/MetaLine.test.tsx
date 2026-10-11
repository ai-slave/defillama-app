// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { MetaLine } from '../MetaLine'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('separators sit between the items and stay out of the accessibility tree', async () => {
	await act(async () => root.render(<MetaLine>{['9 cards', '52 views', 'Updated 4d ago']}</MetaLine>))
	const separators = [...container.querySelectorAll('span[aria-hidden="true"]')]
	expect(separators).toHaveLength(2)
	expect(separators.every((separator) => separator.textContent === '·')).toBe(true)
	expect(container.textContent).toBe('9 cards·52 views·Updated 4d ago')
})

test('an only item gets no separator and empty items are dropped', async () => {
	await act(async () => root.render(<MetaLine>{['9 cards', null, undefined, false, '']}</MetaLine>))
	expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0)
	expect(container.textContent).toBe('9 cards')
})

test('nothing renders when every item is empty', async () => {
	await act(async () =>
		root.render(
			<MetaLine>
				{null}
				{undefined}
			</MetaLine>
		)
	)
	expect(container.innerHTML).toBe('')
})

test('each child is one item and an empty child drops out with its dot', async () => {
	const author = ''
	await act(async () =>
		root.render(
			<MetaLine>
				{`${9} cards`}
				{author}
				<span>Updated 4d ago</span>
			</MetaLine>
		)
	)
	expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1)
	expect(container.textContent).toBe('9 cards·Updated 4d ago')
})
