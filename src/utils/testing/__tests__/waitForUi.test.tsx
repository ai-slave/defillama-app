// @vitest-environment happy-dom
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { waitForUi } from '../waitForUi'

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
	vi.restoreAllMocks()
})

function LateText() {
	const [text, setText] = useState('loading')
	useEffect(() => {
		const timer = setTimeout(() => setText('ready'), 10)
		return () => clearTimeout(timer)
	}, [])
	return <p>{text}</p>
}

test('waits for an update that lands after render without an act warning', async () => {
	const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
	await act(async () => root.render(<LateText />))

	await waitForUi(() => expect(container.textContent).toBe('ready'))

	expect(errors.mock.calls.filter(([message]) => String(message).includes('not wrapped in act'))).toEqual([])
})
