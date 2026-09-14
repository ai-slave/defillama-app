import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Head from 'next/head'
import { useEffect, useMemo } from 'react'
import { ChartWatermarkContext } from '~/components/ECharts/shared/watermark'
import { CardHeightScaleContext } from '~/containers/ProDashboard/components/cardHeightContext'
import {
	ChartGrid,
	DashboardCardStreamScope,
	DashboardItemRenderer
} from '~/containers/ProDashboard/components/ChartGrid'
import { DashboardCardContext } from '~/containers/ProDashboard/components/DashboardCardContext'
import { EMBED_THEMES, type EmbedTheme } from '~/containers/ProDashboard/components/EmbedSnippetDialog'
import { ParameterUnavailableCard } from '~/containers/ProDashboard/components/ParameterUnavailableCard'
import {
	cardScaleStyle,
	getCardHeightScale,
	getDashboardItemHeight
} from '~/containers/ProDashboard/dashboardLayout/cardHeight'
import { dashboardItemElementId } from '~/containers/ProDashboard/hooks/useDashboardItemDeepLink'
import {
	hydrateDashboardInitialRenderPayload,
	type PublicDashboardInitialRenderPayload,
	toPublicDashboardInitialRenderPayload
} from '~/containers/ProDashboard/initialDashboard'
import {
	ProDashboardAPIProvider,
	useProDashboardItemsState,
	useProDashboardVariables
} from '~/containers/ProDashboard/ProDashboardAPIContext'
import { fetchDashboardConfigWithStatus } from '~/containers/ProDashboard/queries.server'
import { dashboardUrlKey } from '~/containers/ProDashboard/services/DashboardAPI'
import { Icon } from '~/ui/Icon'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const EMBED_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const DEFAULT_EMBED_THEME: EmbedTheme = 'dark'

type DashboardEmbedPageProps = {
	initialDashboard: PublicDashboardInitialRenderPayload
	itemId: string | null
	theme: EmbedTheme
}

function firstQueryValue(value: string | Array<string> | undefined): string | null {
	const single = Array.isArray(value) ? value[0] : value
	return typeof single === 'string' && single.length > 0 ? single : null
}

function parseEmbedTheme(value: string | null): EmbedTheme {
	return EMBED_THEMES.find((theme) => theme === value) ?? DEFAULT_EMBED_THEME
}

const getServerSidePropsHandler: GetServerSideProps<DashboardEmbedPageProps> = async (context) => {
	const dashboardId = context.params?.dashboardId as string
	const { dashboard } = await fetchDashboardConfigWithStatus(dashboardId, null)
	if (!dashboard || dashboard.visibility !== 'public') {
		return { notFound: true }
	}
	context.res.setHeader('Cache-Control', EMBED_CACHE_CONTROL)
	return {
		props: {
			initialDashboard: toPublicDashboardInitialRenderPayload(dashboard),
			itemId: firstQueryValue(context.query.item),
			theme: parseEmbedTheme(firstQueryValue(context.query.theme))
		}
	}
}

export const getServerSideProps = withServerSidePropsTelemetry('/pro/embed/[dashboardId]', getServerSidePropsHandler)

const noop = () => {}

export default function DashboardEmbedPage({
	initialDashboard,
	itemId,
	theme
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const dashboardKey = dashboardUrlKey(initialDashboard)
	const dashboard = useMemo(() => hydrateDashboardInitialRenderPayload(initialDashboard), [initialDashboard])
	const dashboardName = initialDashboard.data.dashboardName
	const dashboardHref = `/pro/${dashboardKey}`

	useEffect(() => {
		const root = document.documentElement
		root.classList.toggle('dark', theme === 'dark')
		root.classList.toggle('light', theme === 'light')
	}, [theme])

	return (
		<>
			<Head>
				<title>{`${dashboardName} - DefiLlama`}</title>
				<meta name="robots" content="noindex" />
			</Head>
			<div className="col-span-full flex min-h-dvh flex-col gap-2 p-2 text-pro-text-primary pro-dashboard">
				<header className="flex items-center justify-between gap-3 text-xs">
					<div className="flex min-w-0 items-center gap-2">
						<img
							src={theme === 'dark' ? '/assets/defillama.webp' : '/assets/defillama-dark.webp'}
							alt="DefiLlama"
							height={18}
							width={53}
							className="h-[18px] w-[53px] shrink-0 object-contain object-left"
						/>
						<span aria-hidden="true" className="text-pro-text-tertiary">
							/
						</span>
						<a
							href={dashboardHref}
							target="_blank"
							rel="noreferrer"
							className="truncate font-medium hover:text-link"
							data-umami-event="embed-open-dashboard"
						>
							{dashboardName}
						</a>
					</div>
					<a
						href={dashboardHref}
						target="_blank"
						rel="noreferrer"
						className="flex shrink-0 items-center gap-1 text-link hover:underline"
						data-umami-event="embed-open-dashboard"
					>
						Open on DefiLlama
						<Icon name="external-link" height={12} width={12} aria-hidden="true" />
					</a>
				</header>
				<ProDashboardAPIProvider
					mode="view"
					initialDashboardId={dashboardKey}
					initialDashboard={dashboard}
					{...(itemId === null ? {} : { streamItemId: itemId })}
					key={`dashboard-embed-provider-${dashboardKey}`}
				>
					{itemId === null ? (
						<ChartGrid onAddChartClick={noop} tabQueryParam="tab" />
					) : (
						<EmbeddedCard itemId={itemId} dashboardHref={dashboardHref} />
					)}
				</ProDashboardAPIProvider>
			</div>
		</>
	)
}

function EmbeddedCard({ itemId, dashboardHref }: { itemId: string; dashboardHref: string }) {
	const { items } = useProDashboardItemsState()
	const { resolvedItems, unavailableByItemId } = useProDashboardVariables()
	const cardContextValue = useMemo(() => ({ itemId }), [itemId])
	const rawItem = items.find((candidate) => candidate.id === itemId)
	const item = resolvedItems.find((candidate) => candidate.id === itemId) ?? rawItem

	if (!item || !rawItem || item.kind === 'section') {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-pro-cards-border bg-pro-cards-bg p-6 text-center">
				<p className="text-base font-semibold">Card not found</p>
				<p className="text-sm text-pro-text-secondary">This card is no longer part of the dashboard.</p>
				<a href={dashboardHref} target="_blank" rel="noreferrer" className="text-sm text-link hover:underline">
					Open the dashboard
				</a>
			</div>
		)
	}
	const cardHeightScale = getCardHeightScale(getDashboardItemHeight(rawItem))

	const unavailable = unavailableByItemId.get(itemId)
	return (
		<ChartWatermarkContext.Provider value="export-only">
			<div
				id={dashboardItemElementId(itemId)}
				data-item-id={itemId}
				style={cardScaleStyle(getDashboardItemHeight(rawItem))}
				className="flex flex-1 flex-col rounded-md border border-pro-cards-border bg-pro-cards-bg"
			>
				<DashboardCardContext.Provider value={cardContextValue}>
					<CardHeightScaleContext.Provider value={cardHeightScale}>
						<DashboardCardStreamScope streamPrefetchEligible itemId={itemId}>
							{unavailable ? (
								<ParameterUnavailableCard item={rawItem} unavailable={unavailable} />
							) : (
								<DashboardItemRenderer item={item} isEditable={false} />
							)}
						</DashboardCardStreamScope>
					</CardHeightScaleContext.Provider>
				</DashboardCardContext.Provider>
			</div>
		</ChartWatermarkContext.Provider>
	)
}
