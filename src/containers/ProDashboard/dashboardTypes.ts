import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import type { DashboardItemConfig } from './dashboardItemConfig'

export type TimePeriod = '30d' | '90d' | '365d' | 'ytd' | '3y' | 'all' | 'custom'

export interface CustomTimePeriod {
	type: 'relative' | 'absolute'
	relativeDays?: number
	startDate?: number
	endDate?: number
}

export interface AISessionData {
	rating?: number
	feedback?: string
	mode: 'create' | 'iterate'
	timestamp: string
	userId: string
	rated: boolean
	skipped?: boolean
	prompt: string
}

export type AIGeneratedData = Record<string, AISessionData>

export interface AIUndoState {
	items: Array<DashboardItemConfig>
	timestamp: string
	sessionId: string
}

export type DashboardMode = 'view' | 'edit'

export interface Dashboard {
	id: string
	slug?: string
	user?: string
	data: {
		items: Array<DashboardItemConfig>
		dashboardName: string
		timePeriod?: TimePeriod
		customTimePeriod?: CustomTimePeriod | null
		aiUndoState?: AIUndoState
	}
	visibility?: 'private' | 'public'
	tags?: Array<string>
	description?: string
	viewCount?: number
	likeCount?: number
	liked?: boolean
	author?: PublicDashboardAuthor
	created: string
	updated: string
	editedAt?: string
	collectionId?: string
	collectionName?: string
	aiGenerated?: AIGeneratedData | null
	artifactActivationPending?: boolean
}
