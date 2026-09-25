import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import { countDashboardWidgets } from '~/containers/ProDashboard/dashboardWidgets'
import { summarizeDashboardItems } from '~/containers/ProDashboard/utils/seo'
import { formatDate } from '~/utils/dateFormat'
import type { DashboardOgCardChart, DashboardOgCardProps } from './card'

const OG_IMAGE_SUMMARY_LINE_COUNT = 3
const DEFAULT_DASHBOARD_NAME = 'Untitled Dashboard'

function buildMetaLine(dashboard: Dashboard): string {
	const cardCount = countDashboardWidgets(dashboard.data?.items ?? [])
	const cards = `${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`
	const updated = formatDate(dashboard.editedAt || dashboard.updated) ?? ''
	return updated ? `${cards} · updated ${updated}` : cards
}

export function buildDashboardOgCardProps(
	dashboard: Dashboard,
	size: { width: number; height: number },
	charts: Array<DashboardOgCardChart>
): DashboardOgCardProps {
	return {
		width: size.width,
		height: size.height,
		title: dashboard.data?.dashboardName || DEFAULT_DASHBOARD_NAME,
		authorName: dashboard.author?.displayName || null,
		metaLine: buildMetaLine(dashboard),
		charts,
		summaryLines: summarizeDashboardItems(dashboard.data?.items ?? [])
			.slice(0, OG_IMAGE_SUMMARY_LINE_COUNT)
			.map((summary) => summary.label)
			.filter(Boolean)
	}
}
