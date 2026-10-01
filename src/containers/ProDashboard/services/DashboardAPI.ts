import type { useAuthContext } from '~/auth'
import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import { FEATURES_SERVER } from '../../../constants'
import { migrateDashboardConfig } from '../dashboardConfig/migrate'
import type { PersistedDashboard } from '../dashboardConfig/persisted'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import type {
	AIGeneratedData,
	AIUndoState,
	CustomTimePeriod,
	Dashboard,
	DashboardAnnotation,
	DashboardVariable,
	TimePeriod
} from '../dashboardTypes'

export interface FollowingShelf {
	author: PublicDashboardAuthor
	dashboardCount: number
	lastUpdated: string | null
	dashboards: Array<Dashboard>
}

type PersistedFollowingShelf = Omit<FollowingShelf, 'dashboards'> & { dashboards: Array<PersistedDashboard> }

interface DashboardPage<T> {
	items: Array<T>
	page: number
	perPage: number
	totalItems: number
	totalPages: number
}

interface DashboardSearchParams {
	query: string
	tags: Array<string>
	visibility: 'public' | 'private'
	sortBy: 'popular' | 'recent' | 'likes' | 'trending'
	timeFrame: '1d' | '7d' | '30d' | 'all'
	page: number
	limit: number
}

function migrateDashboardPage(page: DashboardPage<PersistedDashboard>): DashboardPage<Dashboard> {
	return { ...page, items: page.items.map(migrateDashboardConfig) }
}

export interface LiteDashboardSummary {
	id: string
	name: string
	slug?: string
}

export type DashboardAuthorizedFetch = ReturnType<typeof useAuthContext>['authorizedFetch']

export function dashboardUrlKey(dashboard: { id: string; slug?: string }): string {
	return dashboard.slug || dashboard.id
}

export function matchesDashboardKey(
	dashboard: { id: string; slug?: string } | null | undefined,
	key: string | null | undefined
): boolean {
	return !!dashboard && !!key && (dashboard.id === key || dashboard.slug === key)
}

export class DashboardError extends Error {
	status: number

	constructor(message: string, status: number) {
		super(message)
		this.name = 'DashboardError'
		this.status = status
		Object.setPrototypeOf(this, DashboardError.prototype)
	}
}

async function requireAuthorizedResponse(
	authorizedFetch: DashboardAuthorizedFetch,
	url: string,
	options?: Parameters<DashboardAuthorizedFetch>[1]
): Promise<Response> {
	const response = options === undefined ? await authorizedFetch(url) : await authorizedFetch(url, options)
	if (response === null) throw new DashboardError('Authentication required', 401)
	return response
}

export type DashboardSavePayload = {
	items: Array<DashboardItemConfig>
	dashboardName: string
	timePeriod?: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
	variables?: Array<DashboardVariable>
	annotations?: Array<DashboardAnnotation>
	aiUndoState?: AIUndoState | null
	visibility?: 'private' | 'public'
	tags?: Array<string>
	description?: string
	aiGenerated?: AIGeneratedData | null
	copySourceDashboardId?: string
	/** Create inside the caller's team. Ignored on update; moves go through `moveDashboardTeam`. */
	teamId?: string
}

function dashboardSaveBody(data: DashboardSavePayload, baseEditedAt?: string) {
	const { visibility, tags, description, aiGenerated, copySourceDashboardId, teamId, ...dashboardData } = data
	return {
		data: dashboardData,
		visibility: visibility || 'private',
		tags: Array.isArray(tags) ? tags : [],
		description: typeof description === 'string' ? description : '',
		aiGenerated: aiGenerated || null,
		...(copySourceDashboardId && { copySourceDashboardId }),
		...(teamId && { teamId }),
		...(baseEditedAt && { baseEditedAt })
	}
}

function dashboardSaveUrl(id?: string) {
	return id ? `/api/private/pro-dashboard/save?id=${encodeURIComponent(id)}` : `/api/private/pro-dashboard/save`
}

export function buildDashboardSaveRequest(params: { id?: string; data: DashboardSavePayload; baseEditedAt?: string }) {
	return {
		url: dashboardSaveUrl(params.id),
		options: {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(dashboardSaveBody(params.data, params.baseEditedAt))
		}
	}
}

// Fetch limits outstanding keepalive request bodies to 64 KiB. Larger/concurrent
// saves still use normal fetch instead of failing solely because of that quota.
let dashboardKeepaliveBytes = 0

class DashboardAPIService {
	private async handleResponse<T>(response: Response): Promise<T> {
		if (!response.ok) {
			let message = response.statusText || 'An error occurred'

			try {
				const errorData: { message?: string; error?: string } = await response.json()
				message = errorData.message || errorData.error || message
			} catch {
				// A non-JSON error body keeps the default message.
			}

			throw new DashboardError(message, response.status)
		}

		return response.json()
	}

	async listLiteDashboards(authorizedFetch: DashboardAuthorizedFetch): Promise<Array<LiteDashboardSummary>> {
		const response = await requireAuthorizedResponse(
			authorizedFetch,
			`${FEATURES_SERVER}/lite/dashboards?_=${Date.now()}`
		)
		const data = await this.handleResponse<{ items: Array<LiteDashboardSummary> }>(response)
		return data.items
	}

	async listDashboardsPaginated(
		params: { page?: number; limit?: number; scope?: 'personal' | 'team' },
		authorizedFetch: DashboardAuthorizedFetch
	): Promise<{ items: Array<Dashboard>; page: number; perPage: number; totalItems: number; totalPages: number }> {
		const searchParams = new URLSearchParams()
		if (params.page) searchParams.append('page', params.page.toString())
		if (params.limit) searchParams.append('limit', params.limit.toString())
		if (params.scope === 'team') searchParams.append('scope', 'team')
		searchParams.append('_', Date.now().toString())

		const response = await requireAuthorizedResponse(
			authorizedFetch,
			`${FEATURES_SERVER}/dashboards?${searchParams.toString()}`
		)
		return migrateDashboardPage(await this.handleResponse<DashboardPage<PersistedDashboard>>(response))
	}

	async getDashboard(id: string, authorizedFetch?: DashboardAuthorizedFetch): Promise<Dashboard> {
		const url = `${FEATURES_SERVER}/dashboards/${encodeURIComponent(id)}?_=${Date.now()}`
		const response = authorizedFetch ? await requireAuthorizedResponse(authorizedFetch, url) : await fetch(url)
		return migrateDashboardConfig(await this.handleResponse<PersistedDashboard>(response))
	}

	async createDashboard(data: DashboardSavePayload, authorizedFetch: DashboardAuthorizedFetch): Promise<Dashboard> {
		const { url, options } = buildDashboardSaveRequest({ data })
		const response = await requireAuthorizedResponse(authorizedFetch, url, options)

		return migrateDashboardConfig(await this.handleResponse<PersistedDashboard>(response))
	}

	async updateDashboard(
		id: string,
		data: DashboardSavePayload,
		authorizedFetch: DashboardAuthorizedFetch,
		baseEditedAt?: string
	): Promise<Dashboard> {
		const { url, options } = buildDashboardSaveRequest({ id, data, baseEditedAt })
		const bytes = new TextEncoder().encode(options.body).byteLength
		const keepalive = dashboardKeepaliveBytes + bytes <= 65_536
		if (keepalive) dashboardKeepaliveBytes += bytes
		try {
			const response = await requireAuthorizedResponse(authorizedFetch, url, { ...options, keepalive })
			return migrateDashboardConfig(await this.handleResponse<PersistedDashboard>(response))
		} finally {
			if (keepalive) dashboardKeepaliveBytes -= bytes
		}
	}

	async moveDashboardTeam(
		id: string,
		teamId: string | null,
		authorizedFetch: DashboardAuthorizedFetch
	): Promise<Dashboard> {
		const response = await requireAuthorizedResponse(
			authorizedFetch,
			`${FEATURES_SERVER}/dashboards/${encodeURIComponent(id)}/team`,
			{ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId }) }
		)
		return migrateDashboardConfig(await this.handleResponse<PersistedDashboard>(response))
	}

	async deleteDashboard(id: string, authorizedFetch: DashboardAuthorizedFetch): Promise<{ message: string }> {
		const response = await requireAuthorizedResponse(
			authorizedFetch,
			`/api/private/pro-dashboard/delete?id=${encodeURIComponent(id)}`,
			{ method: 'POST' }
		)

		return this.handleResponse<{ message: string }>(response)
	}

	async discoverDashboards(
		params?: { page?: number; limit?: number },
		authorizedFetch?: DashboardAuthorizedFetch
	): Promise<{ items: Array<Dashboard>; page: number; perPage: number; totalItems: number; totalPages: number }> {
		const queryParams = new URLSearchParams()
		if (params?.page) queryParams.append('page', params.page.toString())
		if (params?.limit) queryParams.append('limit', params.limit.toString())

		const url = `${FEATURES_SERVER}/dashboards/discover?${queryParams.toString()}`
		const response = authorizedFetch ? await requireAuthorizedResponse(authorizedFetch, url) : await fetch(url)
		return migrateDashboardPage(await this.handleResponse<DashboardPage<PersistedDashboard>>(response))
	}

	async searchDashboards(
		params: {
			query?: string
			tags?: Array<string>
			visibility?: 'public' | 'private'
			sortBy?: 'popular' | 'recent' | 'likes' | 'trending'
			timeFrame?: '1d' | '7d' | '30d'
			page?: number
			limit?: number
		},
		authorizedFetch?: DashboardAuthorizedFetch
	): Promise<{
		items: Array<Dashboard>
		page: number
		perPage: number
		totalItems: number
		totalPages: number
		searchParams: DashboardSearchParams
	}> {
		const queryParams = new URLSearchParams()
		if (params.query) queryParams.append('query', params.query)
		if (params.tags?.length) queryParams.append('tags', params.tags.join(','))
		if (params.visibility) queryParams.append('visibility', params.visibility)
		if (params.sortBy) queryParams.append('sortBy', params.sortBy)
		if (params.timeFrame) queryParams.append('timeFrame', params.timeFrame)
		if (params.page) queryParams.append('page', params.page.toString())
		if (params.limit) queryParams.append('limit', params.limit.toString())

		const url = `${FEATURES_SERVER}/dashboards/search?${queryParams.toString()}`
		const response = authorizedFetch ? await requireAuthorizedResponse(authorizedFetch, url) : await fetch(url)
		const result = await this.handleResponse<
			DashboardPage<PersistedDashboard> & { searchParams: DashboardSearchParams }
		>(response)
		return { ...migrateDashboardPage(result), searchParams: result.searchParams }
	}

	async viewDashboard(id: string, authorizedFetch?: DashboardAuthorizedFetch): Promise<Dashboard> {
		const url = `${FEATURES_SERVER}/dashboards/${encodeURIComponent(id)}/view`
		const response = authorizedFetch ? await requireAuthorizedResponse(authorizedFetch, url) : await fetch(url)
		return migrateDashboardConfig(await this.handleResponse<PersistedDashboard>(response))
	}

	async likeDashboard(
		id: string,
		authorizedFetch: DashboardAuthorizedFetch
	): Promise<{ liked: boolean; likeCount: number }> {
		const response = await requireAuthorizedResponse(
			authorizedFetch,
			`${FEATURES_SERVER}/dashboards/${encodeURIComponent(id)}/like`,
			{ method: 'POST' }
		)
		return this.handleResponse<{ liked: boolean; likeCount: number }>(response)
	}

	async getLikedDashboards(
		params: {
			page?: number
			limit?: number
		},
		authorizedFetch: DashboardAuthorizedFetch
	): Promise<{
		items: Array<Dashboard>
		page: number
		perPage: number
		totalItems: number
		totalPages: number
	}> {
		const searchParams = new URLSearchParams()
		if (params.page) searchParams.append('page', params.page.toString())
		if (params.limit) searchParams.append('limit', params.limit.toString())

		const response = await requireAuthorizedResponse(
			authorizedFetch,
			`${FEATURES_SERVER}/dashboards/liked?${searchParams}`
		)
		return migrateDashboardPage(await this.handleResponse<DashboardPage<PersistedDashboard>>(response))
	}

	async getFollowingAuthors(
		params: {
			page?: number
			limit?: number
		},
		authorizedFetch: DashboardAuthorizedFetch
	): Promise<{
		items: Array<FollowingShelf>
		page: number
		perPage: number
		totalItems: number
		totalPages: number
	}> {
		const searchParams = new URLSearchParams()
		if (params.page) searchParams.append('page', params.page.toString())
		if (params.limit) searchParams.append('limit', params.limit.toString())

		const response = await requireAuthorizedResponse(
			authorizedFetch,
			`${FEATURES_SERVER}/authors/following?${searchParams}`
		)
		const result = await this.handleResponse<DashboardPage<PersistedFollowingShelf>>(response)
		return {
			...result,
			items: result.items.map((shelf) => ({
				...shelf,
				dashboards: shelf.dashboards.map(migrateDashboardConfig)
			}))
		}
	}
}

export const dashboardAPI = new DashboardAPIService()
