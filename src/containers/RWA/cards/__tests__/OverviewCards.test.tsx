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
import { perpsAsset, spotAsset } from '../../table/__tests__/fixtures'
import type { RwaOverviewCards } from '../cardData'
import { RWAOverviewCards, type RWAOverviewCardsProps } from '../OverviewCards'

const DAY = 24 * 60 * 60 * 1000

const cards: RwaOverviewCards = {
	chainChange: {
		bars: [
			{ name: 'Solana', changeUsd: 417_000_000, changePct: 20.3 },
			{ name: 'Aptos', changeUsd: 100_000_000, changePct: 1463.2 },
			{ name: 'BSC', changeUsd: -310_000_000, changePct: -6.2 }
		]
	},
	perpsOpenInterest: {
		value: 15_700_000_000,
		changePct: 33.87,
		series: [
			[0, 10],
			[DAY, 15]
		]
	}
}

const usdy = spotAsset()
const aave = spotAsset({
	id: 'b',
	canonicalMarketId: 'b',
	defiActiveTvl: { total: 300_000, breakdown: [['Morpho Blue', 300_000]] }
})

const http = installFixtureFetch()
const unmounts: Array<() => void> = []

afterEach(async () => {
	for (const unmount of unmounts.splice(0)) await act(async () => unmount())
})

/** A filtered page whose one asset sits on Ethereum alone, so Change by Chain loads one chain history. */
async function mountFiltered() {
	const container = document.createElement('div')
	document.body.appendChild(container)
	const root = createRoot(container)
	// The hook retries once; no delay keeps the failure inside the test's time.
	const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<RWAOverviewCards
					cards={cards}
					assets={[spotAsset({ activeMcap: { total: 800_000, breakdown: [['Ethereum', 800_000]] } })]}
					filtered
					includeStablecoins={false}
					includeGovernance={false}
					includeBridgeTvl
					perpsOpenInterest={null}
				/>
			</QueryClientProvider>
		)
	)
	unmounts.push(() => {
		root.unmount()
		container.remove()
	})
	// The cards are the grid's children, each opening with its title.
	const card = () =>
		[...container.firstElementChild!.children].find((node) => node.textContent.startsWith('Change by Chain'))!
	return { card }
}

function render(props: Partial<RWAOverviewCardsProps> = {}) {
	const html = renderToStaticMarkup(
		<QueryClientProvider client={new QueryClient()}>
			<RWAOverviewCards
				cards={cards}
				assets={[usdy, aave, perpsAsset()]}
				filtered={false}
				includeStablecoins={false}
				includeGovernance={false}
				includeBridgeTvl
				perpsOpenInterest={16_100_000_000}
				{...props}
			/>
		</QueryClientProvider>
	)
	return { html, text: html.replace(/<[^>]+>/g, '') }
}

describe('RWAOverviewCards', () => {
	test('folds RWA in DeFi by Protocol and the Change by Chain total from the rows it is given', () => {
		const { html, text } = render()
		expect(html).toContain('protocols/morpho-blue')
		expect(text).toContain('Morpho Blue$300,000')
		expect(render({ assets: [usdy] }).text).not.toContain('Morpho Blue')
		expect(text).toContain('Change by Chain+$600,000+60.00%over 30d')
	})

	test('draws the server chain split while no filter is set, dollars whole under a million', () => {
		const { html, text } = render()
		expect(html).toContain('chains/rsz_solana')
		expect(text).toContain('+$417m (+20.3%)')
		expect(text).toContain('(+1463%)')
		expect(text).toContain('-$310m')
		expect(render({ filtered: true }).text).not.toContain('Solana')
	})

	test('reads the RWA Perps Open Interest value from the Key Metrics total and the change from the daily split', () => {
		const { text } = render()
		expect(text).toContain('$16.1b+33.87%over 30d')
		expect(text).not.toContain('$15.7b')
		expect(render({ perpsOpenInterest: null }).text).toContain('$15.7b')
	})

	test('Change by Chain under a filter shows loading until the chain history lands, then the chain change', async () => {
		let respond!: (rows: unknown) => void
		http.serve({
			'/api/public/rwa/asset-breakdown': () =>
				new Promise((resolve) => {
					respond = resolve
				})
		})
		const { card } = await mountFiltered()
		await waitForUi(() => expect(respond).toBeTypeOf('function'))
		expect(card().querySelector('[role="status"]')).not.toBeNull()
		expect(alertTexts(card())).toEqual([])

		await act(async () =>
			respond([
				{ timestamp: 0, 'ondo/usdy': 500_000 },
				{ timestamp: 31 * DAY, 'ondo/usdy': 800_000 }
			])
		)
		await waitForUi(() => expect(card().textContent).toContain('Ethereum+$300,000 (+60%)'))
	})

	test('Change by Chain under a filter reads a failed load as an error whose Try again loads the chain change', async () => {
		http.serve({ '/api/public/rwa/asset-breakdown': fixtureStatus(404) })
		const { card } = await mountFiltered()
		await waitForUi(() => expect(alertTexts(card())).toHaveLength(1))

		http.serve({
			'/api/public/rwa/asset-breakdown': () => [
				{ timestamp: 0, 'ondo/usdy': 500_000 },
				{ timestamp: 31 * DAY, 'ondo/usdy': 800_000 }
			]
		})
		const retry = [...card().querySelectorAll('button')].find((button) => accessibleName(button) === 'Try again')!
		await act(async () => retry.click())
		await waitForUi(() => expect(card().textContent).toContain('Ethereum+$300,000 (+60%)'))
		expect(alertTexts(card())).toEqual([])
	})
})
