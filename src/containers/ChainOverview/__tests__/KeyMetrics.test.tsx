import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { KeyMetrics } from '../KeyMetrics'
import type { IChainOverviewData } from '../types'

vi.mock('~/components/KeyMetricsPngExport/KeyMetricsPngExportButton', () => ({
	KeyMetricsPngExportButton: () => null
}))

const baseProps: React.ComponentProps<typeof KeyMetrics> = {
	metadata: { name: 'MegaETH' } as IChainOverviewData['metadata'],
	stablecoins: null,
	rwaActiveMcap: null,
	chainStablecoins: null,
	chainFees: { total24h: null, feesGenerated24h: null, topProtocolsChart: null, totalREV24h: null },
	chainRevenue: { total24h: null },
	chainIncentives: { emissions24h: null, emissions7d: null, emissions30d: null },
	appRevenue: { total24h: null },
	appFees: { total24h: null },
	dexs: { total24h: null, total7d: null, change_7dover7d: null, dexsDominance: null, chart: null },
	perps: { total24h: null, total7d: null, change_7dover7d: null },
	inflows: null,
	users: { activeUsers: null, newUsers: null, transactions: null },
	chainRaises: null,
	chainAssets: null,
	protocols: [],
	totalValueUSD: null,
	tvlSettingsGovtokens: false,
	chainTokenInfo: {
		gecko_id: 'megaeth',
		token_symbol: 'MEGA',
		current_price: null,
		market_cap: null,
		fully_diluted_valuation: null
	}
}

const textFromMarkup = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')

describe('ChainOverview KeyMetrics', () => {
	test('renders unavailable token metrics as N/A instead of $0', () => {
		const markup = renderToStaticMarkup(<KeyMetrics {...baseProps} />)
		const text = textFromMarkup(markup)

		expect(text).toContain('$MEGA Price')
		expect(text).toContain('$MEGA Market Cap')
		expect(text).toContain('$MEGA FDV')
		expect(text).toContain('N/A')
		expect(text).not.toContain('$0')
	})

	test('preserves legitimate zero values for token metrics', () => {
		const markup = renderToStaticMarkup(
			<KeyMetrics
				{...baseProps}
				chainTokenInfo={{
					...baseProps.chainTokenInfo!,
					current_price: 0,
					market_cap: 0,
					fully_diluted_valuation: 0
				}}
			/>
		)

		expect(markup).toContain('$0')
		expect(markup).not.toContain('N/A')
	})

	test('renders RWA active market cap when available', () => {
		const markup = renderToStaticMarkup(<KeyMetrics {...baseProps} rwaActiveMcap={123_000_000} />)
		const text = textFromMarkup(markup)

		expect(text).toContain('RWA Active AUM')
		expect(text).toContain('$123m')
	})

	test('hides RWA active market cap when unavailable', () => {
		const markup = renderToStaticMarkup(<KeyMetrics {...baseProps} rwaActiveMcap={0} />)
		const text = textFromMarkup(markup)

		expect(text).toContain('$MEGA Price')
		expect(text).not.toContain('RWA Active AUM')
	})

	test('renders the fetched fee-family totals without client-side adjustments', () => {
		const markup = renderToStaticMarkup(
			<KeyMetrics
				{...baseProps}
				chainFees={{ total24h: 100, feesGenerated24h: null, topProtocolsChart: null, totalREV24h: 500 }}
				chainRevenue={{ total24h: 50 }}
				appRevenue={{ total24h: 1200 }}
				appFees={{ total24h: 2000 }}
			/>
		)
		const text = textFromMarkup(markup)

		expect(text).toContain('Chain Fees (24h)$100')
		expect(text).toContain('Chain Revenue (24h)$50')
		expect(text).toContain('Chain REV (24h)$500')
		expect(text).toContain('App Revenue (24h)$1,200')
		expect(text).toContain('App Fees (24h)$2,000')
	})

	test('renders only the bridged asset sections reported by the producer', () => {
		const v2Markup = renderToStaticMarkup(
			<KeyMetrics
				{...baseProps}
				chainAssets={{
					total: { total: 100 },
					canonical: { total: 10 },
					thirdParty: { total: 20 },
					native: { total: 30 },
					stablecoins: { total: 35 },
					rwa: { total: 3 },
					lst: { total: 2 }
				}}
			/>
		)
		const v2Text = textFromMarkup(v2Markup)

		expect(v2Text).toContain('Bridged TVL$100')
		expect(v2Text).toContain('Native$30')
		expect(v2Text).toContain('Canonical$10')
		expect(v2Text).toContain('Third Party$20')
		expect(v2Text).toContain('Stablecoins$35')
		expect(v2Text).toContain('RWAs$3')
		expect(v2Text).toContain('Liquid Staking$2')

		const legacyText = textFromMarkup(
			renderToStaticMarkup(
				<KeyMetrics
					{...baseProps}
					chainAssets={{ total: { total: 30 }, canonical: { total: 10 }, thirdParty: { total: 20 } }}
				/>
			)
		)

		expect(legacyText).not.toContain('Stablecoins')
		expect(legacyText).not.toContain('RWAs')
		expect(legacyText).not.toContain('Liquid Staking')
	})
})
