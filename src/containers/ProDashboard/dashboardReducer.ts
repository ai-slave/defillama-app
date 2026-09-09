import { replaceEqualDeep } from '@tanstack/react-query'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { CustomTimePeriod, Dashboard, TimePeriod } from './dashboardTypes'
import { mergeDashboardItems } from './utils/dashboardUtils'

export interface DashboardState {
	items: Array<DashboardItemConfig>
	timePeriod: TimePeriod
	customTimePeriod: CustomTimePeriod | null
	dashboardName: string
	dashboardId: string | null
	currentDashboard: Dashboard | null
	dashboardVisibility: 'private' | 'public'
	dashboardTags: Array<string>
	dashboardDescription: string
	showGenerateDashboardModal: boolean
	showIterateDashboardModal: boolean
}

type DashboardSaveBaseline = Omit<
	DashboardState,
	'currentDashboard' | 'showGenerateDashboardModal' | 'showIterateDashboardModal'
>

export type DashboardAction =
	| { type: 'SET_ITEMS'; payload: Array<DashboardItemConfig> }
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

const INITIAL_DASHBOARD_STATE: DashboardState = {
	items: [],
	timePeriod: '365d',
	customTimePeriod: null,
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
		case 'SET_ITEMS':
			return {
				...state,
				items: action.payload
			}

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
