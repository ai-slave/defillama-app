import type { GetStaticPropsContext, InferGetStaticPropsType } from 'next'
import { useRouter } from 'next/router'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { YIELD_EARN_DATASET_API, YIELD_EARN_PRIVATE_API } from '~/containers/Yields/constants'
import { YieldFilters } from '~/containers/Yields/Filters'
import { ApyViewControls } from '~/containers/Yields/Filters/ApyViewControls'
import { resolveEarnColumnAccess } from '~/containers/Yields/Filters/columnOptions'
import { YIELDS_TABLE_PREFS } from '~/containers/Yields/stickyQueryPrefs'
import { PaginatedYieldsPoolTable } from '~/containers/Yields/Tables/Pools'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'
import { useStickyPrefsOverlay, useStickyQueryReplace } from '~/containers/Yields/useStickyQueryReplace'
import { useVerifiedAccess } from '~/containers/Yields/useVerifiedAccess'
import { useYieldsServerTable } from '~/containers/Yields/useYieldsServerTable'
import { useIsClient } from '~/hooks/useIsClient'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { sluggifyProtocol } from '~/utils/cache-client'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatNumber } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { queryReadFailed } from '~/utils/query'
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
		// ordered by pool count; evmChains is the EVM subset behind the chain picker's "Only EVM chains" action.
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

// Shared earn controls with a fixed protocol filter.
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

	const router = useRouter()
	const isClient = useIsClient()
	const resolvedPathname = router.asPath.split('?')[0]
	// No server seed on this tab. Stay on the placeholder until the client has read storage,
	// or a saved APY window would fetch the default view first.
	const stickyReady = useStickyQueryReplace(
		useStickyPrefsOverlay(hasProtocols && router.isReady ? router.query : null, YIELDS_TABLE_PREFS)
	)
	const preferencesReady = isClient && stickyReady

	// The fixed protocol filter rides the earn table's server query. The chain picker's keys, the
	// TVL/APY ranges and the `column=` param flow through the URL query untouched: the earn route
	// applies the chain selection and ranges, and the table reads `column=` from the router.
	const extraQuery = {
		protocol: protocolNames,
		// The tab only has a chain picker, so other picker keys in the URL are ignored.
		excludeProtocol: undefined,
		category: undefined,
		excludeCategory: undefined
	}
	// Same two tiers as the earn page: subscribers read the private mirror, so their APY cells carry
	// the measured figure and the Exit Status column is on by default. No server-tiered seed here,
	// so the tier is the client's alone.
	const { hasAccess, isDenied } = useVerifiedAccess()
	const { defaultColumns } = resolveEarnColumnAccess({ hasAccess, initialVerifiedAccess: false, isDenied })
	const { rows, total, data, isLoading, rowsQuery, tableProps } = useYieldsServerTable<IYieldTableRow>({
		endpoint: YIELD_EARN_DATASET_API,
		privateEndpoint: YIELD_EARN_PRIVATE_API,
		enabled: hasProtocols && preferencesReady,
		extraQuery
	})
	const poolsData = rows.length > 0 ? rows : EMPTY_POOL_ROWS

	if (!hasProtocols) {
		return <PanelStatus variant="empty">No yield pools for this protocol</PanelStatus>
	}

	return (
		<>
			<div className="mt-1 mb-2 flex flex-wrap items-baseline gap-x-3 px-1">
				<p className={`body-md text-secondary ${total ? '' : 'invisible'}`}>
					Tracking <strong className="text-primary">{formatNumber(total)}</strong> {total === 1 ? 'pool' : 'pools'}
				</p>
			</div>
			<div className="mb-3">
				<YieldFilters
					chainList={chainList}
					evmChains={evmChains}
					tvlRange={data?.tvlQuickPicks ?? []}
					tvlRangeLabel="TVL"
					apyRange={data?.apyQuickPicks ?? []}
					showColumns
					defaultColumns={defaultColumns}
					apyControls={<ApyViewControls ready={preferencesReady} />}
					saveView={false}
					resetFilters
					pathname={resolvedPathname}
				/>
			</div>
			{queryReadFailed(rowsQuery) ? (
				<PanelStatus variant="error" retry={rowsQuery}>
					Couldn't load pools.
				</PanelStatus>
			) : isLoading ? (
				<PanelLoadingStatus label="Loading pools" />
			) : poolsData.length > 0 ? (
				<PaginatedYieldsPoolTable data={poolsData} defaultColumns={defaultColumns} {...tableProps} />
			) : (
				<PanelStatus variant="empty">No pools match the selected filters</PanelStatus>
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
