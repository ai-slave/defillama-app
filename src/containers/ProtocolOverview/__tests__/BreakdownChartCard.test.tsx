// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { BreakdownChartCard } from '../BreakdownCards'

vi.mock('next/router', () => ({ useRouter: () => ({ query: {}, pathname: '/protocol/tvl/aave', push: vi.fn() }) }))
// ECharts cannot draw in happy-dom, and nothing here reads the line chart.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const { Wrapper } = installSubscriberSession('subscriber', { resolved: true })
const downloads = installDownloadSink()
let container: HTMLDivElement
let root: Root

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function csvButton() {
	return [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
		button.textContent?.includes('.csv')
	)!
}

test('exports the table rows when the table view is opened and exported before the chart catches up', async () => {
	await act(async () =>
		root.render(
			<Wrapper>
				<BreakdownChartCard
					title="TVL by Chain"
					seriesLabel="Chain"
					allValues={['Ethereum', 'Arbitrum']}
					breakdown={[[1_704_067_200, { Ethereum: 60, Arbitrum: 40 }]]}
					aggregateOthers
					valueSymbol="$"
					snapshot={{
						peers: [
							{ name: 'Ethereum', value: 60 },
							{ name: 'Arbitrum', value: 40 }
						],
						limit: 10,
						upstreamOthersValue: 0
					}}
					exportFilenameBase="aave-tvl-by-chain"
					exportTitle="Aave TVL by Chain"
					exportIconUrl={undefined}
				/>
			</Wrapper>
		)
	)

	// A user can export between the table's commit and the deferred chart render, which `act` would flush
	// together, so the view switch and the export click run outside it, as `waitForUi` polls do.
	globalThis.IS_REACT_ACT_ENVIRONMENT = false
	container.querySelector<HTMLInputElement>('input[type="radio"][value="table"]')!.click()
	await Promise.resolve()
	expect(container.querySelector('table')).not.toBeNull()
	csvButton().click()

	await waitForUi(() => expect(downloads).toHaveLength(1))
	expect(await downloads[0]!.blob.text()).toBe('Chain,Value,% of TVL\nEthereum,60,60\nArbitrum,40,40')
})
