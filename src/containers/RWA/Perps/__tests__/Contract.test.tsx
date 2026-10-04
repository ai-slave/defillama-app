import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import {
	getRWAPerpsContractChartGroup,
	getRWAPerpsContractEnabledMetrics,
	getRWAPerpsContractGroupByQueryPatch,
	getRWAPerpsContractMetricQueryPatch,
	RWAPerpsContractPage
} from '../Contract'
import { TEST_CONTRACT } from './contractFixture'

vi.mock('next/router', () => ({
	useRouter: () => ({
		asPath: '/rwa/perps/contract/xyz:META',
		query: {},
		push: vi.fn()
	})
}))

describe('Contract helpers', () => {
	test('links the market information venue to the venue page', () => {
		const html = renderToStaticMarkup(<RWAPerpsContractPage contract={TEST_CONTRACT} />)

		expect(html).toContain('href="/rwa/perps/venue/xyz-exchange"')
		expect(html).toContain('XYZ Exchange')
	})

	test('names the price change window beside the headline price', () => {
		const text = renderToStaticMarkup(<RWAPerpsContractPage contract={TEST_CONTRACT} />).replace(/<[^>]+>/g, '')
		expect(text).toContain('+5.00%over 24h')
	})

	test('renders the contract link as a right-aligned website icon when present', () => {
		const html = renderToStaticMarkup(<RWAPerpsContractPage contract={TEST_CONTRACT} />)

		expect(html).toContain('href="https://app.hyperliquid.xyz/join/DEFILLAMAS"')
		expect(html).toContain('aria-label="Open xyz:META website"')
	})

	test('warns on suspicious market detail pages', () => {
		const html = renderToStaticMarkup(
			<RWAPerpsContractPage contract={{ ...TEST_CONTRACT, market: { ...TEST_CONTRACT.market, suspicious: true } }} />
		)

		expect(html).toContain('marked as suspicious and is excluded from cross-venue totals and charts')
	})

	test('normalizes invalid or missing groupBy values back to daily', () => {
		expect(getRWAPerpsContractChartGroup(null)).toBe('daily')
		expect(getRWAPerpsContractChartGroup('weekly')).toBe('weekly')
		expect(getRWAPerpsContractChartGroup('cumulative')).toBe('daily')
		expect(getRWAPerpsContractChartGroup('bad-value')).toBe('daily')
	})

	test('derives enabled metrics from URLSearchParams state', () => {
		const params = new URLSearchParams({
			oi: 'false',
			vol24h: 'true',
			funding: 'true'
		})

		expect(getRWAPerpsContractEnabledMetrics(params)).toEqual(['volume24h', 'price', 'fundingRate'])
	})

	test('builds metric and groupBy query patches for interactive controls', () => {
		expect(
			getRWAPerpsContractMetricQueryPatch({
				metric: { queryKey: 'funding', defaultEnabled: false },
				isActive: false
			})
		).toEqual({ funding: 'true' })

		expect(
			getRWAPerpsContractMetricQueryPatch({
				metric: { queryKey: 'oi', defaultEnabled: true },
				isActive: true
			})
		).toEqual({ oi: 'false' })

		expect(getRWAPerpsContractGroupByQueryPatch('daily')).toEqual({ groupBy: undefined })
		expect(getRWAPerpsContractGroupByQueryPatch('monthly')).toEqual({ groupBy: 'monthly' })
	})
})
