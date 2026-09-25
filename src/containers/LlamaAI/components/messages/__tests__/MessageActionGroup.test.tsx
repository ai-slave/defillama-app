// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ActionButtonGroup } from '../MessageActionGroup'

let root: Root
let container: HTMLDivElement
const actions = [
	{ label: 'Create alert', message: 'confirm:Create an alert' },
	{ label: 'Compare', message: 'Compare chains' }
]
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a gated click does not claim success; the conversation supplies the receipt', async () => {
	const send = vi.fn()
	await act(async () => root.render(<ActionButtonGroup actions={actions} onActionClick={send} />))
	const button = container.querySelector('button')!
	await act(async () => button.click())
	expect(send).toHaveBeenCalledExactlyOnceWith('Create an alert')
	expect(container.textContent).not.toContain('Sent')
	expect(button.hasAttribute('aria-pressed')).toBe(false)
	await act(async () =>
		root.render(<ActionButtonGroup actions={actions} onActionClick={send} nextUserMessage="Create an alert" />)
	)
	expect(button.textContent).toContain('Sent')
	expect(container.querySelectorAll('button')[1].textContent).not.toContain('Sent')
	await act(async () =>
		root.render(<ActionButtonGroup actions={actions} onActionClick={send} nextUserMessage="An unrelated prompt" />)
	)
	expect(container.textContent).not.toContain('Sent')
})

test('restored history identifies the sent action and read-only actions cannot submit', async () => {
	await act(async () => root.render(<ActionButtonGroup actions={actions} nextUserMessage="Compare chains" />))
	expect(container.querySelectorAll('button')[1].textContent).toContain('Sent')
	expect([...container.querySelectorAll('button')].every((b) => b.disabled)).toBe(true)
})

test('link suggestions remain navigable without a submission callback', async () => {
	await act(async () =>
		root.render(<ActionButtonGroup actions={[{ label: 'Source', message: 'url:https://defillama.com' }]} />)
	)
	expect(container.querySelector('a')?.href).toBe('https://defillama.com/')
	expect(container.querySelector('a')?.rel).toBe('noopener noreferrer')
})
