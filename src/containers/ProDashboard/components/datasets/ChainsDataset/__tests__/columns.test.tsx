// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import { getProChainsDatasetQueryKey } from '~/containers/ProDashboard/tableQueryKeys'
import { ChainsDataset } from '../index'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))

const ETHEREUM = {
	name: 'Ethereum',
	icon: '',
	protocols: 1,
	deprecated: false,
	users: null,
	change_1d: null,
	change_7d: null,
	change_1m: null,
	tvl: 1,
	stablesMcap: null,
	totalVolume24h: null,
	totalVolume7d: null,
	totalVolume30d: null,
	totalFees24h: null,
	totalFees7d: null,
	totalFees30d: null,
	totalRevenue24h: null,
	totalRevenue7d: null,
	totalRevenue30d: null,
	totalAppRevenue24h: null,
	totalAppRevenue7d: null,
	totalAppRevenue30d: null,
	bridgedTvl: null,
	mcaptvl: null,
	mcap: null,
	symbol: null,
	extraTvl: null
} satisfies ChainsDatasetRow

const ESSENTIAL_HEADERS = ['Chain', 'Protocols', 'Active Addresses', '1d Change', '7d Change', 'DeFi TVL', 'Stables']

let client: QueryClient
let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	// The rows come from the query cache the dashboard stream fills.
	client = new QueryClient()
	client.setQueryData(getProChainsDatasetQueryKey(undefined), [ETHEREUM])
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

const render = (props: ComponentProps<typeof ChainsDataset>) =>
	act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<ChainsDataset {...props} />
			</QueryClientProvider>
		)
	)
const headers = () => Array.from(container.querySelectorAll('th'), (th) => th.textContent?.trim())
const click = (text: string) =>
	act(async () =>
		Array.from(container.querySelectorAll('button'))
			.find((button) => button.textContent?.trim() === text)!
			.click()
	)

test('saved columns redraw the table through undo and redo, and undoing them all returns to the essential preset', async () => {
	await render({})
	const unsaved = headers()
	await render({ columnOrder: ['tvl', 'name'], columnVisibility: { name: true, tvl: true, protocols: false } })
	const saved = headers()
	await render({})

	expect(unsaved).toEqual(ESSENTIAL_HEADERS)
	expect(saved.slice(0, 2)).toEqual(['DeFi TVL', 'Chain'])
	expect(headers()).toEqual(ESSENTIAL_HEADERS)
})

test('an editable card saves a preset and draws the columns the dashboard keeps', async () => {
	const onColumnsChange = vi.fn()
	await render({ onColumnsChange })
	await click('Market Share')

	expect(onColumnsChange.mock.calls[0]?.[0]).toEqual([
		'name',
		'tvl_share',
		'stablesMcap_share',
		'totalVolume24h_share',
		'totalFees24h_share',
		'totalAppRevenue24h_share'
	])
	expect(headers()).toEqual(ESSENTIAL_HEADERS)
})

test('a read-only card shows a column the viewer adds over its saved columns', async () => {
	const onColumnsChange = vi.fn()
	await render({ onColumnsChange })
	await click('Market Share')
	const [columnOrder, columnVisibility] = onColumnsChange.mock.calls[0]!
	await render({ columnOrder, columnVisibility })
	await click('Customize Table')
	await click('Market Cap')

	expect(headers()).toEqual([
		'Chain',
		'DeFi TVL % Share',
		'Stables % Share',
		'24h Volume % Share',
		'24h Fees % Share',
		'24h Revenue % Share',
		'Market Cap'
	])
})

test('Hide All leaves only the chain name and Show All then draws every column', async () => {
	await render({})
	await click('Customize Table')
	await click('Hide All')
	const hidden = headers()
	await click('Show All')

	expect(hidden).toEqual(['Chain'])
	expect(headers()).toHaveLength(23)
})

test('removing a saved column that has no visibility entry hides it', async () => {
	await render({ columnOrder: ['name', 'tvl'], columnVisibility: { name: true } })
	await click('Customize Table')
	await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Hide DeFi TVL"]')!.click())

	expect(headers()).not.toContain('DeFi TVL')
})
