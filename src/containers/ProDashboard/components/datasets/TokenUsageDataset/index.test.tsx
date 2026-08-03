// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'

const mocks = vi.hoisted(() => ({
	data: [] as ProtocolTokenUsageData[],
	downloadCSV: vi.fn(),
	refetch: vi.fn()
}))

vi.mock('./useTokenUsageData', () => ({
	useTokenUsageData: () => ({ data: mocks.data, isLoading: false, isError: false, refetch: mocks.refetch })
}))
vi.mock('./useTokenSearch', () => ({ useTokenSearch: () => ({ data: [], isLoading: false }) }))
vi.mock('./columns', () => ({
	getColumns: () => [
		{ header: 'Protocol', accessorKey: 'name' },
		{ header: 'Category', accessorKey: 'category' },
		{ header: 'Amount', accessorKey: 'amountUsd' }
	]
}))
vi.mock('~/utils/download', () => ({ downloadCSV: mocks.downloadCSV }))
vi.mock('../../CSVExportButton', () => ({
	CSVExportButton: ({ onClick }: { onClick: () => void }) => (
		<button type="button" data-testid="csv" onClick={onClick}>
			CSV
		</button>
	)
}))
vi.mock('../../Table/TablePagination', () => ({ TablePagination: () => null }))
vi.mock('../../LoadingSpinner', () => ({ LoadingSpinner: () => null }))
vi.mock('~/components/MultiSelect/ReactSelect', () => ({ ReactSelect: () => null }))

import { TokenUsageDataset } from './index'

describe('TokenUsageDataset CSV export', () => {
	let container: HTMLDivElement
	let root: Root

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		mocks.downloadCSV.mockReset()
		mocks.refetch.mockReset()
		mocks.data = [
			{ name: 'Excluded', category: 'Other', amountUsd: 1_000, tokens: { usdc: 1_000 } },
			...Array.from({ length: 12 }, (_, index) => {
				const amountUsd = index + 1
				return {
					name: `Keep, ${amountUsd}`,
					category: 'Category "Quoted"',
					amountUsd,
					tokens: { usdc: amountUsd }
				}
			})
		]
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	it('exports every filtered row in sorted order before pagination', async () => {
		await act(async () =>
			root.render(
				<TokenUsageDataset
					editable={false}
					config={{
						id: 'token-usage',
						kind: 'dataset-table',
						datasetType: 'token-usage',
						tokenSymbols: ['usdc'],
						includeCex: false
					}}
				/>
			)
		)

		const search = container.querySelector<HTMLInputElement>('input[placeholder="Search protocols..."]')
		if (!search) throw new Error('Expected protocol search input')
		search.value = 'Keep'
		await act(async () => search.dispatchEvent(new InputEvent('input', { bubbles: true })))

		expect(container.querySelectorAll('tbody tr')).toHaveLength(10)
		const csvButton = container.querySelector<HTMLButtonElement>('button[data-testid="csv"]')
		if (!csvButton) throw new Error('Expected CSV button')
		await act(async () => csvButton.click())

		const expected: Array<Array<string | number>> = [['Protocol', 'Category', 'Total Amount (USD)']]
		for (let amountUsd = 12; amountUsd >= 1; amountUsd -= 1) {
			expected.push([`Keep, ${amountUsd}`, 'Category "Quoted"', amountUsd])
		}
		expect(mocks.downloadCSV).toHaveBeenCalledWith('token-usage-USDC.csv', expected)
	})
})
