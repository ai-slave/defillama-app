import { useReducer, useState } from 'react'
import { useAuthContext } from '~/auth'
import { useProDashboardCatalog } from '../../../ProDashboardAPIContext'
import type { DashboardGrouping } from '../../../types'
import type {
	ComparisonPreset,
	ComparisonType,
	ComparisonWizardState,
	DisplayMode,
	MetricSettings,
	WizardAction
} from '../types'
import { getNextStep, getPrevStep, MAX_COMPARISON_ITEMS } from '../types'

const WIZARD_DEFAULTS: Omit<ComparisonWizardState, 'visibility'> = {
	step: 'select-type',
	comparisonType: null,
	selectedItems: [],
	selectedMetrics: [],
	metricsForCards: [],
	dashboardName: null,
	tags: null,
	description: '',
	grouping: 'day',
	displayMode: 'default',
	metricSettings: {
		aggregator: 'latest',
		window: '30d',
		compareMode: 'previous_value',
		chartType: 'sparkline'
	},
	includeTable: true
}

export function createInitialWizardState({
	hasActiveSubscription,
	comparisonPreset
}: {
	hasActiveSubscription: boolean
	comparisonPreset: ComparisonPreset | undefined
}): ComparisonWizardState {
	const state: ComparisonWizardState = { ...WIZARD_DEFAULTS, visibility: hasActiveSubscription ? 'private' : 'public' }
	if (!comparisonPreset) return state
	const items = comparisonPreset.items
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, MAX_COMPARISON_ITEMS)
	// A preset with items skips straight to metrics; one without still skips the type step.
	return {
		...state,
		comparisonType: comparisonPreset.comparisonType,
		selectedItems: items,
		step: items.length > 0 ? 'select-metrics' : 'select-items'
	}
}

function reducer(state: ComparisonWizardState, action: WizardAction): ComparisonWizardState {
	switch (action.type) {
		case 'SET_STEP':
			return { ...state, step: action.step }
		case 'SET_COMPARISON_TYPE':
			// Picking the type already chosen keeps the selections made for it.
			if (action.comparisonType === state.comparisonType) return state
			return { ...state, comparisonType: action.comparisonType, selectedItems: [], selectedMetrics: [] }
		case 'SET_SELECTED_ITEMS':
			return { ...state, selectedItems: action.items, selectedMetrics: [], metricsForCards: [] }
		case 'TOGGLE_SELECTED_ITEM': {
			const isRemoving = state.selectedItems.includes(action.item)
			if (!isRemoving && state.selectedItems.length >= MAX_COMPARISON_ITEMS) return state
			return {
				...state,
				selectedItems: isRemoving
					? state.selectedItems.filter((i) => i !== action.item)
					: [...state.selectedItems, action.item],
				selectedMetrics: [],
				metricsForCards: []
			}
		}
		case 'TOGGLE_METRIC': {
			const isRemoving = state.selectedMetrics.includes(action.metric)
			const metrics = isRemoving
				? state.selectedMetrics.filter((m) => m !== action.metric)
				: [...state.selectedMetrics, action.metric]
			const metricsForCards = isRemoving
				? state.metricsForCards.filter((m) => m !== action.metric)
				: state.metricsForCards
			return { ...state, selectedMetrics: metrics, metricsForCards }
		}
		case 'CLEAR_METRICS':
			return { ...state, selectedMetrics: [], metricsForCards: [] }
		case 'SELECT_ALL_METRICS':
			return { ...state, selectedMetrics: action.metrics }
		case 'TOGGLE_METRIC_FOR_CARD': {
			const metricsForCards = state.metricsForCards.includes(action.metric)
				? state.metricsForCards.filter((m) => m !== action.metric)
				: [...state.metricsForCards, action.metric]
			return { ...state, metricsForCards }
		}
		case 'SET_METRIC_SETTINGS':
			return { ...state, metricSettings: { ...state.metricSettings, ...action.settings } }
		case 'SET_DASHBOARD_NAME':
			return { ...state, dashboardName: action.name }
		case 'SET_VISIBILITY':
			return { ...state, visibility: action.visibility }
		case 'SET_TAGS':
			return { ...state, tags: action.tags }
		case 'SET_DESCRIPTION':
			return { ...state, description: action.description }
		case 'SET_GROUPING':
			return { ...state, grouping: action.grouping }
		case 'SET_DISPLAY_MODE':
			return { ...state, displayMode: action.displayMode }
		case 'SET_INCLUDE_TABLE':
			return { ...state, includeTable: action.include }
	}
}

function defaultDashboardName(displayNames: Array<string>) {
	if (displayNames.length === 0) return 'Comparison'
	if (displayNames.length === 1) return displayNames[0]
	if (displayNames.length === 2) return displayNames.join(' vs ')
	return `${displayNames[0]} vs ${displayNames.length - 1} competitors`
}

/** What the current step still needs before Next or Create, or null when it can continue. */
function blockedReason(state: ComparisonWizardState, dashboardName: string) {
	switch (state.step) {
		case 'select-type':
			return state.comparisonType === null ? 'Choose chains or protocols' : null
		case 'select-items':
			if (state.selectedItems.length > 0) return null
			return state.comparisonType === 'chains' ? 'Pick at least 1 chain' : 'Pick at least 1 protocol'
		case 'select-metrics':
			return state.selectedMetrics.length > 0 ? null : 'Pick at least 1 metric'
		case 'preview':
			return dashboardName.trim() ? null : 'Enter a dashboard name'
	}
}

// The preset seeds the first state only; the picker remounts the wizard for each opening.
export function useComparisonWizard(comparisonPreset: ComparisonPreset | undefined) {
	const { hasActiveSubscription } = useAuthContext()
	const [initialState] = useState(() => createInitialWizardState({ hasActiveSubscription, comparisonPreset }))
	const [state, dispatch] = useReducer(reducer, initialState)
	const { getProtocolInfo } = useProDashboardCatalog()

	// Until the reader edits them, the name and tags follow the selection, so going back to change it updates both.
	const displayNames = state.selectedItems.map((item) =>
		state.comparisonType === 'chains' ? item : getProtocolInfo(item)?.name || item
	)
	const dashboardName = state.dashboardName ?? defaultDashboardName(displayNames)
	const tags = state.tags ?? displayNames

	// Moving between steps alone loses nothing; any other change is work the dialog asks about before dropping.
	let dirty = false
	for (const key in state) {
		if (
			key !== 'step' &&
			state[key as keyof ComparisonWizardState] !== initialState[key as keyof ComparisonWizardState]
		)
			dirty = true
	}

	const goTo = (next: ComparisonWizardState['step'] | null) => {
		if (next) dispatch({ type: 'SET_STEP', step: next })
	}

	return {
		state,
		actions: {
			setComparisonType: (comparisonType: ComparisonType) => dispatch({ type: 'SET_COMPARISON_TYPE', comparisonType }),
			setSelectedItems: (items: Array<string>) => dispatch({ type: 'SET_SELECTED_ITEMS', items }),
			toggleSelectedItem: (item: string) => dispatch({ type: 'TOGGLE_SELECTED_ITEM', item }),
			toggleMetric: (metric: string) => dispatch({ type: 'TOGGLE_METRIC', metric }),
			clearMetrics: () => dispatch({ type: 'CLEAR_METRICS' }),
			selectAllMetrics: (metrics: Array<string>) => dispatch({ type: 'SELECT_ALL_METRICS', metrics }),
			toggleMetricForCard: (metric: string) => dispatch({ type: 'TOGGLE_METRIC_FOR_CARD', metric }),
			setMetricSettings: (settings: Partial<MetricSettings>) => dispatch({ type: 'SET_METRIC_SETTINGS', settings }),
			setDashboardName: (name: string) => dispatch({ type: 'SET_DASHBOARD_NAME', name }),
			setVisibility: (visibility: 'private' | 'public') => dispatch({ type: 'SET_VISIBILITY', visibility }),
			setTags: (nextTags: Array<string>) => dispatch({ type: 'SET_TAGS', tags: nextTags }),
			setDescription: (description: string) => dispatch({ type: 'SET_DESCRIPTION', description }),
			setGrouping: (grouping: DashboardGrouping) => dispatch({ type: 'SET_GROUPING', grouping }),
			setDisplayMode: (displayMode: DisplayMode) => dispatch({ type: 'SET_DISPLAY_MODE', displayMode }),
			setIncludeTable: (include: boolean) => dispatch({ type: 'SET_INCLUDE_TABLE', include }),
			goToNextStep: () => goTo(getNextStep(state.step)),
			goToPrevStep: () => goTo(getPrevStep(state.step))
		},
		derived: {
			dashboardName,
			tags,
			blockedReason: blockedReason(state, dashboardName),
			canGoBack: getPrevStep(state.step) !== null,
			dirty
		}
	}
}

export type UseComparisonWizardReturn = ReturnType<typeof useComparisonWizard>
