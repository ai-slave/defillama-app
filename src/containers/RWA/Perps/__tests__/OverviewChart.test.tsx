import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider } from '~/auth'
import { CHART_COLORS } from '~/constants/colors'
import {
	buildRWAPerpsOverviewChartSeries,
	getRWAPerpsOverviewChartType,
	getRWAPerpsOverviewChartTypeQueryPatch,
	getRWAPerpsOverviewTimeSeriesMode,
	getRWAPerpsOverviewTimeSeriesModeQueryPatch,
	getRWAPerpsChartDatasetForSelectedStacks,
	resolveRWAPerpsStackSelection,
	RWAPerpsOverviewChart
} from '../OverviewChart'

const router = vi.hoisted(() => ({ query: {} as Record<string, string | Array<string>> }))
vi.mock('next/router', () => ({
	useRouter: () => ({ query: router.query, pathname: '/rwa/perps/venues', asPath: '/rwa/perps/venues', push() {} })
}))

beforeEach(() => {
	router.query = {}
})

/** Server-renders the venues stacks chart with a fetched volume breakdown already in the cache. */
function renderVolumeStacks() {
	const client = new QueryClient()
	client.setQueryData(['rwa-perps-overview-breakdown', 'venue', 'volume24h', false], {
		source: [
			{ timestamp: 1_774_483_200_000, xyz: 10, flx: 5 },
			{ timestamp: 1_774_569_600_000, xyz: 12, flx: 6 }
		],
		dimensions: ['timestamp', 'xyz', 'flx']
	})
	const html = renderToStaticMarkup(
		<QueryClientProvider client={client}>
			<AuthProvider>
				<RWAPerpsOverviewChart
					breakdown="venue"
					initialChartDataset={null}
					includeCex={false}
					cexOnlyStacks={['binance']}
					stackLabel="Venue"
				/>
			</AuthProvider>
		</QueryClientProvider>
	)
	client.clear()
	return html
}

describe('OverviewChart helpers', () => {
	test('falls back to the default chart type for invalid query values', () => {
		expect(getRWAPerpsOverviewChartType(undefined)).toBe('openInterest')
		expect(getRWAPerpsOverviewChartType('invalid')).toBe('openInterest')
		expect(getRWAPerpsOverviewChartType('markets')).toBe('markets')
	})

	test('builds the expected chart-type query patch', () => {
		expect(getRWAPerpsOverviewChartTypeQueryPatch('openInterest')).toEqual({ chartType: undefined })
		expect(getRWAPerpsOverviewChartTypeQueryPatch('volume24h')).toEqual({ chartType: 'volume24h' })
	})

	test('falls back to total mode for invalid time-series mode values', () => {
		expect(getRWAPerpsOverviewTimeSeriesMode(undefined)).toBe('grouped')
		expect(getRWAPerpsOverviewTimeSeriesMode('invalid')).toBe('grouped')
		expect(getRWAPerpsOverviewTimeSeriesMode('breakdown')).toBe('breakdown')
	})

	test('builds the expected time-series-mode query patch', () => {
		expect(getRWAPerpsOverviewTimeSeriesModeQueryPatch('grouped')).toEqual({ timeSeriesMode: undefined })
		expect(getRWAPerpsOverviewTimeSeriesModeQueryPatch('breakdown')).toEqual({ timeSeriesMode: 'breakdown' })
	})

	test('projects selected stack datasets after the first selected value while retaining the all-stack total', () => {
		const dataset = {
			source: [
				{ timestamp: 1, Total: 10, PreStocks: null, Securitize: 10 },
				{ timestamp: 2, Total: 11, PreStocks: null, Securitize: 11 },
				{ timestamp: 3, Total: 23, PreStocks: 12, Securitize: 11 },
				{ timestamp: 4, Total: 11, PreStocks: 0, Securitize: 11 }
			],
			dimensions: ['timestamp', 'Total', 'PreStocks', 'Securitize']
		}

		expect(getRWAPerpsChartDatasetForSelectedStacks(dataset, ['PreStocks'], ['PreStocks', 'Securitize'])).toEqual({
			source: [
				{ timestamp: 3, Total: 23, PreStocks: 12 },
				{ timestamp: 4, Total: 11, PreStocks: 0 }
			],
			dimensions: ['timestamp', 'Total', 'PreStocks']
		})
	})

	test('keeps only Total when every breakdown stack is deselected', () => {
		expect(
			getRWAPerpsChartDatasetForSelectedStacks(
				{
					source: [{ timestamp: 1, Total: 30, Meta: 10, NVIDIA: 20 }],
					dimensions: ['timestamp', 'Total', 'Meta', 'NVIDIA']
				},
				[],
				['Meta', 'NVIDIA']
			)
		).toEqual({
			source: [{ timestamp: 1, Total: 30 }],
			dimensions: ['timestamp', 'Total']
		})
	})

	test('builds bar series for volume charts', () => {
		expect(
			buildRWAPerpsOverviewChartSeries({
				chartType: 'volume24h',
				stackOptions: ['Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toMatchObject([
			{ name: 'Meta', type: 'bar', stack: 'A', large: false },
			{ name: 'NVIDIA', type: 'bar', stack: 'A', large: false }
		])
	})

	test('builds a total series when the grouped dataset only exposes Total', () => {
		expect(
			buildRWAPerpsOverviewChartSeries({
				chartType: 'markets',
				stackOptions: ['Total'],
				timeSeriesMode: 'grouped'
			})
		).toMatchObject([{ name: 'Total', type: 'line' }])
	})

	test('adds a plain total line ahead of the breakdown color scale for breakdown line charts', () => {
		expect(
			buildRWAPerpsOverviewChartSeries({
				chartType: 'openInterest',
				stackOptions: ['Total', 'Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toEqual([
			{
				name: 'Meta',
				type: 'line',
				encode: { x: 'timestamp', y: 'Meta' },
				color: CHART_COLORS[1]
			},
			{
				name: 'NVIDIA',
				type: 'line',
				encode: { x: 'timestamp', y: 'NVIDIA' },
				color: CHART_COLORS[2]
			},
			{
				name: 'Total',
				type: 'line',
				encode: { x: 'timestamp', y: 'Total' },
				color: CHART_COLORS[0],
				hideAreaStyle: true,
				excludeFromTooltipTotal: true
			}
		])
	})

	test('does not add a total overlay to breakdown bar charts', () => {
		expect(
			buildRWAPerpsOverviewChartSeries({
				chartType: 'volume24h',
				stackOptions: ['Total', 'Meta', 'NVIDIA'],
				timeSeriesMode: 'breakdown'
			})
		).toEqual([
			{
				name: 'Total',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Total' },
				color: CHART_COLORS[0]
			},
			{
				name: 'Meta',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'Meta' },
				color: CHART_COLORS[1]
			},
			{
				name: 'NVIDIA',
				type: 'bar',
				stack: 'A',
				large: false,
				encode: { x: 'timestamp', y: 'NVIDIA' },
				color: CHART_COLORS[2]
			}
		])
	})
})

describe('RWA perps stacks chart', () => {
	test('draws every stack for an empty stacks value and says so when none is selected', () => {
		router.query = { chartType: 'volume24h', timeSeriesMode: 'breakdown', stacks: '' }
		const allStacks = renderVolumeStacks()
		expect(allStacks).not.toContain('No stacks selected.')
		expect(allStacks).not.toContain('There is not enough time-series history')

		router.query = { chartType: 'volume24h', timeSeriesMode: 'breakdown', stacks: 'None' }
		expect(renderVolumeStacks()).toContain('No stacks selected.')
	})

	test('keeps a CEX-only stack selected while CEX Venues is off and says the toggle hides it', () => {
		const notice = 'This selection only has data under CEX Venues. Turn it on to see it.'
		router.query = { chartType: 'volume24h', timeSeriesMode: 'breakdown', stacks: 'binance' }
		const html = renderVolumeStacks()
		expect(html).toContain(notice)
		expect(html).toContain('Show every venue')

		router.query = { chartType: 'volume24h', timeSeriesMode: 'breakdown', excludeStacks: ['xyz', 'flx'] }
		expect(renderVolumeStacks()).toContain(notice)

		router.query = { chartType: 'volume24h', timeSeriesMode: 'breakdown', stacks: 'missing-venue' }
		const unknown = renderVolumeStacks()
		expect(unknown).not.toContain(notice)
		expect(unknown).toContain('No stacks selected.')
	})

	test('lists CEX-only stacks whether or not CEX Venues is on', () => {
		const stacks = (includeCex: boolean) =>
			resolveRWAPerpsStackSelection({
				query: {},
				stackOptions: includeCex ? ['xyz', 'binance', 'flx'] : ['xyz', 'flx'],
				cexOnlyStacks: ['binance'],
				includeCex
			})

		expect(stacks(false).options).toEqual([
			{ key: 'xyz', name: 'xyz' },
			{ key: 'flx', name: 'flx' },
			{ key: 'binance', name: 'binance', help: 'Requires CEX Venues' }
		])
		expect(stacks(true).optionKeys).toEqual(['xyz', 'binance', 'flx'])
	})
})
