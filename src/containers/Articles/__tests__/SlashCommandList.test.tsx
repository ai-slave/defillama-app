// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SlashCommandItem } from '../editor/slashCommand'
import { SlashCommandList } from '../editor/SlashCommandList'

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

	test('opens a group header at the start of every run of consecutive items sharing a group', async () => {
		const items = [item('h1', 'Blocks'), item('h2', 'Blocks'), item('image', 'Media'), item('quote', 'Blocks')]
		await act(async () => {
			root.render(<SlashCommandList items={items} command={vi.fn()} />)
		})

		// Text order captures group boundaries without depending on wrapper tags or nesting.
		expect(container.querySelector('[role="listbox"]')?.textContent?.replace(/\s+/g, '')).toBe(
			'Blocksh1h2MediaimageBlocksquote'
		)
	})

	test('renders the empty state without a listbox when nothing matches', async () => {
		await act(async () => {
			root.render(<SlashCommandList items={[]} command={vi.fn()} />)
		})

		expect(container.querySelector('[role="listbox"]')).toBeNull()
		expect(container.textContent).toContain('No matches')
	})
})
