import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import type { DashboardItemConfig } from './types'

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

export type DashboardMode = 'view' | 'edit'

export interface Dashboard {
	id: string
	slug?: string
	user: string
	data: {
		items: DashboardItemConfig[]
		dashboardName: string
		timePeriod?: TimePeriod
		customTimePeriod?: CustomTimePeriod | null
		aiUndoState?: {
			items: DashboardItemConfig[]
			timestamp: string
			sessionId: string
		}
	}
	visibility?: 'private' | 'public'
	tags?: string[]
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
}
