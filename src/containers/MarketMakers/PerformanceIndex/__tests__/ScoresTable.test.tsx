// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { ScoresTable } from '../ScoresTable'
import type { PerformanceRow } from '../types'

const base = { marketMakerImageUrl: null, activeEngagementsCount: null, medianEngagementsFdv: null }
const rows: Array<PerformanceRow> = [
	{
		...base,
		marketMakerId: 'gsr',
		marketMakerName: 'GSR',
		composite: 1,
		tradingKpis: 1,
		trustIntegration: 1,
		coverageCapabilities: 1,
		uptime: 1,
		integrationLevel: 1,
		integrationStatus: 'none'
	},
	{
		...base,
		marketMakerId: 'lhava',
		marketMakerName: 'Lhava',
		composite: 10,
		tradingKpis: 9.5,
		trustIntegration: 8,
		coverageCapabilities: 7.25,
		uptime: 6,
		integrationLevel: 3,
		integrationStatus: 'full'
	},
	{
		...base,
		marketMakerId: 'wintermute',
		marketMakerName: 'Wintermute',
		composite: 5.25,
		tradingKpis: null,
		trustIntegration: 4,
		coverageCapabilities: 3,
		uptime: 2,
		integrationLevel: 2,
		integrationStatus: 'partial'
	}
]

function cellTexts(container: HTMLElement) {
	return [...container.querySelectorAll('tbody tr')].map((row) =>
		[...row.querySelectorAll('td')].map((cell) => cell.textContent!.trim())
	)
}

test('ranks market makers by composite with grade, scores and integration status, and lets the reader flip the order', async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	const onSelectMM = vi.fn()
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<ScoresTable rows={rows} onSelectMM={onSelectMM} />))
		const headers = [...container.querySelectorAll('thead th')].map((th) =>
			th.textContent!.replace(/[?i]?[↑↓]?$/, '').trim()
		)
		expect(headers.slice(0, 8)).toEqual([
			'#',
			'Market Maker',
			'Grade',
			'Composite Score',
			'Trading KPIs',
			'Trust',
			'Coverage & Capabilities',
			'Uptime'
		])
		expect(cellTexts(container)).toEqual([
			['1', 'Lhava', 'AAA', '10.00', '9.50', '8.00', '7.25', '6.00', 'FullDetails'],
			['2', 'Wintermute', 'B', '5.25', 'N/A', '4.00', '3.00', '2.00', 'PartialDetails'],
			['3', 'GSR', 'CCC', '<5.00', '1.00', '1.00', '1.00', '1.00', 'NoneDetails']
		])

		await act(async () => container.querySelector<HTMLButtonElement>('thead th button')!.click())
		expect(cellTexts(container).map((row) => row[1])).toEqual(['GSR', 'Wintermute', 'Lhava'])

		await act(async () => container.querySelector<HTMLButtonElement>('tbody tr td:nth-child(2) button')!.click())
		expect(onSelectMM).toHaveBeenCalledWith('gsr', 'GSR')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
