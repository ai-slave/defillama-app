// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChartConfig } from '../chartConfig'
import type { QueryResult } from '../exportResults'
import { ResultsChart } from '../ResultsChart'

vi.mock('@tanstack/react-virtual', async (original) =>
	(await import('~/utils/testing/virtualLayout')).withVirtualLayout(await original())
)

// The toolbar shows the chart configuration; drawing the chart is not under test.
vi.mock('../chart', () => ({ ChartRouter: () => null }))
vi.mock('../chart/ChartExportButton', () => ({ ChartExportButton: () => null }))

const result: QueryResult = {
	columns: [
		{ name: 'chain', type: 'VARCHAR' },
		{ name: 'tvl', type: 'DOUBLE' }
	],
	rows: [['Ethereum', 100]]
}

let container: HTMLDivElement
let root: Root
let stored: ChartConfig | undefined

/** Holds the chart configuration the way a workspace tab does. */
function Tab({ shown }: { shown: QueryResult }) {
	const [config, setConfig] = useState<ChartConfig | undefined>(undefined)
	stored = config
	return (
		<ResultsChart result={shown} chartConfig={config} onChartConfigChange={(next) => setConfig(next ?? undefined)} />
	)
}

const render = (next: QueryResult) => act(async () => root.render(<Tab shown={next} />))
// The x picker chip reads "x: <column>".
const xColumn = () =>
	[...container.querySelectorAll('[role="combobox"]')]
		.find((el) => el.textContent?.startsWith('x: '))
		?.textContent?.slice('x: '.length)
const numberFormat = () =>
	container.querySelector<HTMLInputElement>('[aria-label="Number format"] input:checked')?.parentElement?.textContent
const pickNumberFormat = (label: string) =>
	act(async () =>
		[...container.querySelectorAll<HTMLLabelElement>('[aria-label="Number format"] label')]
			.find((option) => option.textContent === label)!
			.querySelector('input')!
			.click()
	)

beforeEach(() => {
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('a result without a stored configuration charts its default columns and stores nothing until an edit', async () => {
	await render(result)

	expect(xColumn()).toBe('chain')
	expect(container.textContent).toContain('tvl')
	expect(numberFormat()).toBe('auto')
	expect(stored).toBeUndefined()
})

test('an edit is stored and survives new rows and new columns', async () => {
	await render(result)
	await pickNumberFormat('$')
	expect(numberFormat()).toBe('$')
	expect(stored?.numberFormat).toBe('currency')

	await render({ ...result, rows: [['Ethereum', 200]] })
	expect(numberFormat()).toBe('$')

	await render({ columns: [...result.columns, { name: 'fees', type: 'DOUBLE' }], rows: [['Ethereum', 100, 5]] })
	expect(numberFormat()).toBe('$')
	expect(xColumn()).toBe('chain')
})
