import type { GetServerSideProps } from 'next'
import { Announcement } from '~/components/Announcement'
import { disclaimer } from '~/containers/Yields/constants'
import {
	fetchStablecoinRatesCurrent,
	fetchStablecoinRatesHistory,
	type RateRange,
	type StablecoinRatesCurrent,
	type StablecoinRatesHistory
} from '~/containers/Yields/rates/fetch'
import { ReferenceRates } from '~/containers/Yields/rates/ReferenceRates'
import Layout from '~/layout'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

interface RatesPageProps {
	current: StablecoinRatesCurrent
	history: StablecoinRatesHistory
	initialRange: RateRange
}

const getServerSidePropsHandler: GetServerSideProps<RatesPageProps> = async ({ query, res }) => {
	// Chart range is URL-driven (?range=), defaulting to 90d. Fetch that range; ReferenceRates
	// fetches the wider "max" on demand and slices narrower ranges locally — first paint stays light.
	const rangeParam = typeof query.range === 'string' ? query.range : Array.isArray(query.range) ? query.range[0] : null
	const initialRange: RateRange = rangeParam === '30d' || rangeParam === '90d' ? rangeParam : 'max'
	const [current, history] = await Promise.all([
		fetchStablecoinRatesCurrent(),
		fetchStablecoinRatesHistory(initialRange)
	])
	res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600')
	return { props: { current, history, initialRange } }
}

export const getServerSideProps = withServerSidePropsTelemetry('yields/rates', getServerSidePropsHandler)

const pageName = ['Yields: Reference Rates']

export default function YieldsRatesPage({ current, history, initialRange }: RatesPageProps) {
	return (
		<Layout
			title="Stablecoin Reference Rates - DefiLlama"
			description="Market-size weighted supply and borrow benchmark rates for major stablecoins across the largest DeFi lending markets, with per-asset and per-protocol breakdowns."
			canonicalUrl={`/yields/rates`}
			pageName={pageName}
		>
			<Announcement announcementId="yields-disclaimer" version="2026-03">
				{disclaimer}
			</Announcement>
			<ReferenceRates current={current} initialHistory={history} initialRange={initialRange} />
		</Layout>
	)
}
