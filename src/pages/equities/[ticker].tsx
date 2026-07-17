import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import {
	getEquitiesTickerPageData,
	getEquitiesTickerPaths,
	getEquitiesTickerRedirectSlug
} from '~/containers/Equities/queries'
import { EquityTickerPage } from '~/containers/Equities/TickerPage'
import { buildEquityTickerCountrySlug, parseEquityTickerCountrySlug } from '~/containers/Equities/utils'
import Layout from '~/layout'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

function getCanonicalEquityTickerSlug(
	ticker: string,
	country: string,
	routes: Array<{ ticker: string; country: string }>
): string | null {
	const lookupTicker = ticker.toLowerCase()
	const lookupCountry = country.toLowerCase()

	for (const route of routes) {
		if (route.ticker.toLowerCase() === lookupTicker && route.country.toLowerCase() === lookupCountry) {
			return buildEquityTickerCountrySlug(route.ticker, route.country)
		}
	}

	return null
}

export const getStaticProps = withPerformanceLogging(
	'equities/[ticker]',
	async ({ params }: GetStaticPropsContext<{ ticker: string }>) => {
		if (!params?.ticker) {
			return { notFound: true }
		}

		const metadata = await import('~/utils/metadata').then((m) => m.default)
		const tickerCountry = parseEquityTickerCountrySlug(params.ticker)

		if (!tickerCountry) {
			const redirectSlug = await getEquitiesTickerRedirectSlug(params.ticker, metadata.equitiesCompanyRoutes)
			if (!redirectSlug) return { notFound: true }

			return canonicalRouteRedirect(`/equities/${redirectSlug}`)
		}

		const inputSlug = buildEquityTickerCountrySlug(tickerCountry.ticker, tickerCountry.country)
		const canonicalSlug = metadata.equitiesCompanySlugsSet.has(inputSlug)
			? inputSlug
			: getCanonicalEquityTickerSlug(tickerCountry.ticker, tickerCountry.country, metadata.equitiesCompanyRoutes)

		if (!canonicalSlug) {
			return { notFound: true }
		}

		if (params.ticker !== canonicalSlug) {
			return canonicalRouteRedirect(`/equities/${canonicalSlug}`)
		}

		const props = await getEquitiesTickerPageData(tickerCountry.ticker, tickerCountry.country, {
			protocolDisplayNames: metadata.protocolDisplayNames,
			rwaPlatforms: metadata.rwaList.platforms,
			emissionsProtocolBySlug: metadata.emissionsProtocolBySlug
		})

		if (!props) {
			return { notFound: true }
		}

		return {
			props,
			revalidate: maxAgeForNext([5])
		}
	}
)

export async function getStaticPaths() {
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	const tickers = await getEquitiesTickerPaths()
	const paths: Array<{ params: { ticker: string } }> = []
	for (const ticker of tickers) {
		paths.push({ params: { ticker } })
	}

	return {
		paths,
		fallback: 'blocking'
	}
}

export default function EquityTickerDetailPage(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<Layout
			title={`${props.name} (${props.ticker}:${props.country}) Stock Overview - DefiLlama`}
			description={`Track ${props.name} (${props.ticker}:${props.country}) price history, financial statements, key metrics, fundamentals, and SEC filings on DefiLlama.`}
			canonicalUrl={`/equities/${props.slug}`}
		>
			<EquityTickerPage {...props} />
		</Layout>
	)
}
