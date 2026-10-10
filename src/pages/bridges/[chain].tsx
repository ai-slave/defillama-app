import type { GetStaticPropsContext, GetStaticPropsResult } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { BridgesOverviewByChain } from '~/containers/Bridges/BridgesOverviewByChain'
import { getBridgeOverviewPageData } from '~/containers/Bridges/queries.server'
import Layout from '~/layout'
import { PanelStatus } from '~/ui/Status'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

type BridgesPageData = Awaited<ReturnType<typeof getBridgeOverviewPageData>>

type BridgesPageProps =
	| {
			state: 'ready'
			data: BridgesPageData
			chainSlug: string
	  }
	| {
			state: 'disabled'
			chainSlug: string
			chainLabel: string
	  }

export const getStaticProps = withPerformanceLogging(
	'bridges/[chain]',
	async (context: GetStaticPropsContext<{ chain: string }>): Promise<GetStaticPropsResult<BridgesPageProps>> => {
		const { params, revalidateReason } = context
		if (!params?.chain) {
			return { notFound: true }
		}

		const chainSlug = slug(params.chain)
		const metadataCache = await import('~/utils/metadata').then((m) => m.default)

		if (!metadataCache.bridgeChainSlugsSet.has(chainSlug)) {
			return {
				notFound: true,
				revalidate: maxAgeForNext([22])
			}
		}

		const canonicalChain = metadataCache.bridgeChainSlugToName?.[chainSlug] ?? params.chain
		if (params.chain !== chainSlug) {
			return canonicalRouteRedirect(`/bridges/${chainSlug}`)
		}

		try {
			const data = await getBridgeOverviewPageData(canonicalChain, { includeBridgeTxCounts: true })

			if (!data) {
				if (revalidateReason === 'stale') {
					throw new Error(`No bridge overview data returned for ${canonicalChain}`)
				}
				return {
					props: { state: 'disabled', chainSlug, chainLabel: canonicalChain },
					revalidate: maxAgeForNext([22])
				}
			}

			return {
				props: { state: 'ready', data, chainSlug },
				revalidate: maxAgeForNext([22])
			}
		} catch (error) {
			console.error(`[bridges] failed to fetch data for ${canonicalChain}:`, error)
			if (revalidateReason === 'stale') throw error

			return {
				props: { state: 'disabled', chainSlug, chainLabel: canonicalChain },
				revalidate: maxAgeForNext([22])
			}
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

const pageName = ['Bridges Volume', 'by', 'Chain']

export default function Bridges(props: BridgesPageProps) {
	if (props.state === 'disabled') {
		return (
			<Layout
				title={`Bridges Volume on ${props.chainLabel} - DefiLlama`}
				description="This bridge chain route is temporarily unavailable and will be back shortly."
				canonicalUrl={`/bridges/${props.chainSlug}`}
				pageName={pageName}
			>
				{/* Static props: the page rebuilds on its revalidate interval, so there is no read here to retry. */}
				<PanelStatus variant="error">Couldn't load bridge data for {props.chainLabel}.</PanelStatus>
			</Layout>
		)
	}

	const {
		chains,
		filteredBridges,
		messagingProtocols,
		bridgeNames,
		bridgeNameToChartDataIndex,
		chartDataByBridge,
		chain,
		chainVolumeData,
		rawBridgeVolumeData,
		netflowsData,
		bridgeStatsCurrentDay,
		largeTxsData
	} = props.data

	return (
		<Layout
			title={`Bridges Volume on ${chain} - DefiLlama`}
			description={`Live bridge volume analytics for ${chain}. Track deposits, withdrawals, large transactions and net flows across bridges and protocols.`}
			canonicalUrl={`/bridges/${props.chainSlug}`}
			pageName={pageName}
		>
			<BridgesOverviewByChain
				chains={chains}
				selectedChain={chain}
				filteredBridges={filteredBridges}
				messagingProtocols={messagingProtocols}
				bridgeNames={bridgeNames}
				bridgeNameToChartDataIndex={bridgeNameToChartDataIndex}
				chartDataByBridge={chartDataByBridge}
				chainVolumeData={chainVolumeData}
				rawBridgeVolumeData={rawBridgeVolumeData}
				netflowsData={netflowsData}
				bridgeStatsCurrentDay={bridgeStatsCurrentDay}
				largeTxsData={largeTxsData}
			/>
		</Layout>
	)
}
