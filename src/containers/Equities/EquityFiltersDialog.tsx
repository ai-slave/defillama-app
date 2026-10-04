import { useState } from 'react'
import {
	ActiveFilterCard,
	ActiveFilterPills,
	FilterBrowser,
	FilterBuilderContent,
	FilterBuilderDialog,
	FilterNumberInput,
	NoActiveFilters
} from '~/components/FilterBuilderDialog'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { SegmentedControl } from '~/ui/SegmentedControl'
import {
	activeEquityFiltersToDraft,
	createDefaultEquityDraftFilter,
	draftEquityFiltersToActive,
	EQUITY_FILTER_CATEGORIES,
	EQUITY_FILTER_CONFIGS,
	formatEquityActiveFilter,
	getEquityCategoricalFilterConfig,
	getEquityNumericFilterConfig,
	setEquityDraftOperator,
	type EquityActiveFilter,
	type EquityCategoricalFilterConfig,
	type EquityCategoricalFilterField,
	type EquityCategoricalMode,
	type EquityDraftCategoricalFilter,
	type EquityDraftFilter,
	type EquityDraftNumericFilter,
	type EquityFilterCategory,
	type EquityNumericFilterConfig,
	type EquityNumericOperator
} from './filters'
import type { EquitiesCategoricalOptions } from './types'

const OPERATOR_OPTIONS: Array<EquityNumericOperator> = ['>=', '>', '<=', '<', 'between']

const CATEGORICAL_VALUE_LABELS: Record<EquityCategoricalFilterField, string> = {
	country: 'Countries',
	sector: 'Sectors',
	industry: 'Industries'
}

const CATEGORY_LABELS = Object.fromEntries(
	EQUITY_FILTER_CATEGORIES.map((category) => [category.key, category.label])
) as Record<EquityFilterCategory, string>

function OperatorSelect({
	value,
	onChange
}: {
	value: EquityNumericOperator
	onChange: (operator: EquityNumericOperator) => void
}) {
	return (
		<Select
			heading="Operator"
			allValues={OPERATOR_OPTIONS}
			selectedValues={value}
			setSelectedValues={(nextValue) => onChange(nextValue as EquityNumericOperator)}
			label={value}
			labelType="none"
			variant="input"
			size="md"
			className="shrink-0"
			triggerProps={{ 'aria-label': 'Operator' }}
		/>
	)
}

const MODE_OPTIONS: Array<{ value: EquityCategoricalMode; label: string }> = [
	{ value: 'include', label: 'Include' },
	{ value: 'exclude', label: 'Exclude' }
]

function ModeToggle({
	value,
	onChange
}: {
	value: EquityCategoricalMode
	onChange: (mode: EquityCategoricalMode) => void
}) {
	return (
		<SegmentedControl
			label="Match mode"
			value={value}
			onValueChange={onChange}
			options={MODE_OPTIONS}
			variant="default"
			size="md"
			className="shrink-0"
		/>
	)
}

function NumericFilterEditor({
	config,
	filter,
	onUpdate,
	onRemove
}: {
	config: EquityNumericFilterConfig
	filter: EquityDraftNumericFilter
	onUpdate: (filter: EquityDraftFilter) => void
	onRemove: () => void
}) {
	const prefix = config.format === 'currency' ? '$' : undefined
	const suffix = config.format === 'percent' ? '%' : undefined

	return (
		<ActiveFilterCard
			label={config.label}
			category={CATEGORY_LABELS[config.category]}
			description={config.description}
			onRemove={onRemove}
		>
			<div className="flex items-center gap-2">
				<OperatorSelect
					value={filter.operator}
					onChange={(operator) => onUpdate(setEquityDraftOperator(filter, operator))}
				/>
				{filter.operator === 'between' ? (
					<>
						<FilterNumberInput
							label={`${config.label} minimum`}
							value={filter.minValue}
							onChange={(minValue) => onUpdate({ ...filter, minValue })}
							placeholder="Min"
							prefix={prefix}
							suffix={suffix}
						/>
						<FilterNumberInput
							label={`${config.label} maximum`}
							value={filter.maxValue}
							onChange={(maxValue) => onUpdate({ ...filter, maxValue })}
							placeholder="Max"
							prefix={prefix}
							suffix={suffix}
						/>
					</>
				) : (
					<FilterNumberInput
						label={`${config.label} value`}
						value={filter.value}
						onChange={(value) => onUpdate({ ...filter, value })}
						placeholder="10b, 500m, 20"
						prefix={prefix}
						suffix={suffix}
					/>
				)}
			</div>
		</ActiveFilterCard>
	)
}

function CategoricalFilterEditor({
	config,
	filter,
	options,
	onUpdate,
	onRemove
}: {
	config: EquityCategoricalFilterConfig
	filter: EquityDraftCategoricalFilter
	options: Array<string>
	onUpdate: (filter: EquityDraftFilter) => void
	onRemove: () => void
}) {
	const values = filter.values
	const mode = filter.mode
	const valueLabel = CATEGORICAL_VALUE_LABELS[config.field]

	return (
		<ActiveFilterCard label={config.label} category={CATEGORY_LABELS[config.category]} onRemove={onRemove}>
			<div className="flex items-center gap-2">
				<ModeToggle value={mode} onChange={(nextMode) => onUpdate({ ...filter, mode: nextMode })} />
				<SelectWithCombobox
					allValues={options}
					selectedValues={values}
					setSelectedValues={(next) => onUpdate({ ...filter, values: next })}
					label={valueLabel}
					labelType="smol"
					variant="input"
					size="md"
					visibleOptionLimit={null}
					selectAllScope="matches"
					searchPlaceholder={`Search ${valueLabel.toLowerCase()}...`}
					emptyLabel="No matches found"
					className="flex-1"
					triggerProps={{ 'aria-label': `${valueLabel} values` }}
				/>
			</div>
		</ActiveFilterCard>
	)
}

function ActiveFilterEditor({
	filter,
	categoricalOptions,
	onUpdate,
	onRemove
}: {
	filter: EquityDraftFilter
	categoricalOptions: EquitiesCategoricalOptions
	onUpdate: (filter: EquityDraftFilter) => void
	onRemove: () => void
}) {
	if (filter.kind === 'categorical') {
		const config = getEquityCategoricalFilterConfig(filter.id)
		return (
			<CategoricalFilterEditor
				config={config}
				filter={filter}
				options={categoricalOptions[config.field]}
				onUpdate={onUpdate}
				onRemove={onRemove}
			/>
		)
	}

	const config = getEquityNumericFilterConfig(filter.id)
	return <NumericFilterEditor config={config} filter={filter} onUpdate={onUpdate} onRemove={onRemove} />
}

interface EquitiesFiltersDialogProps {
	categoricalOptions: EquitiesCategoricalOptions
	filters: Array<EquityActiveFilter>
	onFiltersChange: (filters: Array<EquityActiveFilter>) => void
}

export function EquitiesFiltersDialog({ categoricalOptions, filters, onFiltersChange }: EquitiesFiltersDialogProps) {
	return (
		<FilterBuilderDialog appliedCount={filters.length}>
			<EquitiesFiltersSession
				categoricalOptions={categoricalOptions}
				filters={filters}
				onFiltersChange={onFiltersChange}
			/>
		</FilterBuilderDialog>
	)
}

function EquitiesFiltersSession({ categoricalOptions, filters, onFiltersChange }: EquitiesFiltersDialogProps) {
	const [draftFilters, setDraftFilters] = useState(() => activeEquityFiltersToDraft(filters))
	const activeIds = new Set(draftFilters.map((filter) => filter.id))
	const groups = EQUITY_FILTER_CATEGORIES.map((category) => ({
		label: category.label,
		filters: EQUITY_FILTER_CONFIGS.filter((config) => config.category === category.key && !activeIds.has(config.id))
	}))

	return (
		<FilterBuilderContent
			draftCount={draftFilters.length}
			browse={
				<FilterBrowser
					groups={groups}
					onAdd={(id) =>
						setDraftFilters((current) =>
							current.concat(createDefaultEquityDraftFilter(EQUITY_FILTER_CONFIGS.find((config) => config.id === id)!))
						)
					}
				/>
			}
			active={
				draftFilters.length > 0 ? (
					draftFilters.map((filter) => (
						<ActiveFilterEditor
							key={filter.id}
							filter={filter}
							categoricalOptions={categoricalOptions}
							onUpdate={(next) =>
								setDraftFilters((current) => current.map((item) => (item.id === next.id ? next : item)))
							}
							onRemove={() => setDraftFilters((current) => current.filter((item) => item.id !== filter.id))}
						/>
					))
				) : (
					<NoActiveFilters />
				)
			}
			onClearAll={() => setDraftFilters([])}
			onApply={() => onFiltersChange(draftEquityFiltersToActive(draftFilters))}
		/>
	)
}

export function EquityActiveFilterPills({
	filters,
	onRemove
}: {
	filters: Array<EquityActiveFilter>
	onRemove: (id: string) => void
}) {
	return (
		<ActiveFilterPills
			pills={filters.map((filter) => ({
				id: filter.id,
				label: formatEquityActiveFilter(filter),
				onRemove: () => onRemove(filter.id)
			}))}
		/>
	)
}
