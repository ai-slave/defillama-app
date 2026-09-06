import type { DashboardGrouping, MetricAggregator, MetricChartType, MetricWindow } from '../../types'

export type ComparisonType = 'chains' | 'protocols'
export type WizardStep = 'select-type' | 'select-items' | 'select-metrics' | 'preview'

export type DisplayMode = 'default' | 'stacked' | 'cumulative' | 'percentage'

export type ComparisonPreset = {
	comparisonType: ComparisonType
	items: Array<string>
}

export interface MetricSettings {
	aggregator: MetricAggregator
	window: MetricWindow
	compareMode: 'previous_window' | 'previous_value' | 'none'
	chartType: MetricChartType
}

export interface ComparisonWizardState {
	step: WizardStep
	comparisonType: ComparisonType | null
	selectedItems: Array<string>
	selectedMetrics: Array<string>
	metricsForCards: Array<string>
	dashboardName: string
	visibility: 'private' | 'public'
	tags: Array<string>
	description: string
	grouping: DashboardGrouping
	displayMode: DisplayMode
	metricSettings: MetricSettings
	includeTable: boolean
}

export interface MetricWithAvailability {
	metric: string
	title: string
	chartType: string
	color: string
	availableCount: number
	totalCount: number
	isValid: boolean
}

export type WizardAction =
	| { type: 'SET_STEP'; step: WizardStep }
	| { type: 'APPLY_PRESET'; comparisonType: ComparisonType; items: Array<string>; step: WizardStep }
	| { type: 'SET_COMPARISON_TYPE'; comparisonType: ComparisonType }
	| { type: 'SET_SELECTED_ITEMS'; items: Array<string> }
	| { type: 'TOGGLE_SELECTED_ITEM'; item: string; maxItems?: number }
	| { type: 'TOGGLE_METRIC'; metric: string }
	| { type: 'CLEAR_METRICS' }
	| { type: 'SELECT_ALL_METRICS'; metrics: Array<string> }
	| { type: 'TOGGLE_METRIC_FOR_CARD'; metric: string }
	| { type: 'SET_METRICS_FOR_CARDS'; metrics: Array<string> }
	| { type: 'SET_METRIC_SETTINGS'; settings: Partial<MetricSettings> }
	| { type: 'SET_DASHBOARD_NAME'; name: string }
	| { type: 'SET_VISIBILITY'; visibility: 'private' | 'public' }
	| { type: 'SET_TAGS'; tags: Array<string> }
	| { type: 'ADD_TAG'; tag: string }
	| { type: 'REMOVE_TAG'; tag: string }
	| { type: 'SET_DESCRIPTION'; description: string }
	| { type: 'SET_GROUPING'; grouping: DashboardGrouping }
	| { type: 'SET_DISPLAY_MODE'; displayMode: DisplayMode }
	| { type: 'SET_INCLUDE_TABLE'; include: boolean }
	| { type: 'RESET' }

export const WIZARD_STEPS: Array<WizardStep> = ['select-type', 'select-items', 'select-metrics', 'preview']

export const getStepIndex = (step: WizardStep): number => WIZARD_STEPS.indexOf(step)

export const getNextStep = (step: WizardStep): WizardStep | null => {
	const index = getStepIndex(step)
	return WIZARD_STEPS[index + 1] ?? null
}

export const getPrevStep = (step: WizardStep): WizardStep | null => {
	const index = getStepIndex(step)
	return index > 0 ? (WIZARD_STEPS[index - 1] ?? null) : null
}
