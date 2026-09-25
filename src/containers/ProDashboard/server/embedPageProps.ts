import type { GetServerSideProps } from 'next'
import { EMBED_THEMES, type EmbedTheme } from '../components/EmbedSnippetDialog'
import { type PublicDashboardInitialRenderPayload, toPublicDashboardInitialRenderPayload } from '../initialDashboard'
import { fetchDashboardConfigWithStatus } from '../queries.server'

const EMBED_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=60'
const DEFAULT_EMBED_THEME: EmbedTheme = 'dark'

export type DashboardEmbedPageProps = {
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

export const getDashboardEmbedPageProps: GetServerSideProps<DashboardEmbedPageProps> = async (context) => {
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
