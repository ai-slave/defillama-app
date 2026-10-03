import { useState } from 'react'
import {
	ActiveFilterCard,
	FilterBrowser,
	FilterBuilderContent,
	FilterBuilderDialog,
	FilterNumberInput,
	NoActiveFilters
} from '~/components/FilterBuilderDialog'
import { Select } from '~/components/Select/Select'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SegmentedControl } from '~/ui/SegmentedControl'
import {
	activeEquityFiltersToDraft,
	countActiveEquityFilters,
	createDefaultEquityDraftFilter,
	draftEquityFiltersToActive,
	EQUITY_FILTER_CATEGORIES,
	EQUITY_FILTER_CONFIGS,
	formatEquityActiveFilter,
	getEquityCategoricalFilterConfig,
	getEquityDraftNumericOperator,
	getEquityNumericFilterConfig,
	parseEquityFilterNumber,
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

function replaceFilter(filters: Array<EquityDraftFilter>, nextFilter: EquityDraftFilter): Array<EquityDraftFilter> {
	const next = filters.slice()
	const index = next.findIndex((filter) => filter.id === nextFilter.id)
	if (index === -1) next.push(nextFilter)
	else next[index] = nextFilter
	return next
}

function removeFilter(filters: Array<EquityDraftFilter>, id: string): Array<EquityDraftFilter> {
	return filters.filter((filter) => filter.id !== id)
}

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

function getInitialNumericInputs(filter: EquityDraftNumericFilter) {
	if (filter.kind === 'numericRange') {
		return {
			value: '',
			minValue: filter.minValue?.toString() ?? '',
			maxValue: filter.maxValue?.toString() ?? ''
		}
	}

	return {
		value: filter.value?.toString() ?? '',
		minValue: '',
		maxValue: ''
	}
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
	const [inputs, setInputs] = useState(() => getInitialNumericInputs(filter))
	const operator = getEquityDraftNumericOperator(filter)
	const isBetween = operator === 'between'
	const prefix = config.format === 'currency' ? '$' : undefined
	const suffix = config.format === 'percent' ? '%' : undefined

	const updateValue = (input: string) => {
		setInputs((prev) => ({ ...prev, value: input }))
		const value = parseEquityFilterNumber(input)
		const comparisonOperator = operator === 'between' ? '>=' : operator
		onUpdate(
			value === undefined
				? { kind: 'numeric', id: filter.id, operator: comparisonOperator }
				: { kind: 'numeric', id: filter.id, operator: comparisonOperator, value }
		)
	}

	const updateMinValue = (input: string) => {
		setInputs((prev) => ({ ...prev, minValue: input }))
		const value = parseEquityFilterNumber(input)
		onUpdate({
			kind: 'numericRange',
			id: filter.id,
			...(value === undefined ? {} : { minValue: value }),
			...(filter.kind === 'numericRange' && filter.maxValue !== undefined ? { maxValue: filter.maxValue } : {})
		})
	}

	const updateMaxValue = (input: string) => {
		setInputs((prev) => ({ ...prev, maxValue: input }))
		const value = parseEquityFilterNumber(input)
		onUpdate({
			kind: 'numericRange',
			id: filter.id,
			...(filter.kind === 'numericRange' && filter.minValue !== undefined ? { minValue: filter.minValue } : {}),
			...(value === undefined ? {} : { maxValue: value })
		})
	}

	const updateOperator = (nextOperator: EquityNumericOperator) => {
		const currentValue = filter.kind === 'numericRange' ? (filter.minValue ?? filter.maxValue) : filter.value
		if (nextOperator === 'between') {
			onUpdate({
				kind: 'numericRange',
				id: filter.id,
				...(filter.kind === 'numericRange' && filter.minValue !== undefined
					? { minValue: filter.minValue }
					: currentValue !== undefined
						? { minValue: currentValue }
						: {}),
				...(filter.kind === 'numericRange' && filter.maxValue !== undefined ? { maxValue: filter.maxValue } : {})
			})
			setInputs((prev) => ({
				...prev,
				minValue: prev.minValue || prev.value,
				value: ''
			}))
			return
		}

		onUpdate(
			currentValue === undefined
				? { kind: 'numeric', id: filter.id, operator: nextOperator }
				: { kind: 'numeric', id: filter.id, operator: nextOperator, value: currentValue }
		)
		setInputs((prev) => ({ ...prev, value: prev.value || prev.minValue || prev.maxValue }))
	}

	return (
		<ActiveFilterCard
			label={config.label}
			category={CATEGORY_LABELS[config.category]}
			description={config.description}
			onRemove={onRemove}
		>
			<div className="flex items-center gap-2">
				<OperatorSelect value={operator} onChange={updateOperator} />
				{isBetween ? (
					<>
						<FilterNumberInput
							label={`${config.label} minimum`}
							value={inputs.minValue}
							onChange={updateMinValue}
							placeholder="Min"
							prefix={prefix}
							suffix={suffix}
						/>
						<FilterNumberInput
							label={`${config.label} maximum`}
							value={inputs.maxValue}
							onChange={updateMaxValue}
							placeholder="Max"
							prefix={prefix}
							suffix={suffix}
						/>
					</>
				) : (
					<FilterNumberInput
						label={`${config.label} value`}
						value={inputs.value}
						onChange={updateValue}
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
		<FilterBuilderDialog appliedCount={countActiveEquityFilters(filters)}>
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
							onUpdate={(nextFilter) => setDraftFilters((current) => replaceFilter(current, nextFilter))}
							onRemove={() => setDraftFilters((current) => removeFilter(current, filter.id))}
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
	if (filters.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1">
			{filters.map((filter) => (
				<Button
					key={filter.id}
					type="button"
					variant="filter"
					size="sm"
					data-active="true"
					className="group"
					onClick={() => onRemove(filter.id)}
				>
					<span>{formatEquityActiveFilter(filter)}</span>
					<Icon name="x" className="size-3 text-secondary group-hover:text-primary" />
				</Button>
			))}
		</div>
	)
}
