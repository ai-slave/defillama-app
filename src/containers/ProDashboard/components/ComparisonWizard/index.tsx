import type { ReactNode } from 'react'
import { DialogBody, DialogDiscardGuard, DialogToolbar, useDialogLeave } from '~/ui/Dialog'
import { useAppMetadata } from '../../AppMetadataContext'
import { createChartConfig, createMetricConfig } from '../../dashboardConfig/classicChartConfig'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { type ChartConfig, getProDashboardChartTypeConfig, type MetricConfig, type MultiChartConfig } from '../../types'
import { UNIFIED_TABLE_CONFIG_VERSION, type UnifiedTableConfig } from '../../unifiedTable/config/current'
import { generateItemId } from '../../utils/dashboardUtils'
import { ComparisonWizardProvider, useComparisonWizardContext } from './ComparisonWizardContext'
import { WizardNavigation, WizardSteps } from './components/WizardNavigation'
import { PreviewStep } from './steps/PreviewStep'
import { SelectItemsStep } from './steps/SelectItemsStep'
import { SelectMetricsStep } from './steps/SelectMetricsStep'
import { SelectTypeStep } from './steps/SelectTypeStep'
import type { ComparisonPreset } from './types'

interface ComparisonWizardProps {
	creating: boolean
	onComplete: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items: Array<DashboardItemConfig>
	}) => void
	comparisonPreset?: ComparisonPreset
	/** Leaves the wizard; the footer's Back calls it from the first step. */
	onExit: () => void
	/** Creation feedback from the caller, shown at the end of the body above the footer. */
	feedback: ReactNode
}

function ComparisonWizardContent({
	onComplete,
	onExit,
	creating,
	feedback
}: Omit<ComparisonWizardProps, 'comparisonPreset'>) {
	const { state, actions, derived, availableMetrics } = useComparisonWizardContext()
	const leave = useDialogLeave()
	const { getProtocolInfo } = useProDashboardCatalog()
	const { chainsByName } = useAppMetadata()

	const generateComparisonCharts = (): Array<MultiChartConfig> => {
		const { selectedItems, selectedMetrics, comparisonType } = state

		if (!comparisonType) return []

		return selectedMetrics.flatMap((metric): Array<MultiChartConfig> => {
			const chartTypeInfo = getProDashboardChartTypeConfig(metric)
			const metricInfo = availableMetrics.find((m) => m.metric === metric)
			const isChain = comparisonType === 'chains'
			const isGroupable = chartTypeInfo && 'groupable' in chartTypeInfo && chartTypeInfo.groupable
			const chartItems: Array<ChartConfig> = []
			for (const item of selectedItems) {
				const chainMeta = isChain ? chainsByName.get(item) : undefined
				const protocol = isChain ? undefined : getProtocolInfo(item)
				if (isChain ? !chainMeta : !protocol) continue

				const chartBase = {
					id: generateItemId('chart', `${item}-${metric}`),
					kind: 'chart' as const,
					...(isGroupable ? { grouping: 'day' as const } : {}),
					...(chainMeta?.gecko_id != null
						? { geckoId: chainMeta.gecko_id }
						: protocol?.geckoId != null
							? { geckoId: protocol.geckoId }
							: {})
				}
				const chart = isChain
					? createChartConfig({ ...chartBase, subjectType: 'chain', chain: item, type: metric })
					: createChartConfig({ ...chartBase, subjectType: 'protocol', protocol: item, type: metric })
				if (chart) chartItems.push(chart)
			}

			if (chartItems.length === 0) return []

			const metricTitle = metricInfo?.title || chartTypeInfo?.title || metric
			const chartName = selectedItems.length === 1 ? metricTitle : `${metricTitle} Comparison`

			return [
				{
					id: generateItemId('multi', `comparison-${metric}`),
					kind: 'multi',
					name: chartName,
					items: chartItems,
					...(state.grouping !== undefined ? { grouping: state.grouping } : {}),
					showStacked: state.displayMode === 'stacked',
					showCumulative: state.displayMode === 'cumulative',
					showPercentage: state.displayMode === 'percentage',
					colSpan: 1
				}
			]
		})
	}

	const generateComparisonMetrics = (): Array<MetricConfig> => {
		const { selectedItems, metricsForCards, comparisonType, metricSettings } = state

		if (!comparisonType || metricsForCards.length === 0) return []

		const metrics: Array<MetricConfig> = []

		for (const metricType of metricsForCards) {
			for (const item of selectedItems) {
				const isChain = comparisonType === 'chains'

				let subject: MetricConfig['subject']
				if (isChain) {
					const chainMeta = chainsByName.get(item)
					subject = {
						itemType: 'chain',
						chain: item,
						...(chainMeta?.gecko_id !== undefined ? { geckoId: chainMeta.gecko_id } : {})
					}
				} else {
					const protocol = getProtocolInfo(item)
					subject = {
						itemType: 'protocol',
						protocol: item,
						...(protocol?.geckoId !== undefined ? { geckoId: protocol.geckoId } : {})
					}
				}

				const metric = createMetricConfig({
					id: generateItemId('metric', `${item}-${metricType}`),
					kind: 'metric',
					subject,
					type: metricType,
					aggregator: metricSettings.aggregator,
					window: metricSettings.window,
					...(metricSettings.compareMode !== 'none'
						? { compare: { mode: metricSettings.compareMode, format: 'percent' as const } }
						: {}),
					chartType: metricSettings.chartType,
					colSpan: 0.5
				})
				if (metric) metrics.push(metric)
			}
		}

		return metrics
	}

	const generateComparisonTable = (): UnifiedTableConfig | null => {
		if (!state.includeTable || !state.comparisonType) return null

		const isChains = state.comparisonType === 'chains'

		return {
			id: generateItemId('unified-table', 'comparison'),
			kind: 'unified-table',
			configVersion: UNIFIED_TABLE_CONFIG_VERSION,
			strategy: 'protocols',
			rowHeaders: isChains ? ['chain'] : ['parent-protocol', 'protocol'],
			filters: isChains ? { chains: state.selectedItems } : { protocols: state.selectedItems },
			columnOrder: isChains
				? ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h', 'volume24h', 'bridgedTvl']
				: ['name', 'tvl', 'change7d', 'fees24h', 'revenue24h', 'volume24h'],
			columnVisibility: {
				name: true,
				tvl: true,
				change7d: true,
				fees24h: true,
				revenue24h: true,
				volume24h: true,
				...(isChains && { bridgedTvl: true })
			},
			defaultSorting: [{ id: 'tvl', desc: true }],
			colSpan: 2
		}
	}

	const handleGenerate = () => {
		if (derived.blockedReason) return

		const metricCards = generateComparisonMetrics()
		const charts = generateComparisonCharts()
		const table = generateComparisonTable()

		const totalEffectiveCols = metricCards.length * 1 + charts.length * 2
		const remainder = totalEffectiveCols % 4

		if (remainder === 2 && charts.length > 0) {
			const lastChart = charts.at(-1)
			if (lastChart) lastChart.colSpan = 2
		}

		const items: Array<DashboardItemConfig> = [...metricCards, ...charts]
		if (table) {
			items.push(table)
		}

		onComplete({
			dashboardName: derived.dashboardName.trim(),
			visibility: state.visibility,
			tags: derived.tags,
			description: state.description,
			items
		})
	}

	const stepContent = (() => {
		switch (state.step) {
			case 'select-type':
				return <SelectTypeStep />
			case 'select-items':
				return <SelectItemsStep />
			case 'select-metrics':
				return <SelectMetricsStep />
			case 'preview':
				return <PreviewStep />
		}
	})()

	// Rendered straight into the dialog surface: the steps band, the scrolling step, and the navigation footer.
	return (
		<>
			<DialogDiscardGuard
				when={derived.dirty && !creating}
				title="Discard this comparison?"
				description="The choices you made are not saved."
			/>
			{/* Creating locks the steps, but not the footer: the pending Create keeps focus and its "Creating…" label. */}
			<fieldset disabled={creating} className="contents">
				<DialogToolbar>
					<WizardSteps currentStep={state.step} />
				</DialogToolbar>
				<DialogBody>
					{/* A floor on the step height keeps the dialog from jumping between steps on desktop. */}
					<div className="sm:min-h-88">{stepContent}</div>
					{feedback}
				</DialogBody>
			</fieldset>
			<WizardNavigation
				currentStep={state.step}
				blockedReason={derived.blockedReason}
				onNext={actions.goToNextStep}
				onBack={derived.canGoBack ? actions.goToPrevStep : () => leave(onExit)}
				onGenerate={handleGenerate}
				creating={creating}
			/>
		</>
	)
}

export function ComparisonWizard({ onComplete, onExit, comparisonPreset, creating, feedback }: ComparisonWizardProps) {
	return (
		<ComparisonWizardProvider comparisonPreset={comparisonPreset}>
			<ComparisonWizardContent creating={creating} feedback={feedback} onComplete={onComplete} onExit={onExit} />
		</ComparisonWizardProvider>
	)
}
