import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
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

	test('carries no note that the cards ignore the filters', () => {
		expect(render().html).not.toContain('apply to the table only')
	})
})
