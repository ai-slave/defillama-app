import type { GetStaticPropsContext, GetStaticPropsResult } from 'next'
import { fetchProtocolOverviewMetrics } from '~/containers/ProtocolOverview/api'
import { getProtocolMetricFlags } from '~/containers/ProtocolOverview/queries'
import { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { canonicalRouteRedirect } from '~/utils/route'
import {
	getMainSiteIrDashboard,
	getMainSiteIrRoutePrefix,
	getMainSiteIrTabHref,
	MAIN_SITE_IR_PROTOCOL_SLUGS,
	resolveMainSiteIrTab,
	type MainSiteIrRoutePrefix
} from './mainSiteDashboards'
import type { ProtocolIrPageProps } from './mainSiteProtocolIrPage'
import { fetchCustomServerData } from './serverDataRegistry'

export function createProtocolIrStaticProps(routePrefix: MainSiteIrRoutePrefix) {
	return async ({
		params
	}: GetStaticPropsContext<{ route: Array<string> }>): Promise<GetStaticPropsResult<ProtocolIrPageProps>> => {
		const [protocol, tabSegment, ...extraSegments] = params?.route ?? []
		if (!protocol || extraSegments.length > 0) {
			return { notFound: true }
		}
		const [{ default: metadataCache }, { resolveProtocolFeatureRouteFromMetadata }] = await Promise.all([
			import('~/utils/metadata'),
			import('~/containers/ProtocolOverview/server/routes')
		])
		const protocolRoute = resolveProtocolFeatureRouteFromMetadata({
			hasMetric: (metadata) => MAIN_SITE_IR_PROTOCOL_SLUGS.includes(slug(metadata.displayName || metadata.name || '')),
			metadataCache,
			protocol,
			routePrefix: `protocol/${routePrefix}`
		})
		if (!protocolRoute) {
			return { notFound: true }
		}
		if (protocolRoute.type === 'redirect') {
			return canonicalRouteRedirect(
				tabSegment ? `${protocolRoute.destination}/${tabSegment}` : protocolRoute.destination
			)
		}
		const metadata = protocolRoute.route.metadata
		const canonicalProtocol = protocolRoute.route.canonicalSlug

		const ir = getMainSiteIrDashboard('protocol', canonicalProtocol)
		if (!ir) {
			return { notFound: true }
		}
		const tabResolution = resolveMainSiteIrTab(ir, tabSegment)
		if (tabResolution.type === 'not-found') {
			return { notFound: true }
		}
		if (tabResolution.type === 'redirect') {
			return canonicalRouteRedirect(tabResolution.destination)
		}
		if (getMainSiteIrRoutePrefix(ir) !== routePrefix) {
			return canonicalRouteRedirect(getMainSiteIrTabHref(ir, tabResolution.tabId ?? ''))
		}

		const [protocolData, customServerData] = await Promise.all([
			fetchProtocolOverviewMetrics(canonicalProtocol),
			fetchCustomServerData(ir.dashboardId)
		])
		if (!protocolData) {
			return { notFound: true, revalidate: maxAgeForNext([22]) }
		}

		const metrics = getProtocolMetricFlags({ protocolData, metadata })
		const activeTabLabel =
			ir.tabPlacement === 'menu' ? ir.menuTabs.find((tab) => tab.id === tabResolution.tabId)?.label : undefined
		const seoTitle = activeTabLabel
			? `${protocolData.name} ${activeTabLabel} - DefiLlama`
			: `${protocolData.name} Investor Relations - DefiLlama`
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
				irTab: tabResolution.tabId,
				llamaOnly: ir.llamaOnly === true,
				customServerData,
				seoTitle,
				seoDescription
			} satisfies ProtocolIrPageProps,
			revalidate: maxAgeForNext([22])
		}
	}
}

export const getProtocolIrStaticPaths = () => {
	return { paths: [], fallback: 'blocking' as const }
}
