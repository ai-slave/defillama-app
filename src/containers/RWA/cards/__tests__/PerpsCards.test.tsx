// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { alertTexts } from '~/utils/testing/fieldErrors'
import { fixtureStatus, installFixtureFetch } from '~/utils/testing/fixtureFetch'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { RWAChartDataset } from '../../chartDataset'
import { foldRwaPerpsKpi } from '../../kpi/perpsKpi'
import { perpsAsset } from '../../table/__tests__/fixtures'
import type { RwaChangeCard } from '../cardData'
import type { RwaPerpsCards } from '../perpsCardData'
import { RWAPerpsCards, type RWAPerpsCardsProps } from '../PerpsCards'

const split = (name: string, changeUsd: number): RwaChangeCard => ({
	changeUsd,
	changePct: 5,
	bars: [{ name, changeUsd, changePct: 5 }]
})
const daily = (perDay: number) =>
	Array.from({ length: 10 }, (_, i): [number, number] => [Date.UTC(2026, 0, i + 1), (i + 1) * perDay])
const cards: RwaPerpsCards = {
	venueChange: { withCex: split('Binance', 50), dexOnly: split('Lighter', -20) },
	volume: { withCex: daily(1_000_000), dexOnly: daily(500_000) }
}
const markets = [
	perpsAsset({
		id: 'a',
		venueType: 'DEX',
		parentPlatform: 'Hyperliquid',
		assetGroup: 'Equities',
		openInterest: 2_000_000
	}),
	perpsAsset({
		id: 'b',
		venueType: 'CEX',
		parentPlatform: 'Binance',
		assetGroup: 'Commodities',
		openInterest: 3_000_000,
		fundingRate: -0.0001
	})
]

function render(props: Partial<RWAPerpsCardsProps> = {}) {
	const includeCex = props.includeCex ?? true
	const html = renderToStaticMarkup(
		<QueryClientProvider client={new QueryClient()}>
			<RWAPerpsCards
				cards={cards}
				markets={markets}
				kpi={foldRwaPerpsKpi(markets, includeCex)}
				filtered={false}
				includeCex={includeCex}
				{...props}
			/>
		</QueryClientProvider>
	)
	return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

const DAY = 24 * 60 * 60 * 1000
const CONTRACT_BREAKDOWN = '/api/public/rwa/perps/contract-breakdown'
/** Market a, on Hyperliquid, from 100 to 130 over 31 days: open interest and volume alike. */
const history: RWAChartDataset = {
	dimensions: ['timestamp', 'a'],
	source: [
		{ timestamp: 0, a: 100 },
		{ timestamp: 31 * DAY, a: 130 }
	]
}

const http = installFixtureFetch()
const unmounts: Array<() => void> = []

afterEach(async () => {
	for (const unmount of unmounts.splice(0)) await act(async () => unmount())
})

/** A filtered page: Change by Venue and the Volume card load the per-market history. */
async function mountFiltered() {
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	// The history query retries once; no delay keeps the failure inside the test's time.
	const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<RWAPerpsCards cards={cards} markets={markets} kpi={foldRwaPerpsKpi(markets, true)} filtered includeCex />
			</QueryClientProvider>
		)
	)
	unmounts.push(() => {
		root.unmount()
		container.remove()
	})
	return {
		// The cards are the grid's children, each opening with its title.
		card: (title: string) =>
			[...container.firstElementChild!.children].find((node) => node.textContent.startsWith(title))!
	}
}

describe('RWAPerpsCards', () => {
	test('draws Open Interest by Asset Group with the Key Metrics total, Change by Venue and the 7 day volume line', () => {
		const text = render()
		expect(text).toContain('Open interest by asset group $5m')
		expect(text).toContain('Change by venue')
		expect(text).toMatch(/Volume, 7 day average \$7m a day \+250(\.00)?% over a week/)
		expect(text).not.toContain('RWA perps open interest')
		expect(text).toContain('Commodities')
	})

	test('follows Venue Type DEX only: the asset groups, the server split variant and the DEX daily volume', () => {
		const text = render({ includeCex: false })
		expect(text).toContain('Open interest by asset group $2m')
		expect(text).not.toContain('Commodities')
		expect(text).toContain('Lighter')
		expect(text).not.toContain('Binance')
		expect(text).toMatch(/Volume, 7 day average \$3\.5m a day/)
	})

	test('under a filter, Change by Venue shows loading until the per-market history lands, then folds it', async () => {
		let release!: () => void
		const held = new Promise<void>((resolve) => {
			release = resolve
		})
		http.serve({
			[CONTRACT_BREAKDOWN]: async () => {
				await held
				return history
			}
		})
		const { card } = await mountFiltered()
		await waitForUi(() => expect(http.requests).toHaveLength(2))
		expect(card('Change by venue').querySelector('[role="status"]')).not.toBeNull()
		expect(card('Volume, 7 day average').querySelector('[role="status"]')).not.toBeNull()

		await act(async () => release())
		await waitForUi(() => expect(card('Change by venue').textContent).toContain('Hyperliquid+$30 (+30%)'))
	})

	test('under a filter, a failed history load reads as an error on both history cards, each with its Try again', async () => {
		http.serve({ [CONTRACT_BREAKDOWN]: fixtureStatus(404) })
		const { card } = await mountFiltered()
		await waitForUi(() => expect(alertTexts(card('Change by venue'))).toHaveLength(1))
		expect(alertTexts(card('Volume, 7 day average'))).toHaveLength(1)
		expect(card('Open interest by asset group').textContent).toContain('$5m')

		http.serve({ [CONTRACT_BREAKDOWN]: () => history })
		const retry = [...card('Change by venue').querySelectorAll('button')].find(
			(button) => accessibleName(button) === 'Try again'
		)!
		await act(async () => retry.click())
		await waitForUi(() => expect(card('Change by venue').textContent).toContain('Hyperliquid+$30 (+30%)'))
		expect(alertTexts(card('Change by venue'))).toEqual([])
	})

	test('reads Unavailable, never $0, when the markets have no open interest', () => {
		const empty = [perpsAsset({ openInterest: null })]
		const html = renderToStaticMarkup(
			<QueryClientProvider client={new QueryClient()}>
				<RWAPerpsCards cards={cards} markets={empty} kpi={foldRwaPerpsKpi(empty, true)} filtered={false} includeCex />
			</QueryClientProvider>
		)
		expect(html).toContain('Unavailable')
		expect(html).not.toContain('$0<')
	})
})
