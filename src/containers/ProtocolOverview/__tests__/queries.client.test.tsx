// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import {
	useFetchProtocolActivityChart,
	useFetchProtocolChartsByKeys,
	useFetchProtocolMedianAPY,
	useFetchProtocolTVLChart
} from '../queries.client'

const http = installFixtureFetch()
const CHARTS = '/api/public/protocols/charts'

let client: QueryClient
let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	client = new QueryClient()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	http.serve({ [CHARTS]: [] })
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	client.clear()
})

async function render(Probe: () => null) {
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<Probe />
			</QueryClientProvider>
		)
	)
}

// Relative chart URLs resolve against the fixture base, so compare path and query only.
const requested = () => http.requests.map(({ url }) => `${url.pathname}${url.search}`)

test('adds own-token exclusions to every TVL batch request', async () => {
	await render(() => {
		useFetchProtocolChartsByKeys({ protocol: 'gate', keys: [], source: 'tvl', tokensToExclude: ['GT'] })
		return null
	})
	await waitForUi(() =>
		expect(requested().toSorted()).toEqual([
			`${CHARTS}?kind=tvl&protocol=gate&breakdownType=chain-breakdown&tokensToExclude=GT`,
			`${CHARTS}?kind=tvl&protocol=gate&breakdownType=token-breakdown&tokensToExclude=GT`,
			`${CHARTS}?kind=tvl&protocol=gate&currency=token&breakdownType=token-breakdown&tokensToExclude=GT`,
			`${CHARTS}?kind=tvl&protocol=gate&tokensToExclude=GT`
		])
	)
})

test('shares one cached request between duplicate or reordered exclusion lists', async () => {
	let data: unknown
	await render(() => {
		data = useFetchProtocolTVLChart({ protocol: 'gate', tokensToExclude: ['MNT', 'GT', 'MNT'] }).data
		useFetchProtocolTVLChart({ protocol: 'gate', tokensToExclude: ['GT', 'MNT'] })
		return null
	})
	await waitForUi(() => expect(data).toEqual([]))
	expect(requested()).toEqual([`${CHARTS}?kind=tvl&protocol=gate&tokensToExclude=GT%2CMNT`])
})

test('requests value, chain and token breakdowns for the base chart and every TVL key', async () => {
	await render(() => {
		useFetchProtocolChartsByKeys({ protocol: 'aave', keys: ['pool2', 'staking'], source: 'tvl' })
		return null
	})
	await waitForUi(() => expect(requested()).toHaveLength(12))
	expect(requested().toSorted()).toEqual(
		['', '&key=pool2', '&key=staking']
			.flatMap((key) => [
				`${CHARTS}?kind=tvl&protocol=aave${key}`,
				`${CHARTS}?kind=tvl&protocol=aave${key}&breakdownType=chain-breakdown`,
				`${CHARTS}?kind=tvl&protocol=aave${key}&breakdownType=token-breakdown`,
				`${CHARTS}?kind=tvl&protocol=aave${key}&currency=token&breakdownType=token-breakdown`
			])
			.toSorted()
	)
})

test('keeps treasury batch requests on the treasury source', async () => {
	await render(() => {
		useFetchProtocolChartsByKeys({
			protocol: 'makerdao',
			keys: ['OwnTokens'],
			includeBase: false,
			source: 'treasury',
			inflows: false
		})
		return null
	})
	await waitForUi(() =>
		expect(requested().toSorted()).toEqual([
			`${CHARTS}?kind=treasury&protocol=makerdao&key=OwnTokens`,
			`${CHARTS}?kind=treasury&protocol=makerdao&key=OwnTokens&breakdownType=chain-breakdown`
		])
	)
})

test('does not request a chart without a protocol', async () => {
	let statuses: Array<string> = []
	await render(() => {
		statuses = [
			useFetchProtocolTVLChart({ protocol: null }).fetchStatus,
			useFetchProtocolTVLChart({ protocol: '' }).fetchStatus
		]
		return null
	})
	expect(statuses).toEqual(['idle', 'idle'])
	expect(requested()).toEqual([])
})

test('returns activity rows in milliseconds and keeps sub-dollar gas costs', async () => {
	http.serve({ [CHARTS]: [[1_700_000_000, 0.01]] })
	let data: unknown
	await render(() => {
		data = useFetchProtocolActivityChart({
			queryKey: 'gas-used-usd',
			protocol: 'pangolin-v2',
			adapterType: 'active-users',
			dataType: 'dailyGasUsedUsd'
		}).data
		return null
	})
	await waitForUi(() => expect(data).toEqual([[1_700_000_000_000, 0.01]]))
	expect(requested()).toEqual([
		`${CHARTS}?kind=adapter&adapterType=active-users&protocol=pangolin-v2&dataType=dailyGasUsedUsd`
	])
})

test('keeps successful empty activity and median responses distinct from failures', async () => {
	const results: Record<string, { data: unknown; isError: boolean }> = {}
	await render(() => {
		const activity = useFetchProtocolActivityChart({
			queryKey: 'active-users',
			protocol: 'curve-dex',
			adapterType: 'active-users'
		})
		const median = useFetchProtocolMedianAPY('curve-dex')
		results.activity = { data: activity.data, isError: activity.isError }
		results.median = { data: median.data, isError: median.isError }
		return null
	})
	await waitForUi(() =>
		expect(results).toEqual({ activity: { data: [], isError: false }, median: { data: [], isError: false } })
	)

	client.clear()
	http.serve({ [CHARTS]: fixtureStatus(400) })
	await act(async () => root.unmount())
	root = createRoot(container)
	await render(() => {
		const activity = useFetchProtocolActivityChart({
			queryKey: 'active-users',
			protocol: 'curve-dex',
			adapterType: 'active-users'
		})
		const median = useFetchProtocolMedianAPY('curve-dex')
		results.activity = { data: activity.data, isError: activity.isError }
		results.median = { data: median.data, isError: median.isError }
		return null
	})
	await waitForUi(() =>
		expect(results).toEqual({
			activity: { data: undefined, isError: true },
			median: { data: undefined, isError: true }
		})
	)
})
