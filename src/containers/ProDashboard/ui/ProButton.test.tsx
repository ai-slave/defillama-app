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

test('primary carries the tinted fill without the neutral border', async () => {
	await act(async () => root.render(<ProButton type="button">Add card</ProButton>))
	expect(container.querySelector('button')!.className).toContain('border-pro-cards-border')

	await act(async () =>
		root.render(
			<ProButton type="button" variant="primary">
				Add card
			</ProButton>
		)
	)
	const primary = container.querySelector('button')!
	expect(primary.className).toContain('bg-pro-info-100')
	expect(primary.className).not.toContain('border-pro-cards-border')
})

test('square drops the horizontal padding for an icon-only control', async () => {
	await act(async () =>
		root.render(
			<ProButton type="button" square size="sm" aria-label="Remove card">
				×
			</ProButton>
		)
	)
	const button = container.querySelector('button')!
	expect(button.className).toContain('aspect-square')
	expect(button.className).toContain('min-h-6')
	expect(button.className).not.toContain('px-2')
})

test('lg is the empty-state call to action height', async () => {
	await act(async () =>
		root.render(
			<ProButton type="button" size="lg">
				Add your first card
			</ProButton>
		)
	)
	const button = container.querySelector('button')!
	expect(button.className).toContain('min-h-10')
	expect(button.className).toContain('px-5')
	expect(button.className).toContain('text-base')
})

test('aria-disabled reaches the element and layout className is appended', async () => {
	await act(async () =>
		root.render(
			<ProButton type="button" aria-disabled className="ml-auto">
				Add card
			</ProButton>
		)
	)
	const button = container.querySelector('button')!
	expect(button.getAttribute('aria-disabled')).toBe('true')
	expect(button.className).toContain('ml-auto')
	expect(button.className).toContain('aria-disabled:opacity-60')
})

test('the press and colour transition come from the motion system, not a focus ring', async () => {
	await act(async () => root.render(<ProButton type="button">Add card</ProButton>))
	const button = container.querySelector('button')!
	expect(button.className).toContain('transition-[color,background-color,border-color,translate,scale]')
	expect(button.className).toContain('duration-120')
	expect(button.className).toContain('ease-out-quart')
	expect(button.className).toContain('active:translate-y-px')
	expect(button.className).toContain('active:scale-[.985]')
	expect(button.className).toContain('disabled:active:translate-none')
	expect(button.className).toContain('disabled:active:scale-none')
	expect(button.className).toContain('aria-disabled:active:translate-none')
	expect(button.className).toContain('aria-disabled:active:scale-none')
	expect(button.className).not.toContain('focus-visible:ring-1')
	expect(button.className).not.toContain('transition-colors')
	expect(button.className).not.toContain('transform-none')
})

test('icon renders before the label', async () => {
	await act(async () =>
		root.render(
			<ProButton type="button" icon={<span data-testid="pencil">✎</span>}>
				Edit
			</ProButton>
		)
	)
	const button = container.querySelector('button')!
	expect(button.firstElementChild!.getAttribute('data-testid')).toBe('pencil')
	expect(button.textContent).toBe('✎Edit')
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
	expect(button.querySelector('.animate-spin')).not.toBeNull()
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
	expect(link.getAttribute('aria-busy')).toBe('true')
	expect(link.getAttribute('aria-disabled')).toBe('true')
	expect(link.hasAttribute('disabled')).toBe(false)
	expect(link.querySelector('.animate-spin')).not.toBeNull()
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

test('as renders another element and keeps the recipe', async () => {
	await act(async () =>
		root.render(
			<ProButton as="a" href="/pro" variant="ghost">
				Dashboards
			</ProButton>
		)
	)
	expect(container.querySelector('button')).toBeNull()
	const link = container.querySelector('a')!
	expect(link.getAttribute('href')).toBe('/pro')
	expect(link.className).toContain('rounded-md')
})
