// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { IMultiSeriesChartProps } from '~/components/ECharts/MultiSeriesChart/types'
import { installDownloadSink } from '~/utils/testing/downloadSink'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { StablecoinChartSeriesPayload } from '../chartSeries'
import { StablecoinsByChain } from '../StablecoinsByChain'
import { buildStablecoinVolumeChartPayload } from '../volumeChart'

const router = vi.hoisted(() => ({
	pathname: '/stablecoins/[chain]',
	asPath: '/stablecoins/Ethereum?chartType=volume&chartView=byToken',
	query: {} as Record<string, string | Array<string>>,
	push: vi.fn()
}))
const chart = vi.hoisted(() => ({
	// Suspends the chart's render for matching props, holding the deferred chart on the rows already on screen.
	holdWhen: (_props: IMultiSeriesChartProps): boolean => false,
	pending: new Promise<never>(() => {}),
	/** The series the last drawn chart was given, the target its CSV must match. */
	drawnSeries: [] as Array<string>
}))

vi.mock('next/router', () => ({ useRouter: () => router }))
// ECharts cannot draw in happy-dom; the stub suspends and records the series it was given to draw.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({
	default: (props: IMultiSeriesChartProps) => {
		if (chart.holdWhen(props)) throw chart.pending
		chart.drawnSeries = props.charts
			.map((series) => series.name)
			.filter((name) => props.selectedCharts?.has(name) ?? true)
		return null
	}
}))

const session = installSubscriberSession('subscriber', { resolved: true })
const downloads = installDownloadSink()
let container: HTMLDivElement
let root: Root

// Monday 2021-01-04, Tuesday 2021-01-05 and Monday 2021-01-11: two days in one week, one in the next.
const VOLUME_POINTS: Array<[number, Record<string, number>]> = [
	[1_609_718_400, { usdt: 10, usdc: 5 }],
	[1_609_804_800, { usdt: 20, usdc: 5 }],
	[1_610_323_200, { usdt: 30, usdc: 5 }]
]
const EMPTY_CHART = {
	dataset: { source: [], dimensions: ['timestamp'] },
	charts: [],
	valueSymbol: '$',
	stacked: false,
	showTotalInTooltip: false
} as unknown as StablecoinChartSeriesPayload

const page = () => (
	<session.Wrapper>
		<StablecoinsByChain
			selectedChain="Ethereum"
			chains={['Ethereum']}
			filteredPeggedAssets={[]}
			availableBackings={[]}
			availablePegTypes={[]}
			defaultChartData={EMPTY_CHART}
		/>
	</session.Wrapper>
)

// Shallow routing re-renders the page with the new query; the mock does the same.
router.push.mockImplementation(async ({ query }: { query: Record<string, string | Array<string>> }) => {
	router.query = query
	await act(async () => root.render(page()))
})

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	chart.holdWhen = () => false
	chart.drawnSeries = []
	router.query = { chartType: 'volume', chartView: 'byToken' }
	session.serve({
		// Applies the picker's intent the way the volume route does.
		'/api/public/stablecoins/volume-chart': (url: URL) =>
			buildStablecoinVolumeChartPayload({
				chart: 'token',
				data: VOLUME_POINTS,
				limit: url.searchParams.has('all') ? null : Number(url.searchParams.get('limit')),
				selectedNames: url.searchParams.has('include') ? url.searchParams.getAll('series') : null,
				excludedNames: url.searchParams.has('exclude') ? url.searchParams.getAll('series') : null
			})
	})
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
	)
}

// The series picker reads "<picked count>Token"; the view picker beside it reads "By Token".
function tokenPicker() {
	return [...container.querySelectorAll<HTMLButtonElement>('button[role="combobox"]')].find((button) =>
		/^\d+Token$/.test(button.textContent ?? '')
	)
}

async function renderPage() {
	await act(async () => root.render(page()))
	// The token picker shows once the volume chart has loaded its series.
	await waitForUi(() => expect(tokenPicker()).not.toBeUndefined())
}

async function pickWeekly() {
	await act(async () => container.querySelector<HTMLInputElement>('input[type="radio"][value="weekly"]')!.click())
}

async function click(element: HTMLElement) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
		element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }))
		element.click()
		await Promise.resolve()
	})
}

async function toggleToken(name: string) {
	await click(tokenPicker()!)
	const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) =>
		element.textContent?.includes(name)
	)!
	await click(option)
	await act(async () =>
		document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
	)
}

async function exportCsv() {
	const button = csvButton()!
	await waitForUi(() => expect(button.disabled).toBe(false))
	await act(async () => button.click())
	await waitForUi(() => expect(downloads).toHaveLength(1))
	return downloads[0]!.blob.text()
}

test('exports the daily volume the chart still draws while weekly grouping renders', async () => {
	await renderPage()
	chart.holdWhen = ({ groupBy }) => groupBy === 'weekly'

	await pickWeekly()

	expect(router.query.groupBy).toBe('weekly')
	expect(await exportCsv()).toBe(
		'Timestamp,Date,USDT,USDC\n1609718400000,2021-01-04,10,5\n1609804800000,2021-01-05,20,5\n1610323200000,2021-01-11,30,5'
	)
})

test('exports weekly volume once weekly grouping renders', async () => {
	await renderPage()

	await pickWeekly()

	expect(await exportCsv()).toBe(
		'Timestamp,Week start,Week end,USDT,USDC\n1610236800000,2021-01-04,2021-01-10,30,10\n1610841600000,2021-01-11,2021-01-17,30,5'
	)
})

const csvSeries = (csv: string) => csv.split('\n')[0]!.split(',').slice(2)

test('exports the tokens the chart still draws while a new token selection renders', async () => {
	await renderPage()
	// Fetch the USDT-only rows once, so picking them again renders cached rows that the stub can hold.
	await toggleToken('USDC')
	await waitForUi(() => expect(chart.drawnSeries).toEqual(['USDT']))
	await toggleToken('USDC')
	await waitForUi(() => expect(chart.drawnSeries).toEqual(['USDT', 'USDC']))
	chart.holdWhen = ({ dataset }) => !dataset.dimensions.includes('USDC')

	await toggleToken('USDC')

	expect(csvSeries(await exportCsv())).toEqual(chart.drawnSeries)
	expect(chart.drawnSeries).toEqual(['USDT', 'USDC'])
})

test('exports the picked tokens once the selection renders', async () => {
	await renderPage()

	await toggleToken('USDC')
	await waitForUi(() => expect(chart.drawnSeries).toEqual(['USDT']))

	expect(await exportCsv()).toBe(
		'Timestamp,Date,USDT\n1609718400000,2021-01-04,10\n1609804800000,2021-01-05,20\n1610323200000,2021-01-11,30'
	)
})
