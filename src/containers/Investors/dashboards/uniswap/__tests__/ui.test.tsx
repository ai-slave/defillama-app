// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { chartToPeriodDataset, type Chart } from '../transform'
import { createStackTooltipFormatter, KpiGrid } from '../ui'

const NOTE = 'Distinct wallets with a trade of $100 or more.'
const DEF = 'Definition from ir-server metadata.'

describe('uniswap KPI definition tooltip', () => {
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

	test('falls back to the KPI payload note when no definition is passed', async () => {
		await act(async () =>
			root.render(
				<KpiGrid kpis={{ wallets: { value: 1, formatted: '26M', note: NOTE } }} items={[['wallets', 'Wallets']]} />
			)
		)

		expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(NOTE)
	})

	test('prefers an explicit definition over the payload note', async () => {
		await act(async () =>
			root.render(
				<KpiGrid kpis={{ wallets: { value: 1, formatted: '26M', note: NOTE } }} items={[['wallets', 'Wallets', DEF]]} />
			)
		)

		expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe(DEF)
	})
})

describe('uniswap stack tooltip', () => {
	/** Tooltip params as ECharts hands them over for one dataset row: positional row + encode. */
	function paramsAt(chart: Chart, rowIndex: number) {
		const { dataset } = chartToPeriodDataset(chart)
		const row = dataset.source[rowIndex]!
		return chart.series.map((series, index) => ({
			seriesName: series.name,
			marker: '',
			data: row,
			dimensionNames: dataset.dimensions,
			encode: { x: [0], y: [index + 1] }
		}))
	}

	function rowsOf(html: string) {
		const list = document.createElement('ul')
		list.innerHTML = html
		return [...list.querySelectorAll('li')].map((li) => li.textContent?.replace(/\u00a0+/g, ' '))
	}

	const series = (name: string, data: Array<number>) => ({ name, data })
	const dates = ['2026-09-14', '2026-09-15']

	test('keeps Others in the list, folds the tail into it and puts Total last', () => {
		const chart: Chart = {
			dates,
			series: [series('Others', [5, 1]), series('A', [40, 1]), series('B', [30, 1]), series('C', [20, 1])]
		}
		const html = createStackTooltipFormatter({ groupBy: 'daily', valueSymbol: '$', maxItems: 3, showTotal: true })(
			paramsAt(chart, 0)
		)
		expect(rowsOf(html)).toEqual(['A $40', 'B $30', 'Others $25', 'Total $95'])
	})

	test('omits Total for overlaid series', () => {
		const chart: Chart = { dates, series: [series('A', [2, 9]), series('B', [1, 9])] }
		const html = createStackTooltipFormatter({ groupBy: 'daily', valueSymbol: '$', maxItems: 20, showTotal: false })(
			paramsAt(chart, 0)
		)
		expect(rowsOf(html)).toEqual(['A $2', 'B $1'])
	})
})
