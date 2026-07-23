import type { GetStaticPropsContext } from 'next'
import { SKIP_BUILD_STATIC_GENERATION } from '~/constants'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import type { IProtocolRaise } from '~/containers/ProtocolOverview/api.types'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolOverviewPageData, IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { TokenRightsByProtocol } from '~/containers/TokenRights/TokenRightsByProtocol'
import type { ITokenRightsData } from '~/containers/TokenRights/types'
import { parseTokenRightsEntry } from '~/containers/TokenRights/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

const EMPTY_OTHER_PROTOCOLS: string[] = []
type TokenRightsPageProps = {
	name: string
	symbol: string | null
	parentProtocol: string | null
	otherProtocols: string[]
	category: string | null
	metrics: IProtocolPageMetrics
	warningBanners: IProtocolOverviewPageData['warningBanners']
	toggleOptions: Array<{ name: string; key: string }>
	tokenRightsData: ITokenRightsData
	raises: IProtocolRaise[] | null
	seoTitle: string
	seoDescription: string
}

export const getStaticProps = withPerformanceLogging(
	'protocol/token-rights/[protocol]',
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
			hasMetric: (metadata) => Boolean(metadata.tokenRights),
			metadataCache,
			protocol,
			routePrefix: 'protocol/token-rights'
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(protocolRoute.destination)
		}
		const metadata = protocolRoute.route.metadata
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const defillamaId = protocolRoute.route.id
		const { fetchTokenRightsEntryByDefillamaId } = await import('~/containers/TokenRights/server/dataset.server')
		const [rawEntry, protocolData] = await Promise.all([
			fetchTokenRightsEntryByDefillamaId(defillamaId),
			fetchProtocolOverviewMetrics(canonicalProtocol)
		])

		if (!rawEntry) {
			return { notFound: true }
		}

		const tokenRightsData = parseTokenRightsEntry(rawEntry)
		const raises = protocolData?.raises ? protocolData.raises.toSorted((a, b) => b.date - a.date) : null
		const tokenlistSymbol = protocolData?.gecko_id
			? metadataCache.tokenlist[protocolData.gecko_id]?.symbol?.toUpperCase()
			: undefined
		const symbol = tokenlistSymbol ?? (protocolData?.symbol && protocolData.symbol !== '-' ? protocolData.symbol : null)

		const computedMetrics = protocolData ? getProtocolMetricFlags({ protocolData, metadata }) : null
		const name = protocolData?.name ?? rawEntry['Protocol Name']
		const seoTitle = `${name}${symbol ? ` (${symbol})` : ''} Token Rights & Governance`
		const seoDescription = `Explore ${name}${symbol ? ` (${symbol})` : ''} token rights, holder benefits, governance power, and revenue distribution on DefiLlama.`
		const metrics: IProtocolPageMetrics = {
			...(computedMetrics ?? {
				tvl: false,
				dexs: false,
				dexsNotionalVolume: false,
				perps: false,
				openInterest: false,
				optionsPremiumVolume: false,
				optionsNotionalVolume: false,
				dexAggregators: false,
				perpsAggregators: false,
				bridgeAggregators: false,
				stablecoins: false,
				bridge: false,
				treasury: false,
				unlocks: false,
				incentives: false,
				yields: false,
				fees: false,
				revenue: false,
				forks: false,
				governance: false,
				nfts: false,
				dev: false,
				inflows: false,
				liquidity: false,
				activeUsers: false,
				newUsers: false,
				txCount: false,
				gasUsed: false,
				liquidationVolume: false,
				collateralLiquidated: false,
				borrowed: false,
				tokenRights: false
			}),
			tokenRights: true
		}

		const props: TokenRightsPageProps = {
			name,
			symbol,
			parentProtocol: protocolData?.parentProtocol ?? null,
			otherProtocols: protocolData?.otherProtocols ?? EMPTY_OTHER_PROTOCOLS,
			category: protocolData?.category ?? null,
			metrics,
			warningBanners: protocolData ? getProtocolWarningBanners(protocolData) : [],
			toggleOptions: [],
			tokenRightsData,
			raises,
			seoTitle,
			seoDescription
		}

		return { props, revalidate: maxAgeForNext([22]) }
	}
)

export const getStaticPaths = () => {
	if (SKIP_BUILD_STATIC_GENERATION) {
		return {
			paths: [],
			fallback: 'blocking'
		}
	}

	return { paths: [], fallback: 'blocking' }
}

export default function ProtocolTokenRightsPage(props: TokenRightsPageProps) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category ?? ''}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="tokenRights"
			warningBanners={props.warningBanners}
			toggleOptions={props.toggleOptions}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<TokenRightsByProtocol
				name={props.name}
				symbol={props.symbol}
				tokenRightsData={props.tokenRightsData}
				raises={props.raises}
			/>
		</ProtocolOverviewLayout>
	)
}
