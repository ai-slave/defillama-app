// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { MultiChartConfig } from '../../types'
import MultiChartCard from '../MultiChartCard'

const mocks = vi.hoisted(() => ({ handleCumulativeChange: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/example' }) }))
// The chart canvas is a heavy child; these tests assert only the card around it.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

const downloads = installDownloadSink()
const http = installSubscriberSession('u1', { resolved: true })
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

function render(multi: MultiChartConfig) {
	return act(async () =>
		root.render(
			<http.Wrapper>
				<DashboardTestProvider
					time={{ timePeriod: 'all' }}
					permissions={{ hideDuplicateButton: true }}
					editorActions={{ handleCumulativeChange: mocks.handleCumulativeChange }}
				>
					<MultiChartCard multi={multi} />
				</DashboardTestProvider>
			</http.Wrapper>
		)
	)
}

test('waits for every series, blocks failed partial exports, then exports both series after a retry', async () => {
	let solana = Promise.withResolvers<Response>()
	http.serve({
		'/lite/charts/Ethereum': { tvl: [[1_704_067_200, 12]] },
		'/lite/charts/Solana': () => solana.promise
	})
	const multi: MultiChartConfig = {
		id: 'comparison',
		kind: 'multi',
		name: 'Comparison',
		items: [
			{ id: 'a', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'tvl' },
			{ id: 'b', kind: 'chart', subjectType: 'chain', chain: 'Solana', type: 'tvl' }
		]
	}
	const exportButton = () => {
		const button = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
			(element) => element.textContent?.trim() === 'Download CSV'
		)
		if (!button) throw new Error('Missing CSV button')
		return button
	}
	await render(multi)
	const menu = await waitForUi(() => {
		const button = container.querySelector<HTMLButtonElement>('[aria-label="More actions"]')
		if (!button) throw new Error('Missing card menu')
		return button
	})
	await act(async () => menu.click())
	expect(exportButton().getAttribute('aria-disabled')).toBe('true')
	await act(async () => exportButton().click())
	expect(downloads).toHaveLength(0)

	await act(async () => solana.resolve(Response.json({ error: 'down' }, { status: 500 })))
	await waitForUi(() => expect(container.textContent).toContain('1 series is unavailable.'))
	expect(exportButton().getAttribute('aria-disabled')).toBe('true')

	solana = Promise.withResolvers<Response>()
	solana.resolve(Response.json({ tvl: [[1_704_067_200, 7]] }))
	const retry = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Try again')!
	await act(async () => retry.click())
	await waitForUi(() => expect(exportButton().getAttribute('aria-disabled')).not.toBe('true'))
	await act(async () => exportButton().click())
	expect(downloads).toHaveLength(1)
	expect(await downloads[0]!.blob.text()).toBe('Date,Ethereum TVL,Solana TVL\n2024-01-01,12,7')
})

test('a cumulative chart explains why active addresses are missing and offers individual values', async () => {
	http.serve({ '/v2/chart/active-users/protocol/ethereum': [[1_789_516_800, 40]] })
	await render({
		id: 'activity',
		kind: 'multi',
		name: 'Activity',
		showCumulative: true,
		items: [
			{ id: 'a', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'activeUsers' },
			{ id: 'b', kind: 'chart', subjectType: 'chain', chain: 'Ethereum', type: 'txs' }
		]
	})

	await waitForUi(() => expect(container.textContent).toContain("Cumulative isn't available for Active Addresses."))
	const action = [...container.querySelectorAll('button')].find(
		(button) => button.textContent === 'Show individual values'
	)!
	await act(async () => action.click())
	expect(mocks.handleCumulativeChange).toHaveBeenCalledWith('activity', false)
})
