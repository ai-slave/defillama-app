// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ProButton } from './ProButton'

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

test('loading swaps the icon for a spinner, marks the control busy and swallows clicks', async () => {
	const onClick = vi.fn()
	await act(async () =>
		root.render(
			<ProButton type="button" loading icon={<span data-testid="pencil">✎</span>} onClick={onClick}>
				Edit
			</ProButton>
		)
	)
	const button = container.querySelector('button')!
	expect(button.getAttribute('aria-busy')).toBe('true')
	expect(button.getAttribute('aria-disabled')).toBe('true')
	expect(button.querySelector('[data-testid="pencil"]')).toBeNull()
	await act(async () => button.click())
	expect(onClick).not.toHaveBeenCalled()
})

test('a loading link stays a link, marked busy, with its click swallowed', async () => {
	const onClick = vi.fn()
	await act(async () =>
		root.render(
			<ProButton as="a" href="/pro" loading onClick={onClick}>
				Open dashboard
			</ProButton>
		)
	)
	const link = container.querySelector('a')!
	expect(link.getAttribute('href')).toBe('/pro')
	expect(link.getAttribute('aria-busy')).toBe('true')
	expect(link.getAttribute('aria-disabled')).toBe('true')
	expect(link.hasAttribute('disabled')).toBe(false)
	await act(async () => link.click())
	expect(onClick).not.toHaveBeenCalled()
})

test('a control that is not loading keeps its click handler', async () => {
	const onClick = vi.fn()
	await act(async () =>
		root.render(
			<ProButton type="button" onClick={onClick}>
				Add card
			</ProButton>
		)
	)
	await act(async () => container.querySelector('button')!.click())
	expect(onClick).toHaveBeenCalledOnce()
})
