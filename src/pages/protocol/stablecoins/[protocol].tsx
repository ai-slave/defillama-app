import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { useState } from 'react'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { getStablecoinAssetPageData } from '~/containers/Stablecoins/queries.server'
import { PeggedAssetInfo } from '~/containers/Stablecoins/StablecoinOverview'
import { PanelStatus } from '~/ui/Status'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const EMPTY_TOGGLE_OPTIONS = []

export const getStaticProps = withPerformanceLogging(
	'protocol/stablecoins/[protocol]',
	async ({ params }: GetStaticPropsContext<{ protocol: string }>) => {
		if (!params?.protocol) {
			return { notFound: true }
		}
		const { protocol } = params
		const [{ default: metadataCache }, { resolveProtocolFeatureRouteFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolOverview/server/routes')
		])
		const protocolRoute = resolveProtocolFeatureRouteFromMetadata({
			cexRoutePrefix: 'cex/stablecoins',
			hasMetric: (metadata) => Boolean(metadata.stablecoins),
			metadataCache,
			protocol,
			routePrefix: 'protocol/stablecoins'
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(protocolRoute.destination)
		}
		const metadata = protocolRoute.route.metadata
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const protocolData = await fetchProtocolOverviewMetrics(canonicalProtocol)

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const seoTitle = `${protocolData.name} Stablecoin Data & Reserves - DefiLlama`
		const seoDescription = `Track ${protocolData.name} stablecoin market cap, peg stability, chain distribution, and reserves on DefiLlama.`

		const stablecoinsData =
			Array.isArray(protocolData?.stablecoins) && protocolData.stablecoins.length > 0
				? await Promise.all(protocolData.stablecoins.map((stablecoin) => getStablecoinAssetPageData(stablecoin)))
				: []

		return {
			props: {
				name: protocolData.name,
				otherProtocols: protocolData?.otherProtocols ?? [],
				category: protocolData?.category ?? null,
				metrics,
				stablecoinsData: stablecoinsData.flatMap((stablecoin) => (stablecoin ? [stablecoin.props] : [])),
				warningBanners: getProtocolWarningBanners(protocolData),
				seoTitle,
				seoDescription
			},
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => {
	// When this is true (in preview environments) don't
	// prerender any static pages
	// (faster builds, but slower initial page load)
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	const [selectedStablecoinId, setSelectedStablecoinId] = useState(
		() => props.stablecoinsData[0]?.peggedAssetData.id ?? null
	)
	const selectedStablecoin =
		props.stablecoinsData.find((stablecoin) => stablecoin.peggedAssetData.id === selectedStablecoinId) ??
		props.stablecoinsData[0]

	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="stablecoins"
			warningBanners={props.warningBanners}
			toggleOptions={EMPTY_TOGGLE_OPTIONS}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			{selectedStablecoin ? (
				<PeggedAssetInfo
					key={selectedStablecoin.peggedAssetData.id}
					{...selectedStablecoin}
					stablecoinOptions={props.stablecoinsData.map((stablecoin) => ({
						id: stablecoin.peggedAssetData.id,
						name: stablecoin.peggedAssetData.name,
						symbol: stablecoin.peggedAssetData.symbol
					}))}
					onStablecoinChange={setSelectedStablecoinId}
				/>
			) : (
				<PanelStatus variant="error">Couldn&apos;t load data.</PanelStatus>
			)}
		</ProtocolOverviewLayout>
	)
}
