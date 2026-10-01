// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChartConfig } from '../chartConfig'
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
	const ids = [...container.querySelectorAll('[role="tab"], [role="tabpanel"]')].map((e) => e.id)
	expect(new Set(ids).size).toBe(ids.length)
	await press(tabs[1], 'ArrowLeft')
	await press(tabs[0], 'Enter')
	expect(container.textContent).not.toContain('Chart content')
	expect(document.getElementById(tabs[0].getAttribute('aria-controls')!)!.textContent).toBe('Table content')
})

test('picking the chart view stores its default configuration for share links, and keeps one already stored', async () => {
	const result: QueryResult = {
		columns: [
			{ name: 'chain', type: 'VARCHAR' },
			{ name: 'tvl', type: 'DOUBLE' }
		],
		rows: [['Ethereum', 100]]
	}
	let stored: ChartConfig | undefined
	function Tab({ initial }: { initial: ChartConfig | undefined }) {
		const [config, setConfig] = useState(initial)
		stored = config
		return (
			<ResultsPanel
				result={result}
				running={false}
				chartConfig={config}
				onChartConfigChange={(next) => setConfig(next ?? undefined)}
			/>
		)
	}
	const pickChart = () =>
		act(async () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].at(-1)!.click())

	await act(async () => root.render(<Tab initial={undefined} />))
	expect(stored).toBeUndefined()
	await pickChart()
	expect(stored).toEqual({
		chartType: 'bar',
		xCol: 'chain',
		yCols: ['tvl'],
		splitByCol: null,
		stackMode: 'off',
		rightAxisCols: [],
		seriesKinds: {},
		seriesColors: {},
		numberFormat: 'auto',
		candlestick: undefined,
		bubble: undefined,
		histogram: undefined
	})

	await act(async () => root.unmount())
	root = createRoot(container)
	const edited = { ...stored!, numberFormat: 'currency' as const }
	await act(async () => root.render(<Tab initial={edited} />))
	await pickChart()
	expect(stored).toBe(edited)
})
