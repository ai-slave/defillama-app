// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { QueryResult } from '../exportResults'
import { ResultsPanel } from '../ResultsPanel'

vi.mock('../ResultsChart', () => ({ ResultsChart: () => <div>Chart content</div> }))
vi.mock('../ResultsGrid', () => ({ ResultsGrid: () => <div>Table content</div> }))
vi.mock('../../FormatSplitButton', () => ({ FormatSplitButton: () => null }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test.each(['table', 'chart'] as const)(
	'empty results disable both views without changing %s selection',
	async (view) => {
		const onViewChange = vi.fn()
		const render = async (rows: QueryResult['rows'], running = false) => {
			await act(async () =>
				root.render(
					<ResultsPanel
						result={{ columns: [{ name: 'value', type: 'INTEGER' }], rows }}
						running={running}
						chartConfig={undefined}
						onChartConfigChange={vi.fn()}
						view={view}
						onViewChange={onViewChange}
					/>
				)
			)
		}
		await render([])
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
		await act(async () => {
			for (const button of buttons) {
				expect(button.disabled).toBe(true)
				button.click()
			}
		})
		expect(onViewChange).not.toHaveBeenCalled()
		expect(container.querySelector('[aria-selected="true"]')?.textContent).toBe(view === 'table' ? 'Table' : 'Chart')

		// A refresh may keep the previous result visible and usable while running.
		await render([[1]], true)
		expect(buttons.every((button) => !button.disabled)).toBe(true)
		await act(async () => buttons[view === 'table' ? 1 : 0].click())
		expect(onViewChange.mock.calls).toEqual([[view === 'table' ? 'chart' : 'table']])
		await render([])
		expect(buttons.every((button) => button.disabled)).toBe(true)
	}
)

test('uncontrolled populated results still switch between table and chart', async () => {
	await act(async () =>
		root.render(
			<ResultsPanel
				result={{ columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] }}
				running={false}
				chartConfig={undefined}
				onChartConfigChange={vi.fn()}
			/>
		)
	)
	const buttons = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
	await act(async () => buttons[1].click())
	expect(container.textContent).toContain('Chart content')
	await act(async () => buttons[0].click())
	expect(container.textContent).toContain('Table content')
})

test('Results keyboard focus does not activate charts and multiple panels remain independent', async () => {
	const props = {
		result: { columns: [{ name: 'value', type: 'INTEGER' }], rows: [[1]] },
		running: true,
		chartConfig: undefined,
		onChartConfigChange: vi.fn()
	}
	await act(async () =>
		root.render(
			<>
				<ResultsPanel {...props} />
				<ResultsPanel {...props} />
			</>
		)
	)
	const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
	const press = async (button: HTMLButtonElement, key: string) => {
		await act(async () => {
			button.focus()
			button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
			button.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
			await new Promise((resolve) => setTimeout(resolve, 30))
		})
	}
	await press(tabs[0], 'ArrowRight')
	expect(document.activeElement).toBe(tabs[1])
	expect(container.textContent).not.toContain('Chart content')
	expect(tabs[0].getAttribute('aria-selected')).toBe('true')
	await press(tabs[1], 'Enter')
	expect(document.activeElement).toBe(tabs[1])
	const panel = document.getElementById(tabs[1].getAttribute('aria-controls')!)!
	expect(panel.getAttribute('aria-labelledby')).toBe(tabs[1].id)
	expect(panel.textContent).toBe('Chart content')
	expect(tabs[2].getAttribute('aria-selected')).toBe('true')
	const ids = [...container.querySelectorAll('[id]')].map((e) => e.id)
	expect(new Set(ids).size).toBe(ids.length)
	expect(props.onChartConfigChange).not.toHaveBeenCalled()
})
