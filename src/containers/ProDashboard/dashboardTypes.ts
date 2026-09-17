import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import type { DashboardPreviewTile } from './components/dashboardPreview.utils'
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

export type DashboardVariableKind = 'chain' | 'protocol'

export interface DashboardVariable {
	id: string
	kind: DashboardVariableKind
	label: string
	value: string
}

export interface DashboardAnnotation {
	id: string
	date: string
	label: string
}

export const MAX_DASHBOARD_VARIABLES = 4
export const MAX_DASHBOARD_ANNOTATIONS = 50
export const DASHBOARD_VARIABLE_LABEL_MAX_LENGTH = 40
export const DASHBOARD_ANNOTATION_LABEL_MAX_LENGTH = 80

export interface DashboardCopySource {
	id: string
	slug?: string
	name: string
}

export type DashboardRole = 'owner' | 'admin' | 'member' | 'viewer' | 'none'

/** Server-resolved permissions for the authenticated viewer. Absent on public responses. */
export interface DashboardAccess {
	role: DashboardRole
	canEdit: boolean
	canDelete: boolean
	canMove: boolean
}

export interface DashboardTeam {
	id: string
	name: string
}

export interface Dashboard {
	copiedFrom?: DashboardCopySource
	id: string
	slug?: string
	user?: string
	team?: DashboardTeam | null
	access?: DashboardAccess
	editedBy?: PublicDashboardAuthor | null
	data: {
		items: Array<DashboardItemConfig>
		dashboardName: string
		timePeriod?: TimePeriod
		customTimePeriod?: CustomTimePeriod | null
		variables?: Array<DashboardVariable>
		annotations?: Array<DashboardAnnotation>
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
	preview?: Array<DashboardPreviewTile>
}

export type DashboardRatingDecision = { rating: number; feedback?: string } | { skipped: true }

export const DASHBOARD_NAME_MAX_LENGTH = 80
export const DASHBOARD_DESCRIPTION_MAX_LENGTH = 200
