import { replaceEqualDeep } from '@tanstack/react-query'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { CustomTimePeriod, Dashboard, DashboardAnnotation, DashboardVariable, TimePeriod } from './dashboardTypes'
import { mergeDashboardItems } from './utils/dashboardUtils'

export interface DashboardHistoryEntry {
	items: Array<DashboardItemConfig>
	variables: Array<DashboardVariable>
}

export interface DashboardHistory {
	past: Array<DashboardHistoryEntry>
	future: Array<DashboardHistoryEntry>
}

export const DASHBOARD_HISTORY_LIMIT = 50

export interface DashboardState {
	items: Array<DashboardItemConfig>
	timePeriod: TimePeriod
	customTimePeriod: CustomTimePeriod | null
	variables: Array<DashboardVariable>
	annotations: Array<DashboardAnnotation>
	history: DashboardHistory
	dashboardName: string
	dashboardId: string | null
	currentDashboard: Dashboard | null
	dashboardVisibility: 'private' | 'public'
	dashboardTags: Array<string>
	dashboardDescription: string
	showGenerateDashboardModal: boolean
	showIterateDashboardModal: boolean
}

export type DashboardSaveBaseline = Omit<
	DashboardState,
	'currentDashboard' | 'showGenerateDashboardModal' | 'showIterateDashboardModal' | 'history'
>

export type DashboardAction =
	| {
			type: 'SET_ITEMS'
			payload: Array<DashboardItemConfig>
			variables?: Array<DashboardVariable>
			skipHistory?: boolean
	  }
	| { type: 'SET_VARIABLES'; payload: Array<DashboardVariable>; skipHistory?: boolean }
	| { type: 'SET_ANNOTATIONS'; payload: Array<DashboardAnnotation> }
	| { type: 'UNDO' }
	| { type: 'REDO' }
	| { type: 'CLEAR_HISTORY' }
	| { type: 'SET_TIME_PERIOD'; payload: TimePeriod }
	| { type: 'SET_CUSTOM_TIME_PERIOD'; payload: CustomTimePeriod | null }
	| { type: 'SET_DASHBOARD_NAME'; payload: string }
	| { type: 'SET_DASHBOARD_ID'; payload: string | null }
	| { type: 'SET_DASHBOARD_VISIBILITY'; payload: 'private' | 'public' }
	| { type: 'SET_DASHBOARD_TAGS'; payload: Array<string> }
	| { type: 'SET_DASHBOARD_DESCRIPTION'; payload: string }
	| { type: 'SET_SHOW_GENERATE_DASHBOARD_MODAL'; payload: boolean }
	| { type: 'SET_SHOW_ITERATE_DASHBOARD_MODAL'; payload: boolean }
	| { type: 'APPLY_DASHBOARD'; payload: Dashboard }
	| { type: 'SAVE_DASHBOARD'; payload: Dashboard; submitted: DashboardSaveBaseline }

const EMPTY_HISTORY: DashboardHistory = { past: [], future: [] }

const INITIAL_DASHBOARD_STATE: DashboardState = {
	items: [],
	timePeriod: '365d',
	customTimePeriod: null,
	variables: [],
	annotations: [],
	history: EMPTY_HISTORY,
	dashboardName: 'My Dashboard',
	dashboardId: null,
	currentDashboard: null,
	dashboardVisibility: 'private',
	dashboardTags: [],
	dashboardDescription: '',
	showGenerateDashboardModal: false,
	showIterateDashboardModal: false
}

function stateFromDashboard(dashboard: Dashboard): DashboardState {
	return {
		...INITIAL_DASHBOARD_STATE,
		dashboardId: dashboard.id,
		dashboardName: dashboard.data.dashboardName || 'My Dashboard',
		items: dashboard.data.items,
		timePeriod: dashboard.data.timePeriod || '365d',
		customTimePeriod: dashboard.data.customTimePeriod || null,
		variables: dashboard.data.variables ?? INITIAL_DASHBOARD_STATE.variables,
		annotations: dashboard.data.annotations ?? INITIAL_DASHBOARD_STATE.annotations,
		currentDashboard: dashboard,
		dashboardVisibility: dashboard.visibility || 'private',
		dashboardTags: dashboard.tags || INITIAL_DASHBOARD_STATE.dashboardTags,
		dashboardDescription: dashboard.description || ''
	}
}

export function initDashboardState(
	arg?: string | { dashboardId?: string; items?: Array<DashboardItemConfig>; dashboard?: Dashboard | null }
): DashboardState {
	if (typeof arg === 'object' && arg !== null) {
		if (arg.dashboard?.data?.items && Array.isArray(arg.dashboard.data.items)) {
			return stateFromDashboard(arg.dashboard)
		}
		return {
			...INITIAL_DASHBOARD_STATE,
			dashboardId: arg.dashboardId || null,
			...(arg.items?.length ? { items: arg.items } : {})
		}
	}
	const id = typeof arg === 'string' ? arg : null
	return {
		...INITIAL_DASHBOARD_STATE,
		dashboardId: id
	}
}

export function historySnapshot(state: Pick<DashboardState, 'items' | 'variables'>): DashboardHistoryEntry {
	return { items: state.items, variables: state.variables }
}

function pushHistory(history: DashboardHistory, entry: DashboardHistoryEntry): DashboardHistory {
	const past = history.past.length >= DASHBOARD_HISTORY_LIMIT ? history.past.slice(1) : history.past
	return { past: [...past, entry], future: [] }
}

export function stepHistory(
	history: DashboardHistory,
	current: DashboardHistoryEntry,
	direction: 'undo' | 'redo'
): { history: DashboardHistory; entry: DashboardHistoryEntry } | null {
	if (direction === 'undo') {
		const entry = history.past.at(-1)
		if (!entry) return null
		return { entry, history: { past: history.past.slice(0, -1), future: [current, ...history.future] } }
	}
	const entry = history.future[0]
	if (!entry) return null
	return { entry, history: { past: [...history.past, current], future: history.future.slice(1) } }
}

// Apply server-owned metadata, but retain fields edited since this request's baseline.
// Compare arrays only on responses: server/cache copies need not share the local draft's references.
function reconcileDashboard(
	state: DashboardState,
	dashboard: Dashboard,
	baseline: DashboardSaveBaseline
): DashboardState {
	const saved = stateFromDashboard(dashboard)
	const periodUnchanged =
		state.timePeriod === baseline.timePeriod &&
		replaceEqualDeep(baseline.customTimePeriod, state.customTimePeriod) === baseline.customTimePeriod
	return {
		...state,
		dashboardId: saved.dashboardId,
		currentDashboard: dashboard,
		items: mergeDashboardItems(baseline.items, saved.items, state.items),
		dashboardName: state.dashboardName === baseline.dashboardName ? saved.dashboardName : state.dashboardName,
		timePeriod: periodUnchanged ? saved.timePeriod : state.timePeriod,
		customTimePeriod: periodUnchanged ? saved.customTimePeriod : state.customTimePeriod,
		variables:
			replaceEqualDeep(baseline.variables, state.variables) === baseline.variables ? saved.variables : state.variables,
		annotations:
			replaceEqualDeep(baseline.annotations, state.annotations) === baseline.annotations
				? saved.annotations
				: state.annotations,
		dashboardVisibility:
			state.dashboardVisibility === baseline.dashboardVisibility
				? saved.dashboardVisibility
				: state.dashboardVisibility,
		dashboardTags:
			replaceEqualDeep(baseline.dashboardTags, state.dashboardTags) === baseline.dashboardTags
				? saved.dashboardTags
				: state.dashboardTags,
		dashboardDescription:
			state.dashboardDescription === baseline.dashboardDescription
				? saved.dashboardDescription
				: state.dashboardDescription
	}
}

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
	switch (action.type) {
		case 'SET_ITEMS': {
			const variables = action.variables ?? state.variables
			if (action.payload === state.items && variables === state.variables) return state
			return {
				...state,
				items: action.payload,
				variables,
				history: action.skipHistory ? state.history : pushHistory(state.history, historySnapshot(state))
			}
		}

		case 'SET_VARIABLES':
			if (action.payload === state.variables) return state
			return {
				...state,
				variables: action.payload,
				history: action.skipHistory ? state.history : pushHistory(state.history, historySnapshot(state))
			}

		case 'SET_ANNOTATIONS':
			return { ...state, annotations: action.payload }

		case 'UNDO':
		case 'REDO': {
			const step = stepHistory(state.history, historySnapshot(state), action.type === 'UNDO' ? 'undo' : 'redo')
			if (!step) return state
			return { ...state, items: step.entry.items, variables: step.entry.variables, history: step.history }
		}

		case 'CLEAR_HISTORY':
			return state.history === EMPTY_HISTORY ? state : { ...state, history: EMPTY_HISTORY }

		case 'SET_TIME_PERIOD':
			return {
				...state,
				timePeriod: action.payload,
				customTimePeriod: action.payload !== 'custom' ? null : state.customTimePeriod
			}

		case 'SET_CUSTOM_TIME_PERIOD':
			return {
				...state,
				customTimePeriod: action.payload,
				timePeriod: action.payload ? 'custom' : state.timePeriod
			}

		case 'SET_DASHBOARD_NAME':
			return { ...state, dashboardName: action.payload }

		case 'SET_DASHBOARD_ID':
			return { ...state, dashboardId: action.payload }

		case 'SET_DASHBOARD_VISIBILITY':
			return { ...state, dashboardVisibility: action.payload }

		case 'SET_DASHBOARD_TAGS':
			return { ...state, dashboardTags: action.payload }

		case 'SET_DASHBOARD_DESCRIPTION':
			return { ...state, dashboardDescription: action.payload }

		case 'SET_SHOW_GENERATE_DASHBOARD_MODAL':
			return { ...state, showGenerateDashboardModal: action.payload }

		case 'SET_SHOW_ITERATE_DASHBOARD_MODAL':
			return { ...state, showIterateDashboardModal: action.payload }

		case 'SAVE_DASHBOARD':
			if (state.dashboardId !== action.submitted.dashboardId) return state
			return reconcileDashboard(state, action.payload, action.submitted)

		case 'APPLY_DASHBOARD': {
			const dashboard = action.payload
			if (!dashboard?.data?.items || !Array.isArray(dashboard.data.items)) {
				return state
			}
			if (state.currentDashboard?.id === dashboard.id) {
				return reconcileDashboard(state, dashboard, stateFromDashboard(state.currentDashboard))
			}
			return {
				...stateFromDashboard(dashboard),
				showGenerateDashboardModal: state.showGenerateDashboardModal,
				showIterateDashboardModal: state.showIterateDashboardModal
			}
		}

		default:
			return state
	}
}
