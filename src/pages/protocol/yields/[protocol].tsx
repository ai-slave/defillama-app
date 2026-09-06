import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { useRouter } from 'next/router'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { YIELD_EARN_DATASET_API } from '~/containers/Yields/constants'
import { YieldFilters } from '~/containers/Yields/Filters'
import { useFormatYieldQueryParams } from '~/containers/Yields/hooks'
import { selectedSubsetQuery } from '~/containers/Yields/queryState'
import { PaginatedYieldsPoolTable } from '~/containers/Yields/Tables/Pools'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { useYieldsServerTable } from '~/containers/Yields/useYieldsServerTable'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { sluggifyProtocol } from '~/utils/cache-client'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatNumber } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const EMPTY_TOGGLE_OPTIONS = []
const EMPTY_POOL_ROWS: Array<IYieldTableRow> = []
const EMPTY_CHAINS: Array<string> = []
export const getStaticProps = withPerformanceLogging(
	'protocol/yields/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.yields),
			metadataCache,
			protocol,
			routePrefix: 'protocol/yields'
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

		if (!protocolData) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const seoTitle = `${protocolData.name} Yield Pools & APY Rankings - DefiLlama`
		const seoDescription = `Explore ${protocolData.name} yield pools, APY rankings, and liquidity farming opportunities across chains on DefiLlama.`

		// Aggregate this protocol's own pools plus its children's when it is a parent (no
		// parentProtocol of its own) — a parent tab shows every child's pools.
		const protocolSlug = sluggifyProtocol(protocolData.name)
		const protocolSlugs = new Set<string>([protocolSlug])
		if (!protocolData.parentProtocol) {
			for (const otherProtocol of protocolData.otherProtocols ?? []) {
				protocolSlugs.add(sluggifyProtocol(otherProtocol))
			}
		}

		// The earn dataset's `protocol=` filter is protocol-NAME based, so resolve the slug
		// set to v2 protocol names via the yields meta. Slugs with no v2 yield pools are
		// absent from the meta and drop out (a tiny name list ships to the client, which
		// fetches the rows itself).
		let protocolNames: Array<string> = []
		// Chains present for THIS protocol's pools (drives the tab's Chains dropdown options),
		// ordered by pool count; evmChains is the EVM subset (the shared dropdown's "All EVM").
		let chainList: Array<string> = []
		let evmChains: Array<string> = []
		const [{ acquireYieldsSnapshot, readYieldsMeta }, { getEntityEarn }] = await Promise.all([
			import('~/containers/Yields/server/dataset.server'),
			import('~/containers/Yields/data/enrich.server')
		])
		const snapshot = await acquireYieldsSnapshot('blocking')
		const meta = await readYieldsMeta(snapshot)
		const slugToName = new Map(meta.protocols.map((entry) => [entry.slug, entry.name]))
		const names = new Set<string>()
		for (const slug of protocolSlugs) {
			const name = slugToName.get(slug)
			if (name) names.add(name)
		}
		protocolNames = [...names]

		if (protocolNames.length > 0) {
			const rows = await getEntityEarn(snapshot)
			// Meme pools are excluded from the tab's default server view, so leave them out of
			// the chain vocabulary too (an all-meme chain would otherwise offer zero rows).
			const memePoolIds = new Set(meta.meme_pool_ids)
			const chainCounts = new Map<string, number>()
			const chainIsEvm = new Map<string, boolean>()
			for (const row of rows) {
				if (!names.has(row.protocol) || memePoolIds.has(row.id) || !row.chain) continue
				chainCounts.set(row.chain, (chainCounts.get(row.chain) ?? 0) + 1)
				if (row.isEvm) chainIsEvm.set(row.chain, true)
			}
			chainList = [...chainCounts.keys()].sort(
				(a, b) => (chainCounts.get(b) ?? 0) - (chainCounts.get(a) ?? 0) || a.localeCompare(b)
			)
			evmChains = chainList.filter((chain) => chainIsEvm.get(chain))
		}

		return {
			props: {
				name: protocolData.name,
				parentProtocol: protocolData.parentProtocol ?? null,
				otherProtocols: protocolData.otherProtocols ?? [],
				category: protocolData.category ?? null,
				metrics,
				protocolNames,
				chainList,
				evmChains,
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

// Embedded earn surface, scoped to this protocol's name(s) via a fixed `protocol=` filter
// (not user-editable). The tab exposes exactly FOUR user controls — Chains, TVL range, APY
// range, Columns — reusing the earn page's shared components; they compose with the fixed
// protocol filter through the same server query. No other filters/dials/views.
function ProtocolYieldsTab({
	protocolNames,
	chainList,
	evmChains
}: {
	protocolNames: Array<string>
	chainList: Array<string>
	evmChains: Array<string>
}) {
	const hasProtocols = protocolNames.length > 0

	// Chains dropdown state: decode the URL `chain=` selection (expands ALL_EVM / All / None)
	// against this protocol's chain list, exactly as the earn page does.
	const router = useRouter()
	const resolvedPathname = router.asPath.split('?')[0]

	const { selectedChains } = useFormatYieldQueryParams({
		chainList,
		evmChains,
		projectQueryKey: 'protocol',
		excludeProjectQueryKey: 'excludeProtocol'
	})

	// Fixed protocol filter + the resolved chain selection ride the earn table's server query.
	// TVL/APY ranges (minTvl/maxTvl/minApy/maxApy) and the `column=` param flow through the URL
	// query untouched: the earn route honors the ranges and the table reads `column=` from the
	// router, so no extra wiring is needed for those three.
	const extraQuery = {
		protocol: protocolNames,
		chain: chainList.length > 0 ? selectedSubsetQuery(selectedChains, chainList) : undefined
	}
	const { rows, total, isLoading, rowsQuery, tableProps } = useYieldsServerTable<IYieldTableRow>({
		endpoint: YIELD_EARN_DATASET_API,
		enabled: hasProtocols,
		extraQuery
	})
	const poolsData = rows.length > 0 ? rows : EMPTY_POOL_ROWS

	if (!hasProtocols) {
		return <PanelStatus variant="empty">No yield pools for this protocol</PanelStatus>
	}

	return (
		<>
			<div className="mt-1 mb-2 flex flex-wrap items-baseline gap-x-3 px-1">
				<p className={`text-sm text-secondary ${total ? '' : 'invisible'}`}>
					Tracking <strong className="text-primary">{formatNumber(total)}</strong> {total === 1 ? 'pool' : 'pools'}
				</p>
			</div>
			<div className="mb-3">
				<YieldFilters
					chainList={chainList}
					selectedChains={selectedChains}
					evmChains={evmChains}
					tvlRange
					tvlRangeLabel="TVL"
					apyRange
					showColumns
					saveView={false}
					resetFilters
					pathname={resolvedPathname}
				/>
			</div>
			{isLoading ? (
				<PanelLoadingStatus label="Loading pools" />
			) : rowsQuery.isError && !rowsQuery.data ? (
				<PanelStatus variant="error">Couldn't load pools.</PanelStatus>
			) : poolsData.length > 0 ? (
				<PaginatedYieldsPoolTable data={poolsData} {...tableProps} />
			) : (
				<PanelStatus variant="empty">No yield pools for this protocol</PanelStatus>
			)}
		</>
	)
}

export default function Protocols(props: InferGetStaticPropsType<typeof getStaticProps>) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="yields"
			warningBanners={props.warningBanners}
			toggleOptions={EMPTY_TOGGLE_OPTIONS}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<ProtocolYieldsTab
				protocolNames={props.protocolNames ?? EMPTY_POOL_NAMES}
				chainList={props.chainList ?? EMPTY_CHAINS}
				evmChains={props.evmChains ?? EMPTY_CHAINS}
			/>
		</ProtocolOverviewLayout>
	)
}

const EMPTY_POOL_NAMES: Array<string> = []
