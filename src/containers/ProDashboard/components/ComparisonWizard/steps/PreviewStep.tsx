import { useId, useMemo } from 'react'
import { Checkbox } from '~/ui/Checkbox'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { DASHBOARD_NAME_MAX_LENGTH } from '../../../dashboardTypes'
import { useProDashboardCatalog } from '../../../ProDashboardAPIContext'
import {
	type DashboardGrouping,
	getProDashboardChartTypeConfig,
	type MetricAggregator,
	type MetricWindow
} from '../../../types'
import { AriakitSelect, type SelectOption } from '../../AriakitSelect'
import { dashboardFieldLabelStyles, DescriptionField, TagsField, VisibilityField } from '../../DashboardFormFields'
import { useComparisonWizardContext } from '../ComparisonWizardContext'
import type { DisplayMode } from '../types'

const GROUPING_OPTIONS: Array<SelectOption<DashboardGrouping>> = [
	{ value: 'day', label: 'Day' },
	{ value: 'week', label: 'Week' },
	{ value: 'month', label: 'Month' },
	{ value: 'quarter', label: 'Quarter' },
	{ value: 'year', label: 'Year' }
]

const DISPLAY_OPTIONS: Array<SelectOption<DisplayMode>> = [
	{ value: 'default', label: 'Default' },
	{ value: 'stacked', label: 'Stacked' },
	{ value: 'cumulative', label: 'Cumulative' },
	{ value: 'percentage', label: 'Percentage' }
]

const AGGREGATOR_OPTIONS: Array<SelectOption<MetricAggregator>> = [
	{ value: 'latest', label: 'Latest' },
	{ value: 'avg', label: 'Average' },
	{ value: 'sum', label: 'Total' },
	{ value: 'max', label: 'Max' },
	{ value: 'min', label: 'Min' },
	{ value: 'growth', label: 'Growth' }
]

const WINDOW_OPTIONS: Array<SelectOption<MetricWindow>> = [
	{ value: '7d', label: '7d' },
	{ value: '30d', label: '30d' },
	{ value: '90d', label: '90d' },
	{ value: '365d', label: '1y' },
	{ value: 'all', label: 'All' }
]

function count(n: number, noun: string) {
	return `${n} ${noun}${n === 1 ? '' : 's'}`
}

function outputSummary(cards: number, charts: number, includeTable: boolean) {
	const parts = [count(charts, 'chart')]
	if (cards > 0) parts.unshift(count(cards, 'card'))
	if (includeTable) parts.push('1 table')
	return parts.join(' + ')
}

export function PreviewStep() {
	const { state, actions } = useComparisonWizardContext()
	const { getProtocolInfo } = useProDashboardCatalog()
	const id = useId()

	const selectedItemLabels = useMemo(() => {
		return state.selectedItems.map((item) => {
			if (state.comparisonType === 'chains') {
				return item
			}
			return getProtocolInfo(item)?.name || item
		})
	}, [state.selectedItems, state.comparisonType, getProtocolInfo])

	const metricCardsCount = state.metricsForCards.length * state.selectedItems.length

	return (
		<div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
			<div className="flex min-w-0 flex-col gap-4">
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-name`} className={dashboardFieldLabelStyles}>
						Dashboard name
					</label>
					<Input
						id={`${id}-name`}
						type="text"
						value={state.dashboardName}
						onChange={(e) => actions.setDashboardName(e.target.value)}
						maxLength={DASHBOARD_NAME_MAX_LENGTH}
						placeholder="Enter dashboard name"
						required
					/>
				</div>

				<VisibilityField value={state.visibility} onChange={actions.setVisibility} sharedWithTeam={false} />

				<div className="grid grid-cols-2 gap-2">
					<AriakitSelect
						label="Grouping"
						options={GROUPING_OPTIONS}
						selectedValue={state.grouping}
						onChange={(opt) => actions.setGrouping(opt.value)}
					/>
					<AriakitSelect
						label="Display"
						options={DISPLAY_OPTIONS}
						selectedValue={state.displayMode}
						onChange={(opt) => actions.setDisplayMode(opt.value)}
					/>
				</div>

				<TagsField tags={state.tags} onChange={actions.setTags} />
				<DescriptionField value={state.description} onChange={actions.setDescription} />
			</div>

			<div className="flex min-w-0 flex-col gap-3">
				<div className="rounded-lg border border-subtle p-3">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="flex items-center gap-1.5 label-sm text-primary">
							<Icon name="activity" height={14} width={14} />
							Add metric cards
						</h3>
						<span className="body-sm text-tertiary">Optional</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{state.selectedMetrics.map((metric) => {
							const info = getProDashboardChartTypeConfig(metric)
							const label = info?.title || metric
							const isSelected = state.metricsForCards.includes(metric)
							return (
								<label
									key={metric}
									className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 label-sm transition-colors ${
										isSelected
											? 'border-brand bg-brand-muted text-link-on-tint'
											: 'border-medium text-secondary hover:border-brand/40'
									}`}
								>
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => actions.toggleMetricForCard(metric)}
										className="sr-only"
									/>
									{isSelected ? <Icon name="check" height={10} width={10} /> : null}
									{label}
								</label>
							)
						})}
					</div>
					{state.metricsForCards.length > 0 ? (
						<div className="mt-2 flex items-center gap-2 border-t border-subtle pt-2">
							<AriakitSelect
								options={AGGREGATOR_OPTIONS}
								selectedValue={state.metricSettings.aggregator}
								onChange={(opt) => actions.setMetricSettings({ aggregator: opt.value })}
								className="min-w-[80px]"
							/>
							<AriakitSelect
								options={WINDOW_OPTIONS}
								selectedValue={state.metricSettings.window}
								onChange={(opt) => actions.setMetricSettings({ window: opt.value })}
								className="min-w-[60px]"
							/>
						</div>
					) : null}
				</div>

				<div className="rounded-lg border border-subtle p-3">
					<Checkbox
						variant="consent"
						checked={state.includeTable}
						onChange={(event) => actions.setIncludeTable(event.target.checked)}
					>
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="flex items-center gap-1.5 label-sm text-primary">
								<Icon name="layout-grid" height={14} width={14} />
								Include comparison table
							</span>
							<span className="body-sm text-secondary">
								Adds a table with detailed metrics for every compared item.
							</span>
						</span>
					</Checkbox>
				</div>

				<div className="rounded-lg border border-subtle p-3">
					<h3 className="mb-2 flex items-center gap-1.5 label-sm text-primary">
						<Icon name="file-text" height={14} width={14} />
						Summary
					</h3>
					<div className="space-y-1.5 body-sm">
						<div className="flex items-start justify-between gap-3">
							<span className="shrink-0 text-tertiary">Comparing</span>
							<span className="min-w-0 text-right font-medium wrap-break-word text-primary">
								{selectedItemLabels.join(', ')}
							</span>
						</div>
						<div className="flex items-start justify-between gap-3">
							<span className="shrink-0 text-tertiary">Output</span>
							<span className="min-w-0 text-right font-medium text-brand">
								{outputSummary(metricCardsCount, state.selectedMetrics.length, state.includeTable)}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
