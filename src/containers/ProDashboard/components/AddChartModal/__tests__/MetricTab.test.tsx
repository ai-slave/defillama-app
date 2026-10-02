// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { appMetadataFixtures } from '~/utils/testing/appMetadata'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { AppMetadataProvider } from '../../../AppMetadataContext'
import { MetricTab } from '../MetricTab'

const http = installFixtureFetch()
let root: Root
let container: HTMLDivElement
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function renderTab(onLabelChange = vi.fn()) {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	http.serve(appMetadataFixtures())
	await act(async () =>
		root.render(
			<QueryClientProvider client={new QueryClient()}>
				<AppMetadataProvider>
					<DashboardTestProvider>
						<MetricTab
							metricSubjectType="chain"
							metricChain={null}
							metricProtocol={null}
							metricType="tvl"
							metricAggregator="latest"
							metricWindow="7d"
							metricLabel=""
							metricChartType="sparkline"
							onSubjectTypeChange={vi.fn()}
							onChainChange={vi.fn()}
							onProtocolChange={vi.fn()}
							onTypeChange={vi.fn()}
							onAggregatorChange={vi.fn()}
							onWindowChange={vi.fn()}
							onLabelChange={onLabelChange}
							onChartTypeChange={vi.fn()}
						/>
					</DashboardTestProvider>
				</AppMetadataProvider>
			</QueryClientProvider>
		)
	)
}
test('the card name field is found by its visible label and edits the tile title', async () => {
	const onLabelChange = vi.fn()
	await renderTab(onLabelChange)
	const label = [...document.querySelectorAll('label')].find((node) => node.textContent === 'Card name (optional)')!
	const input = document.getElementById(label.htmlFor) as HTMLInputElement
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Ethereum TVL')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(onLabelChange.mock.calls).toEqual([['Ethereum TVL']])
})
