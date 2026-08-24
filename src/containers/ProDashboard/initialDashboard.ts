import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { CustomTimePeriod, Dashboard, TimePeriod } from './dashboardTypes'
import { toPersistedDashboardItems } from './utils/dashboardUtils'

const initialRenderDashboards = new WeakSet<Dashboard>()

type InitialDashboardData = {
	items: DashboardItemConfig[]
	dashboardName: string
	timePeriod?: TimePeriod
	customTimePeriod?: CustomTimePeriod | null
}

export interface DashboardInitialRenderPayload {
	id: string
	slug?: string
	ownerId?: string
	data: InitialDashboardData
	visibility: 'private' | 'public'
	tags?: string[]
	description?: string
	viewCount?: number
	likeCount?: number
	author?: PublicDashboardAuthor
	created: string
	updated: string
	editedAt?: string
}

export type PublicDashboardInitialRenderPayload = Omit<
	DashboardInitialRenderPayload,
	'visibility' | 'ownerId' | 'tags' | 'description'
> & {
	visibility: 'public'
	tags: string[]
	description: string
}

function initialRenderItems(items: DashboardItemConfig[]): DashboardItemConfig[] {
	return toPersistedDashboardItems(items).map((item) => {
		if (item.kind !== 'llamaai-chart' || !item.inlineChartData) return item
		const { inlineChartData: _inlineChartData, ...config } = item
		return config
	})
}

function initialDashboardData(dashboard: Dashboard): InitialDashboardData {
	return {
		items: initialRenderItems(dashboard.data.items),
		dashboardName: dashboard.data.dashboardName,
		...(dashboard.data.timePeriod ? { timePeriod: dashboard.data.timePeriod } : {}),
		...(dashboard.data.customTimePeriod !== undefined ? { customTimePeriod: dashboard.data.customTimePeriod } : {})
	}
}

function publicFields(dashboard: Dashboard) {
	return {
		id: dashboard.id,
		...(dashboard.slug ? { slug: dashboard.slug } : {}),
		tags: dashboard.tags ?? [],
		description: dashboard.description ?? '',
		...(dashboard.viewCount !== undefined ? { viewCount: dashboard.viewCount } : {}),
		...(dashboard.likeCount !== undefined ? { likeCount: dashboard.likeCount } : {}),
		...(dashboard.author ? { author: dashboard.author } : {}),
		created: dashboard.created,
		updated: dashboard.updated,
		...(dashboard.editedAt ? { editedAt: dashboard.editedAt } : {})
	}
}

export function toPublicDashboardInitialRenderPayload(dashboard: Dashboard): PublicDashboardInitialRenderPayload {
	return {
		...publicFields(dashboard),
		data: initialDashboardData(dashboard),
		visibility: 'public'
	}
}

export function toPublicDashboardResponse(dashboard: Dashboard): Dashboard {
	const {
		user: _user,
		aiGenerated: _aiGenerated,
		collectionId: _collectionId,
		collectionName: _collectionName,
		data: { aiUndoState: _aiUndoState, ...publicData },
		...publicDashboard
	} = dashboard
	return { ...publicDashboard, data: publicData }
}

export function toOwnerDashboardInitialRenderPayload(dashboard: Dashboard): DashboardInitialRenderPayload {
	return {
		...publicFields(dashboard),
		...(dashboard.user !== undefined ? { ownerId: dashboard.user } : {}),
		data: initialDashboardData(dashboard),
		visibility: dashboard.visibility ?? 'private'
	}
}

export function hydrateDashboardInitialRenderPayload(payload: DashboardInitialRenderPayload): Dashboard {
	const dashboard: Dashboard = {
		id: payload.id,
		...(payload.slug ? { slug: payload.slug } : {}),
		user: payload.ownerId ?? '',
		data: payload.data,
		visibility: payload.visibility,
		...(payload.tags !== undefined ? { tags: payload.tags } : {}),
		...(payload.description !== undefined ? { description: payload.description } : {}),
		...(payload.viewCount !== undefined ? { viewCount: payload.viewCount } : {}),
		...(payload.likeCount !== undefined ? { likeCount: payload.likeCount } : {}),
		...(payload.author !== undefined ? { author: payload.author } : {}),
		created: payload.created,
		updated: payload.updated,
		...(payload.editedAt !== undefined ? { editedAt: payload.editedAt } : {})
	}
	initialRenderDashboards.add(dashboard)
	return dashboard
}

export function isDashboardInitialRenderHydration(dashboard: Dashboard): boolean {
	return initialRenderDashboards.has(dashboard)
}
