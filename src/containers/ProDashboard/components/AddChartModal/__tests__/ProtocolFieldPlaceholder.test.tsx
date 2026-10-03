// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { AppMetadataProvider } from '../../../AppMetadataContext'
import { AdvancedTvlChartTab } from '../AdvancedTvlChartTab'
import { BorrowedChartTab } from '../BorrowedChartTab'
import { IncomeStatementChartTab } from '../IncomeStatementChartTab'

const http = installFixtureFetch()

let root: Root
let host: HTMLDivElement
let client: QueryClient
beforeEach(() => {
	host = document.createElement('div')
	document.body.append(host)
	root = createRoot(host)
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	http.serve(appMetadataFixtures())
})
afterEach(async () => {
	await act(async () => root.unmount())
	host.remove()
	client.clear()
})

const noop = () => {}
const protocolOptions = [{ value: 'aave', label: 'Aave' }]

test.each<[string, ReactNode]>([
	[
		'Advanced TVL',
		<AdvancedTvlChartTab
			key="advanced"
			selectedAdvancedTvlProtocol={null}
			selectedAdvancedTvlProtocolName={null}
			selectedAdvancedTvlChartType="tvl"
			onSelectedAdvancedTvlProtocolChange={noop}
			onSelectedAdvancedTvlProtocolNameChange={noop}
			onSelectedAdvancedTvlChartTypeChange={noop}
			protocolOptions={protocolOptions}
			protocolsLoading={false}
		/>
	],
	[
		'Borrowed',
		<BorrowedChartTab
			key="borrowed"
			selectedBorrowedProtocol={null}
			selectedBorrowedProtocolName={null}
			selectedBorrowedChartType="chainsBorrowed"
			onSelectedBorrowedProtocolChange={noop}
			onSelectedBorrowedProtocolNameChange={noop}
			onSelectedBorrowedChartTypeChange={noop}
			protocolOptions={protocolOptions}
			protocolsLoading={false}
		/>
	],
	[
		'Income Statement',
		<IncomeStatementChartTab
			key="income"
			selectedIncomeStatementProtocol={null}
			selectedIncomeStatementProtocolName={null}
			onSelectedIncomeStatementProtocolChange={noop}
			onSelectedIncomeStatementProtocolNameChange={noop}
			protocolOptions={protocolOptions}
			protocolsLoading={false}
		/>
	]
])('the %s protocol field shows its placeholder until a protocol is picked', async (_, tab) => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<AppMetadataProvider>
					<DashboardTestProvider>{tab}</DashboardTestProvider>
				</AppMetadataProvider>
			</QueryClientProvider>
		)
	)
	const protocolField = [...document.querySelectorAll('button[role="combobox"]')][0]!
	expect(protocolField.textContent).toBe('Select protocol…')
})
