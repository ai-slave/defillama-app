import type { GetStaticPropsContext } from 'next'
import { InvestorRelationsView } from '~/containers/Investors/InvestorRelationsView'
import { getMainSiteIrDashboard, MAIN_SITE_IR_PROTOCOL_SLUGS } from '~/containers/Investors/mainSiteDashboards'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { withPerformanceLogging } from '~/utils/perf'
import { canonicalRouteRedirect } from '~/utils/route'

interface InvestorRelationsPageProps {
	name: string
	otherProtocols: Array<string>
	category: string | null
	metrics: IProtocolPageMetrics
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	dashboardId: string
	customOnly: boolean
	entityName: string
	seoTitle: string
	seoDescription: string
}

export const getStaticProps = withPerformanceLogging(
	'protocol/investor-relations/[protocol]',
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
			hasMetric: (metadata) => MAIN_SITE_IR_PROTOCOL_SLUGS.includes(slug(metadata.displayName || metadata.name || '')),
			metadataCache,
			protocol,
			routePrefix: 'protocol/investor-relations'
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(protocolRoute.destination)
		}
		const metadata = protocolRoute.route.metadata
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const ir = getMainSiteIrDashboard('protocol', canonicalProtocol)
		if (!ir) {
			return { notFound: true }
		}

		const protocolData = await fetchProtocolOverviewMetrics(canonicalProtocol)
		if (!protocolData) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const seoTitle = `${protocolData.name} Investor Relations - DefiLlama`
		const seoDescription = `Verified investor relations metrics, reports, and analytics for ${protocolData.name}, powered by DefiLlama.`

		return {
			props: {
				name: protocolData.name,
				otherProtocols: protocolData?.otherProtocols ?? [],
				category: protocolData?.category ?? null,
				metrics,
				warningBanners: getProtocolWarningBanners(protocolData),
				dashboardId: ir.dashboardId,
				customOnly: ir.customOnly,
				entityName: ir.entityName,
				seoTitle,
				seoDescription
			},
			revalidate: maxAgeForNext([22])
		}
	}
)

export const getStaticPaths = () => {
	return { paths: [], fallback: 'blocking' }
}

export default function ProtocolInvestorRelations(props: InvestorRelationsPageProps) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="investorRelations"
			warningBanners={props.warningBanners}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<InvestorRelationsView
				dashboardId={props.dashboardId}
				customOnly={props.customOnly}
				entityName={props.entityName}
			/>
		</ProtocolOverviewLayout>
	)
}
