import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '../constants'
import type { IChainsByAdapterPageData } from '../types'

const mocks = vi.hoisted(() => ({
	chartProps: [] as Array<Record<string, unknown>>,
	tableData: [] as Array<Array<Record<string, unknown>>>
}))

vi.mock('~/components/CsvDownloadButton', () => ({
	CSVDownloadButton: () => null
}))

vi.mock('~/components/Table/VirtualTable', () => ({
	VirtualTable: ({ table: instance }: { table: { options: { data: Array<Record<string, unknown>> } } }) => {
		mocks.tableData.push(instance.options.data)
		return null
	}
}))

vi.mock('../ChainChart', () => ({
	ChainsByAdapterChart: (props: Record<string, unknown>) => {
		mocks.chartProps.push(props)
		return null
	}
}))

import { ChainsByAdapter } from '../ChainsByAdapter'

type PageType = Parameters<typeof ChainsByAdapter>[0]['type']

const baseChain = {
	name: 'Base',
	logo: '/icons/base.png',
	total24h: 100,
	total7d: 700,
	total30d: 3000
}

function renderRows({
	type,
	adapterType,
	dataType,
	chains = [baseChain]
}: {
	type: PageType
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}`
	chains?: IChainsByAdapterPageData['chains']
}) {
	const tableRenderIndex = mocks.tableData.length

	renderToStaticMarkup(
		<ChainsByAdapter
			type={type}
			adapterType={adapterType}
			dataType={dataType}
			chartData={{ dimensions: ['timestamp'], source: [] }}
			chains={chains}
			allChains={chains.map((chain) => chain.name)}
		/>
	)

	expect(mocks.tableData).toHaveLength(tableRenderIndex + 1)
	return mocks.tableData[tableRenderIndex]
}

describe('ChainsByAdapter', () => {
	beforeEach(() => {
		mocks.chartProps = []
		mocks.tableData = []
	})

	test('uses the fetched chain totals directly', () => {
		const rows = renderRows({
			type: 'App Fees',
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_APP_FEES
		})

		expect(rows[0]).toMatchObject(baseChain)
	})

	test('shows chart panels on app fee and holders revenue chain ranking pages', () => {
		renderRows({
			type: 'App Fees',
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_APP_FEES
		})
		renderRows({
			type: 'Holders Revenue',
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_HOLDERS_REVENUE
		})

		expect(mocks.chartProps.map((props) => props.chartName)).toEqual(['App Fees', 'Holders Revenue'])
	})

	test('hides chart panels on chain-native fee and revenue ranking pages', () => {
		renderRows({
			type: 'Fees',
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_FEES
		})
		renderRows({
			type: 'Revenue',
			adapterType: ADAPTER_TYPES.FEES,
			dataType: ADAPTER_DATA_TYPES.DAILY_REVENUE
		})

		expect(mocks.chartProps).toEqual([])
	})

	test('keeps chart panels visible for non-fee chain ranking pages', () => {
		renderRows({
			type: 'DEX Volume',
			adapterType: ADAPTER_TYPES.DEXS,
			dataType: ADAPTER_DATA_TYPES.DAILY_VOLUME
		})

		expect(mocks.chartProps.map((props) => props.chartName)).toEqual(['DEX Volume'])
	})
})
