// @vitest-environment happy-dom

import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SlashCommandItem } from '../editor/slashCommand'
import { SlashCommandList, type SlashCommandListHandle } from '../editor/SlashCommandList'

function item(id: string, group: string): SlashCommandItem {
	// No icon or description, so the option's text is exactly its title.
	return { id, title: id, description: '', icon: '', group, action: vi.fn() }
}

describe('SlashCommandList', () => {
	let container: HTMLDivElement
	let root: Root

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

	test('wraps navigation, ignores composition, and resets the highlight for new results', async () => {
		const handle = createRef<SlashCommandListHandle>()
		const command = vi.fn()
		const items = [item('heading', 'Blocks'), item('quote', 'Blocks')]
		await act(async () => root.render(<SlashCommandList ref={handle} items={items} command={command} />))
		await act(async () => {
			handle.current!.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
		})
		await act(async () => {
			handle.current!.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }))
		})
		expect(command).not.toHaveBeenCalled()
		await act(async () => {
			handle.current!.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }))
		})
		expect(command).toHaveBeenLastCalledWith(items[1])
		await act(async () => root.render(<SlashCommandList ref={handle} items={[items[0]]} command={command} />))
		await act(async () => {
			handle.current!.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }))
		})
		expect(command).toHaveBeenLastCalledWith(items[0])
	})

	test('keeps an empty named list available when nothing matches', async () => {
		await act(async () => {
			root.render(<SlashCommandList items={[]} command={vi.fn()} />)
		})

		expect(container.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe('Insert a block')
		expect(container.textContent).toContain('No matches')
	})
})
