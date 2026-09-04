export const RESEARCH_NEWSLETTER_ARCHIVE_URL = 'https://defillama-research.beehiiv.com/'

export type ResearchNewsletterItem = {
	id: string
	title: string
	description: string | null
	href: string
	imageUrl: string | null
	publishedAt: string | null
}

export type ResearchNewsletterListResponse = {
	items: ResearchNewsletterItem[]
	totalItems: number
}

type FetchLike = (url: string, options?: RequestInit) => Promise<Response>

export async function listResearchNewsletterItems(
	params: { query?: string; limit?: number } = {},
	fetchFn: FetchLike = fetch
): Promise<ResearchNewsletterListResponse> {
	const search = new URLSearchParams()
	if (params.query) search.set('query', params.query)
	if (params.limit !== undefined) search.set('limit', String(params.limit))

	const response = await fetchFn(`/api/public/research/newsletters?${search}`)
	if (!response.ok) {
		throw new Error(response.statusText || 'Newsletter search request failed')
	}

	return response.json()
}
