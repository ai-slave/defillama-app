import * as Ariakit from '@ariakit/react'
import { useId, useMemo, useState } from 'react'
import { useAuthContext } from '~/auth'
import { Icon } from '~/ui/Icon'
import { useProDashboardCatalog } from '../../../ProDashboardAPIContext'
import {
	type DashboardGrouping,
	getProDashboardChartTypeConfig,
	type MetricAggregator,
	type MetricWindow
} from '../../../types'
import { AriakitCheckbox } from '../../AriakitCheckbox'
import { AriakitSelect, type SelectOption } from '../../AriakitSelect'
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

function visibilityOptionStyles(selected: boolean, disabled: boolean) {
	return `flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors has-focus-visible:focus-ring ${
		selected
			? 'border-brand bg-brand/10 text-brand'
			: disabled
				? 'cursor-not-allowed border-pro-cards-border text-pro-text-tertiary opacity-50'
				: 'border-pro-cards-border text-pro-text-secondary hover:border-brand/40'
	}`
}

export function PreviewStep() {
	const { state, actions } = useComparisonWizardContext()
	const { hasActiveSubscription } = useAuthContext()
	const { getProtocolInfo } = useProDashboardCatalog()
	const [tagInput, setTagInput] = useState('')
	const id = useId()

	const selectedItemLabels = useMemo(() => {
		return state.selectedItems.map((item) => {
			if (state.comparisonType === 'chains') {
				return item
			}
			return getProtocolInfo(item)?.name || item
		})
	}, [state.selectedItems, state.comparisonType, getProtocolInfo])

	const handleAddTag = () => {
		const tag = tagInput.trim()
		if (tag) {
			actions.addTag(tag)
		}
		setTagInput('')
	}

	const handleRemoveTag = (tag: string) => {
		actions.removeTag(tag)
	}

	const handleTagKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			handleAddTag()
		}
	}

	const metricCardsCount = state.metricsForCards.length * state.selectedItems.length

	return (
		<div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
			<div className="flex min-w-0 flex-col gap-3">
				<div>
					<label htmlFor="comparison-dashboard-name" className="mb-1 block text-sm font-medium text-pro-text-primary">
						Dashboard Name <span className="text-error">*</span>
					</label>
					<input
						id="comparison-dashboard-name"
						type="text"
						value={state.dashboardName}
						onChange={(e) => actions.setDashboardName(e.target.value)}
						placeholder="Enter dashboard name"
						className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-3 py-1.5 text-sm placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
					/>
				</div>

				<div>
					<p id={`${id}-visibility`} className="mb-1 block text-sm font-medium text-pro-text-primary">
						Visibility
					</p>
					<Ariakit.RadioProvider
						value={state.visibility}
						setValue={(value) => actions.setVisibility(value as 'public' | 'private')}
					>
						<Ariakit.RadioGroup className="flex gap-1.5" aria-labelledby={`${id}-visibility`}>
							<label htmlFor={`${id}-public`} className={visibilityOptionStyles(state.visibility === 'public', false)}>
								<Ariakit.Radio id={`${id}-public`} value="public" className="sr-only" />
								<Icon name="earth" height={12} width={12} />
								Public
							</label>
							<label
								htmlFor={`${id}-private`}
								className={visibilityOptionStyles(state.visibility === 'private', !hasActiveSubscription)}
							>
								<Ariakit.Radio
									id={`${id}-private`}
									value="private"
									disabled={!hasActiveSubscription}
									className="sr-only"
								/>
								<Icon name={hasActiveSubscription ? 'key' : 'file-lock-2'} height={12} width={12} />
								Private
								{!hasActiveSubscription ? <span className="text-xs font-normal opacity-70">(Pro)</span> : null}
							</label>
						</Ariakit.RadioGroup>
					</Ariakit.RadioProvider>
				</div>

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

				<div>
					<label htmlFor="comparison-dashboard-tags" className="mb-1 block text-sm font-medium text-pro-text-primary">
						Tags
					</label>
					<div className="flex gap-1.5">
						<input
							id="comparison-dashboard-tags"
							type="text"
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyDown={handleTagKeyDown}
							placeholder="Add tags..."
							className="min-w-0 flex-1 rounded-md border border-pro-cards-border bg-surface-elevated-1 px-2 py-1.5 text-sm placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
						/>
						<button
							type="button"
							onClick={handleAddTag}
							disabled={!tagInput.trim()}
							className="rounded-md border border-pro-cards-border px-2 py-1.5 text-xs font-medium text-pro-text-secondary transition-colors hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Add
						</button>
					</div>
					{state.tags.length > 0 ? (
						<div className="mt-1.5 flex flex-wrap gap-1">
							{state.tags.map((tag) => (
								<span
									key={tag}
									className="flex items-center gap-1 rounded-full border border-pro-cards-border px-2 py-0.5 text-xs"
								>
									{tag}
									<button
										type="button"
										onClick={() => handleRemoveTag(tag)}
										className="text-pro-text-tertiary hover:text-error"
									>
										<Icon name="x" height={10} width={10} />
									</button>
								</span>
							))}
						</div>
					) : null}
				</div>

				<div>
					<label
						htmlFor="comparison-dashboard-description"
						className="mb-1 block text-sm font-medium text-pro-text-primary"
					>
						Description <span className="text-xs font-normal text-pro-text-tertiary">(optional)</span>
					</label>
					<input
						id="comparison-dashboard-description"
						type="text"
						value={state.description}
						onChange={(e) => actions.setDescription(e.target.value)}
						placeholder="Brief description..."
						className="w-full rounded-md border border-pro-cards-border bg-surface-elevated-1 px-3 py-1.5 text-sm placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
					/>
				</div>
			</div>

			<div className="flex min-w-0 flex-col gap-3">
				<div className="rounded-lg border border-pro-cards-border p-3">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="flex items-center gap-1.5 text-sm font-semibold text-pro-text-primary">
							<Icon name="activity" height={14} width={14} />
							Add Metric Cards
						</h3>
						<span className="text-xs text-pro-text-tertiary">Optional</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{state.selectedMetrics.map((metric) => {
							const info = getProDashboardChartTypeConfig(metric)
							const label = info?.title || metric
							const isSelected = state.metricsForCards.includes(metric)
							return (
								<label
									key={metric}
									className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
										isSelected
											? 'border-brand bg-brand/10 text-brand'
											: 'border-pro-cards-border text-pro-text-secondary hover:border-brand/40'
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
						<div className="mt-2 flex items-center gap-2 border-t border-pro-cards-border pt-2">
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

				<div className="rounded-lg border border-pro-cards-border p-3">
					<AriakitCheckbox
						checked={state.includeTable}
						onChange={(checked) => actions.setIncludeTable(checked)}
						label={
							<span className="flex items-center gap-1.5 text-sm font-medium text-pro-text-primary">
								<Icon name="layout-grid" height={14} width={14} />
								Include Comparison Table
							</span>
						}
						description="Adds a data table showing detailed metrics for all compared items"
					/>
				</div>

				<div className="rounded-lg border border-pro-cards-border p-3">
					<h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-pro-text-primary">
						<Icon name="file-text" height={14} width={14} />
						Summary
					</h3>
					<div className="space-y-1.5 text-xs">
						<div className="flex items-start justify-between gap-3">
							<span className="shrink-0 text-pro-text-tertiary">Comparing</span>
							<span className="min-w-0 text-right font-medium wrap-break-word text-pro-text-primary">
								{selectedItemLabels.join(', ')}
							</span>
						</div>
						<div className="flex items-start justify-between gap-3">
							<span className="shrink-0 text-pro-text-tertiary">Output</span>
							<span className="min-w-0 text-right font-medium text-brand">
								{metricCardsCount > 0 ? `${metricCardsCount} cards + ` : null}
								{state.selectedMetrics.length} charts
								{state.includeTable ? ' + 1 table' : null}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
