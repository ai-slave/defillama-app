import { useEffect, useRef, useState } from 'react'
import { useAppMetadata } from '../../AppMetadataContext'
import { createChartConfig, createMetricConfig } from '../../dashboardConfig/classicChartConfig'
import type { DashboardItemConfig } from '../../dashboardItemConfig'
import { useProDashboardCatalog } from '../../ProDashboardAPIContext'
import { type ChartConfig, getProDashboardChartTypeConfig, type MetricConfig, type MultiChartConfig } from '../../types'
import { UNIFIED_TABLE_CONFIG_VERSION, type UnifiedTableConfig } from '../../unifiedTable/config/current'
import { generateItemId } from '../../utils/dashboardUtils'
import { ComparisonWizardProvider, useComparisonWizardContext } from './ComparisonWizardContext'
import { WizardNavigation } from './components/WizardNavigation'
import { PreviewStep } from './steps/PreviewStep'
import { SelectItemsStep } from './steps/SelectItemsStep'
import { SelectMetricsStep } from './steps/SelectMetricsStep'
import { SelectTypeStep } from './steps/SelectTypeStep'
import type { ComparisonPreset } from './types'

interface ComparisonWizardProps {
	onComplete: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: string[]
		description: string
		items: DashboardItemConfig[]
	}) => void
	comparisonPreset?: ComparisonPreset
}

function ComparisonWizardContent({ onComplete, comparisonPreset }: ComparisonWizardProps) {
	const { state, actions, derived, availableMetrics } = useComparisonWizardContext()
	const { getProtocolInfo } = useProDashboardCatalog()
	const { chainsByName } = useAppMetadata()
	const [isGenerating, setIsGenerating] = useState(false)
	const { applyPreset } = actions
	const appliedPresetRef = useRef(false)

	useEffect(() => {
		if (!comparisonPreset || appliedPresetRef.current) return
		const items = comparisonPreset.items
			.map((item) => item.trim())
			.filter(Boolean)
			.slice(0, 10)
		const step = items.length > 0 ? 'select-metrics' : 'select-items'
		applyPreset(comparisonPreset.comparisonType, items, step)
		appliedPresetRef.current = true
	}, [comparisonPreset, applyPreset])

	const generateComparisonCharts = (): MultiChartConfig[] => {
		const { selectedItems, selectedMetrics, comparisonType } = state

		if (!comparisonType) return []

		return selectedMetrics.flatMap((metric): MultiChartConfig[] => {
			const chartTypeInfo = getProDashboardChartTypeConfig(metric)
			const metricInfo = availableMetrics.find((m) => m.metric === metric)
			const isChain = comparisonType === 'chains'
			const isGroupable = chartTypeInfo && 'groupable' in chartTypeInfo && chartTypeInfo.groupable
			const chartItems: ChartConfig[] = []
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

	const generateComparisonMetrics = (): MetricConfig[] => {
		const { selectedItems, metricsForCards, comparisonType, metricSettings } = state

		if (!comparisonType || metricsForCards.length === 0) return []

		const metrics: MetricConfig[] = []

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
		if (!state.dashboardName.trim()) return

		setIsGenerating(true)
		const metricCards = generateComparisonMetrics()
		const charts = generateComparisonCharts()
		const table = generateComparisonTable()

		const totalEffectiveCols = metricCards.length * 1 + charts.length * 2
		const remainder = totalEffectiveCols % 4

		if (remainder === 2 && charts.length > 0) {
			const lastChart = charts.at(-1)
			if (lastChart) lastChart.colSpan = 2
		}

		const items: DashboardItemConfig[] = [...metricCards, ...charts]
		if (table) {
			items.push(table)
		}

		onComplete({
			dashboardName: state.dashboardName.trim(),
			visibility: state.visibility,
			tags: state.tags,
			description: state.description,
			items
		})
		setIsGenerating(false)
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
			default:
				return null
		}
	})()

	return (
		<div className="flex min-h-[480px] flex-col">
			<div className="flex-1 overflow-y-auto p-6">{stepContent}</div>
			<div className="border-t border-pro-cards-border bg-pro-cards-bg px-6 py-4">
				<WizardNavigation
					currentStep={state.step}
					canProceed={derived.canProceed}
					canGoBack={derived.canGoBack}
					onNext={actions.goToNextStep}
					onBack={actions.goToPrevStep}
					onGenerate={handleGenerate}
					isGenerating={isGenerating}
				/>
			</div>
		</div>
	)
}

export function ComparisonWizard({ onComplete, comparisonPreset }: ComparisonWizardProps) {
	return (
		<ComparisonWizardProvider>
			<ComparisonWizardContent
				onComplete={onComplete}
				{...(comparisonPreset !== undefined ? { comparisonPreset } : {})}
			/>
		</ComparisonWizardProvider>
	)
}
