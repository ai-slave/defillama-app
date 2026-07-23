import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { IProtocolRow, UseProTableDataParams } from './proTable.types'

const mocks = vi.hoisted(() => ({
	downloadCSV: vi.fn(),
	sourcePlan: null as UseProTableDataParams['sourcePlan'] | null
}))

const rows = [
	{ name: 'Alpha', tvl: 100, fees_24h: 10, category: 'Lending', chains: ['Base'] },
	{ name: 'Beta', tvl: 50, fees_24h: 0, category: 'Dexs', chains: ['Base'] }
] as unknown as IProtocolRow[]

vi.mock('~/utils/download', () => ({ downloadCSV: mocks.downloadCSV }))
vi.mock('~/hooks/useUserConfig', () => ({ useUserConfig: () => ({ userConfig: null, saveUserConfig: null }) }))
vi.mock('./useProTableData', () => ({
	useProTableData: (params: UseProTableDataParams) => {
		mocks.sourcePlan = params.sourcePlan
		return {
			finalProtocolsList: rows,
			searchIndex: new WeakMap(rows.map((row) => [row, row.name.toLowerCase()])),
			isLoading: false,
			isEmptyProtocols: false,
			categories: ['Dexs', 'Lending'],
			availableProtocols: rows,
			parentProtocols: []
		}
	}
}))

import { useProTable } from './useProTable'

describe('Pro table CSV source planning', () => {
	it('keeps visible metric data enabled and exports unchanged sorted cell values', () => {
		let tableResult: ReturnType<typeof useProTable> | null = null
		function Probe() {
			tableResult = useProTable(['Base'], undefined, undefined, {
				initialColumnOrder: ['name', 'fees_24h'],
				initialColumnVisibility: { name: true, fees_24h: true }
			})
			return null
		}

		renderToStaticMarkup(<Probe />)
		if (!tableResult) throw new Error('Expected the table hook to render')
		tableResult.downloadCSV()

		expect(mocks.sourcePlan?.sources).toEqual(['protocols', 'fees'])
		expect(mocks.downloadCSV).toHaveBeenCalledWith(
			'Base_protocols.csv',
			[
				['Name', 'Fees 24h'],
				['Alpha', '10'],
				['Beta', '0']
			],
			{ addTimestamp: true }
		)
	})

	it('keeps custom-column inputs available to sorting and CSV evaluation', () => {
		let tableResult: ReturnType<typeof useProTable> | null = null
		function Probe() {
			tableResult = useProTable(['Base'], undefined, undefined, {
				initialColumnOrder: ['name', 'custom-double-fees'],
				initialColumnVisibility: { name: true, 'custom-double-fees': true },
				initialCustomColumns: [
					{
						id: 'custom-double-fees',
						name: 'Double Fees',
						expression: 'fees_24h * 2',
						isValid: true
					}
				]
			})
			return null
		}

		renderToStaticMarkup(<Probe />)
		if (!tableResult) throw new Error('Expected the table hook to render')
		tableResult.downloadCSV()

		expect(mocks.sourcePlan?.sources).toEqual(['protocols', 'fees'])
		expect(mocks.downloadCSV).toHaveBeenLastCalledWith(
			'Base_protocols.csv',
			[
				['Name', 'Double Fees'],
				['Alpha', '20'],
				['Beta', '0']
			],
			{ addTimestamp: true }
		)
	})
})
