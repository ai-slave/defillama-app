import { FEATURES_SERVER } from '~/constants'
import { HttpError } from '~/utils/async'
import type {
	AuthorDashboardSort,
	AuthorPageResponse,
	AuthorProfileUpdate,
	PublicDashboardAuthor,
	TopAuthorEntry
} from './types'

type AuthorizedFetch = (url: string, options?: RequestInit) => Promise<Response | null>
type FetchLike = (url: string, options?: RequestInit) => Promise<Response | null>

export class AuthorApiError extends HttpError {
	constructor(message: string, status: number, reason: string | null) {
		super(message, status, reason)
		this.name = 'AuthorApiError'
	}
}

async function parseResponse<T>(response: Response | null): Promise<T> {
	if (!response) throw new AuthorApiError('Sign in to continue.', 401, 'Sign in to continue.')
	const text = await response.text()
	const data = text ? JSON.parse(text) : null
	if (!response.ok) {
		const reason = data && typeof data === 'object' && typeof data.error === 'string' ? data.error : null
		throw new AuthorApiError(reason ?? `Author request returned ${response.status}`, response.status, reason)
	}
	return data as T
}

export async function getAuthorBySlug(
	slug: string,
	params: { dashboardPage?: number; dashboardLimit?: number; dashboardSort?: AuthorDashboardSort } = {},
	fetcher: FetchLike = fetch
): Promise<AuthorPageResponse> {
	const searchParams = new URLSearchParams()
	if (params.dashboardPage) searchParams.set('dashboardPage', String(params.dashboardPage))
	if (params.dashboardLimit) searchParams.set('dashboardLimit', String(params.dashboardLimit))
	if (params.dashboardSort) searchParams.set('dashboardSort', params.dashboardSort)
	const qs = searchParams.toString()
	const response = await fetcher(`${FEATURES_SERVER}/authors/${encodeURIComponent(slug)}${qs ? `?${qs}` : ''}`)
	return parseResponse<AuthorPageResponse>(response)
}

// Prefix of every top-authors query; each `limit` gets its own entry under it.
export const TOP_AUTHORS_QUERY_KEY = ['pro-dashboard', 'top-authors'] as const

export async function getTopAuthors(limit?: number, fetcher: FetchLike = fetch): Promise<Array<TopAuthorEntry>> {
	const qs = limit ? `?limit=${limit}` : ''
	const response = await fetcher(`${FEATURES_SERVER}/authors/top${qs}`)
	const data = await parseResponse<{ items: Array<TopAuthorEntry> }>(response)
	return Array.isArray(data.items) ? data.items : []
}

export async function followAuthor(
	slug: string,
	authorizedFetch: AuthorizedFetch
): Promise<{ following: boolean; followerCount: number }> {
	const response = await authorizedFetch(`${FEATURES_SERVER}/authors/${encodeURIComponent(slug)}/follow`, {
		method: 'POST'
	})
	return parseResponse<{ following: boolean; followerCount: number }>(response)
}

export async function getMyDashboardAuthorProfile(authorizedFetch: AuthorizedFetch): Promise<PublicDashboardAuthor> {
	const response = await authorizedFetch(`${FEATURES_SERVER}/authors/me`)
	const data = await parseResponse<{ author: PublicDashboardAuthor }>(response)
	return data.author
}

export async function updateMyDashboardAuthorProfile(
	payload: AuthorProfileUpdate,
	authorizedFetch: AuthorizedFetch
): Promise<PublicDashboardAuthor> {
	const response = await authorizedFetch(`${FEATURES_SERVER}/authors/me`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	})
	const data = await parseResponse<{ author: PublicDashboardAuthor }>(response)
	return data.author
}
