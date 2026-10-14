import { FEATURES_SERVER } from '~/constants'
import type { SitemapUrlEntry } from '~/utils/sitemapXml'

const PRO_DASHBOARD_SITEMAP_LIMIT = 1000
const PRO_DASHBOARD_SITEMAP_PAGE_SIZE = 100
const PRO_DASHBOARD_SITEMAP_FETCH_TIMEOUT_MS = 10_000

type ProDashboardSearchItem = {
	id?: string
	slug?: string
	editedAt?: string
	updated?: string
	created?: string
}

type ProDashboardSearchResponse = {
	items?: Array<ProDashboardSearchItem>
	totalPages?: number
}

async function fetchProDashboardSearchPage(params: URLSearchParams): Promise<ProDashboardSearchResponse> {
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), PRO_DASHBOARD_SITEMAP_FETCH_TIMEOUT_MS)

	try {
		const response = await fetch(`${FEATURES_SERVER}/dashboards/search?${params.toString()}`, {
			signal: controller.signal
		})

		if (!response.ok) {
			throw new Error(`features-server responded with ${response.status}`)
		}

		return (await response.json()) as ProDashboardSearchResponse
	} finally {
		clearTimeout(timeout)
	}
}

export async function getProDashboardSitemapEntries(): Promise<Array<SitemapUrlEntry>> {
	const entries: Array<SitemapUrlEntry> = []
	const seen = new Set<string>()
	const maxPages = Math.ceil(PRO_DASHBOARD_SITEMAP_LIMIT / PRO_DASHBOARD_SITEMAP_PAGE_SIZE)
	let page = 1

	try {
		while (page <= maxPages && entries.length < PRO_DASHBOARD_SITEMAP_LIMIT) {
			const params = new URLSearchParams({
				visibility: 'public',
				sortBy: 'popular',
				page: String(page),
				limit: String(PRO_DASHBOARD_SITEMAP_PAGE_SIZE)
			})
			const data = await fetchProDashboardSearchPage(params)
			const dashboards = Array.isArray(data.items) ? data.items : []

			for (const dashboard of dashboards) {
				// The view 301s /pro/{id} to /pro/{slug} when they differ. Listing the id is the
				// Search Console error on every URL in this file (the cap is 1,000).
				const pathId = dashboard.slug || dashboard.id
				if (!pathId || seen.has(pathId)) continue
				seen.add(pathId)
				entries.push({
					path: `pro/${pathId}`,
					lastmod: dashboard.editedAt || dashboard.updated || dashboard.created
				})
				if (entries.length >= PRO_DASHBOARD_SITEMAP_LIMIT) break
			}

			const totalPages = typeof data.totalPages === 'number' && data.totalPages > 0 ? data.totalPages : page
			if (page >= totalPages || dashboards.length === 0) break
			page += 1
		}
	} catch (error) {
		console.warn('[sitemap] failed to build pro dashboard entries', error)
	}

	return entries
}
