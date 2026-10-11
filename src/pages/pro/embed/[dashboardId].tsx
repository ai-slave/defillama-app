import type { InferGetServerSidePropsType } from 'next'
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
import { ParameterUnavailableCard } from '~/containers/ProDashboard/components/ParameterUnavailableCard'
import {
	cardScaleStyle,
	getCardHeightScale,
	getDashboardItemHeight
} from '~/containers/ProDashboard/dashboardLayout/cardHeight'
import { dashboardItemElementId } from '~/containers/ProDashboard/hooks/useDashboardItemDeepLink'
import { hydrateDashboardInitialRenderPayload } from '~/containers/ProDashboard/initialDashboard'
import {
	ProDashboardAPIProvider,
	useProDashboardItemsState,
	useProDashboardVariables
} from '~/containers/ProDashboard/ProDashboardAPIContext'
import { getDashboardEmbedPageProps } from '~/containers/ProDashboard/server/embedPageProps'
import { dashboardUrlKey } from '~/containers/ProDashboard/services/DashboardAPI'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { EmptyState } from '~/ui/Status'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

export const getServerSideProps = withServerSidePropsTelemetry('/pro/embed/[dashboardId]', getDashboardEmbedPageProps)

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
			<div className="col-span-full flex min-h-dvh flex-col gap-2 p-2 text-primary">
				<header className="flex items-center justify-between gap-3 body-sm">
					<div className="flex min-w-0 items-center gap-2">
						<img
							src={theme === 'dark' ? '/assets/defillama.webp' : '/assets/defillama-dark.webp'}
							alt="DefiLlama"
							height={18}
							width={53}
							className="h-[18px] w-[53px] shrink-0 object-contain object-left"
						/>
						<span aria-hidden="true" className="text-tertiary">
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
						<Icon name="external-link" className="size-3" aria-hidden="true" />
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
			<EmptyState
				size="md"
				title="Card not found"
				framed
				actions={
					<Button as="a" href={dashboardHref} target="_blank" rel="noreferrer" size="sm">
						Open the dashboard
					</Button>
				}
			>
				This card is no longer part of the dashboard.
			</EmptyState>
		)
	}
	const cardHeightScale = getCardHeightScale(getDashboardItemHeight(rawItem))

	const unavailable = unavailableByItemId.get(itemId)
	return (
		<ChartWatermarkContext.Provider value="export-only">
			<Card
				id={dashboardItemElementId(itemId)}
				data-item-id={itemId}
				// A card control that leaves while it has focus, such as a retry that succeeds, hands focus to its card.
				tabIndex={-1}
				style={cardScaleStyle(getDashboardItemHeight(rawItem))}
				padding="none"
				className="flex flex-1 flex-col"
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
			</Card>
		</ChartWatermarkContext.Provider>
	)
}
