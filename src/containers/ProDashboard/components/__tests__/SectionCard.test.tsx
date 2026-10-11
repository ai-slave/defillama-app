// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SectionCard } from '../SectionCard'

let root: Root
let container: HTMLDivElement
const onUpdate = vi.fn()

beforeEach(() => {
	onUpdate.mockReset()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renameTo(text: string) {
	await act(async () =>
		root.render(
			<SectionCard
				section={{ id: 's1', kind: 'section', title: 'Revenue', displayAs: 'heading' }}
				itemCount={2}
				collapsed={false}
				onToggleCollapsed={vi.fn()}
				contentId="s1-content"
				editing={{
					autoFocusTitle: false,
					onUpdate,
					onMove: vi.fn(),
					canMoveUp: false,
					canMoveDown: false,
					onDelete: vi.fn(),
					onAddSectionBelow: vi.fn()
				}}
			/>
		)
	)
	const title = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Revenue')!
	await act(async () => title.click())
	const input = container.querySelector<HTMLInputElement>('input[aria-label="Section title"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
}

test('clearing the section title keeps its previous name', async () => {
	await renameTo('   ')
	expect(onUpdate).not.toHaveBeenCalled()
	expect([...container.querySelectorAll('button')].some((button) => button.textContent === 'Revenue')).toBe(true)
})

test('a new section title saves', async () => {
	await renameTo('Fees')
	expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ title: 'Fees' })
})
