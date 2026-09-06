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

/** One entry per option: the group header rendered directly above it, or null when it continues a run. */
function headersByOption(container: HTMLElement): Array<{ option: string; header: string | null }> {
	const rows = container.querySelectorAll<HTMLElement>('[role="listbox"] > div')
	return Array.from(rows, (row) => {
		const first = row.firstElementChild
		return {
			option: row.querySelector('button')?.textContent?.trim() ?? '',
			header: first && first.tagName === 'DIV' ? (first.textContent?.trim() ?? '') : null
		}
	})
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

		expect(headersByOption(container)).toEqual([
			{ option: 'h1', header: 'Blocks' },
			{ option: 'h2', header: null },
			{ option: 'image', header: 'Media' },
			{ option: 'quote', header: 'Blocks' }
		])
	})

	test('renders the empty state without a listbox when nothing matches', async () => {
		await act(async () => {
			root.render(<SlashCommandList items={[]} command={vi.fn()} />)
		})

		expect(container.querySelector('[role="listbox"]')).toBeNull()
		expect(container.textContent).toContain('No matches')
	})
})
