import * as Ariakit from '@ariakit/react'
import { useMemo, useState } from 'react'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import {
	FILTER_CATEGORIES,
	FILTER_CONFIGS,
	formatFilterValue,
	getFiltersByCategory,
	getFiltersForProtocols,
	type FilterCategory,
	type FilterConfig,
	type NumericOperator
} from './filterConfig'

interface FilterBuilderProps {
	filters: UnifiedTableFilters | undefined
	onFiltersChange: (filters: UnifiedTableFilters) => void
}

interface ActiveFilter {
	config: FilterConfig
	operator: NumericOperator | undefined
	value: number | undefined
	minValue: number | undefined
	maxValue: number | undefined
	enabled: boolean | undefined
}

const OPERATORS: Array<{ value: NumericOperator; label: string }> = [
	{ value: '>=', label: '>=' },
	{ value: '>', label: '>' },
	{ value: '<=', label: '<=' },
	{ value: '<', label: '<' },
	{ value: 'between', label: 'between' }
]

function parseNumberWithAbbreviation(input: string): number | undefined {
	const cleaned = input.trim().toLowerCase()
	if (!cleaned) return undefined
	const match = cleaned.match(/^(-?\d+\.?\d*)\s*([kmb])?$/)
	if (!match) return undefined

	const numStr = match[1]
	const suffix = match[2]
	if (numStr === undefined) return undefined
	const base = parseFloat(numStr)
	if (Number.isNaN(base)) return undefined
	if (suffix === 'k') return base * 1000
	if (suffix === 'm') return base * 1_000_000
	if (suffix === 'b') return base * 1_000_000_000
	return base
}

function filtersToActiveFilters(filters: UnifiedTableFilters | undefined): Array<ActiveFilter> {
	if (!filters) return []

	const result: Array<ActiveFilter> = []
	const relevantConfigs = getFiltersForProtocols()

	for (const config of relevantConfigs) {
		if (config.type === 'boolean') {
			if (filters[config.booleanKey]) {
				result.push({
					config,
					enabled: true,
					operator: undefined,
					value: undefined,
					minValue: undefined,
					maxValue: undefined
				})
			}
		} else if (config.type === 'numeric-single') {
			const value = filters[config.minKey]
			if (value !== undefined) {
				result.push({
					config,
					value,
					enabled: undefined,
					operator: undefined,
					minValue: undefined,
					maxValue: undefined
				})
			}
		} else if (config.type === 'numeric-range') {
			const minValue = filters[config.minKey]
			const maxValue = filters[config.maxKey]

			if (minValue !== undefined || maxValue !== undefined) {
				let operator: NumericOperator = '>'
				if (minValue !== undefined && maxValue !== undefined) {
					operator = 'between'
				} else if (maxValue !== undefined) {
					operator = '<='
				} else {
					operator = '>='
				}
				result.push({ config, operator, minValue, maxValue, value: undefined, enabled: undefined })
			}
		}
	}

	return result
}

function activeFilterToTableFilters(
	activeFilters: Array<ActiveFilter>,
	existingFilters: UnifiedTableFilters | undefined
): UnifiedTableFilters {
	const result: UnifiedTableFilters = { ...existingFilters }

	for (const config of FILTER_CONFIGS) {
		if (config.type === 'boolean') {
			delete result[config.booleanKey]
		} else if (config.type === 'numeric-range') {
			delete result[config.minKey]
			delete result[config.maxKey]
		} else if (config.type === 'numeric-single') {
			delete result[config.minKey]
		}
	}

	for (const filter of activeFilters) {
		const { config, operator, value, minValue, maxValue, enabled } = filter

		if (config.type === 'boolean' && enabled) {
			result[config.booleanKey] = true
		} else if (config.type === 'numeric-single' && value !== undefined) {
			result[config.minKey] = value
		} else if (config.type === 'numeric-range') {
			if (operator === 'between') {
				if (minValue !== undefined) result[config.minKey] = minValue
				if (maxValue !== undefined) result[config.maxKey] = maxValue
			} else if (operator === '>' || operator === '>=') {
				if (value !== undefined) result[config.minKey] = value
				else if (minValue !== undefined) result[config.minKey] = minValue
			} else if (operator === '<' || operator === '<=') {
				if (value !== undefined) result[config.maxKey] = value
				else if (maxValue !== undefined) result[config.maxKey] = maxValue
			}
		}
	}

	return result
}

const CATEGORY_COLORS: Record<FilterCategory, string> = {
	metrics: 'bg-brand/15 text-link border-brand/30',
	volume: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
	fees: 'bg-success/15 text-success border-success/30',
	revenue: 'bg-success/15 text-success border-emerald-500/30',
	changes: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
	dominance: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
	aggregators: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
	'chain-metrics': 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
	flags: 'bg-warning/15 text-warning border-warning/30'
}

const CATEGORY_BADGE_COLORS: Record<FilterCategory, string> = {
	metrics: 'bg-brand/20 text-link',
	volume: 'bg-purple-500/20 text-purple-400',
	fees: 'bg-success/20 text-success',
	revenue: 'bg-success/20 text-success',
	changes: 'bg-orange-500/20 text-orange-400',
	dominance: 'bg-pink-500/20 text-pink-400',
	aggregators: 'bg-cyan-500/20 text-cyan-400',
	'chain-metrics': 'bg-indigo-500/20 text-indigo-400',
	flags: 'bg-warning/20 text-warning'
}

const CATEGORY_LABELS: Record<FilterCategory, string> = {
	metrics: 'Metrics',
	volume: 'Volume',
	fees: 'Fees',
	revenue: 'Revenue',
	changes: 'Changes',
	dominance: 'Dominance',
	aggregators: 'Aggregators',
	'chain-metrics': 'Chain metrics',
	flags: 'Data availability'
}

const FILTERS_BY_CATEGORY = getFiltersByCategory()
const EMPTY_CATEGORY_FILTERS: Array<FilterConfig> = []

function buildDisplayValue(filter: ActiveFilter): string {
	const { config, operator, value, minValue, maxValue } = filter
	const format = config.format || 'currency'

	if (config.type === 'boolean') {
		return 'Enabled'
	}

	if (config.type === 'numeric-single' && value !== undefined) {
		return `= ${formatFilterValue(value, format)}`
	}

	if (operator === 'between' && minValue !== undefined && maxValue !== undefined) {
		return `${formatFilterValue(minValue, format)} - ${formatFilterValue(maxValue, format)}`
	}

	if (minValue !== undefined && maxValue === undefined) {
		return `${operator || '>='} ${formatFilterValue(minValue, format)}`
	}

	if (maxValue !== undefined && minValue === undefined) {
		return `${operator || '<='} ${formatFilterValue(maxValue, format)}`
	}

	if (value !== undefined) {
		return `${operator || '>='} ${formatFilterValue(value, format)}`
	}

	return 'Not set'
}

function getInitialInputs(currentFilter: ActiveFilter) {
	return {
		value:
			currentFilter.value?.toString() || currentFilter.minValue?.toString() || currentFilter.maxValue?.toString() || '',
		minValue: currentFilter.minValue?.toString() || '',
		maxValue: currentFilter.maxValue?.toString() || ''
	}
}

interface FilterItemEditorProps {
	filter: ActiveFilter
	onUpdate: (filter: ActiveFilter) => void
	onRemove: () => void
	isEditing: boolean
	onStartEdit: () => void
	onEndEdit: () => void
}

function FilterItemEditor({ filter, onUpdate, onRemove, isEditing, onStartEdit, onEndEdit }: FilterItemEditorProps) {
	const { config } = filter
	const [localInputs, setLocalInputs] = useState(() => getInitialInputs(filter))
	const localValue = localInputs.value
	const localMinValue = localInputs.minValue
	const localMaxValue = localInputs.maxValue

	const minAllowed = config.min ?? 0
	const prefix = config.format === 'currency' ? '$' : ''
	const suffix = config.format === 'percent' ? '%' : ''

	const handleValueChange = (input: string) => {
		setLocalInputs((prev) => ({ ...prev, value: input }))
		const parsed = parseNumberWithAbbreviation(input)
		if (parsed !== undefined && parsed >= minAllowed) {
			if (filter.operator === '>' || filter.operator === '>=' || !filter.operator) {
				onUpdate({ ...filter, value: parsed, minValue: parsed })
			} else {
				onUpdate({ ...filter, value: parsed, maxValue: parsed })
			}
		} else if (input === '') {
			onUpdate({ ...filter, value: undefined, minValue: undefined, maxValue: undefined })
		}
	}

	const handleMinValueChange = (input: string) => {
		setLocalInputs((prev) => ({ ...prev, minValue: input }))
		const parsed = parseNumberWithAbbreviation(input)
		if (parsed !== undefined && parsed >= minAllowed) {
			const currentMax = filter.maxValue
			if (currentMax !== undefined && parsed > currentMax) {
				onUpdate({ ...filter, minValue: currentMax, maxValue: parsed })
				setLocalInputs((prev) => ({ ...prev, minValue: currentMax.toString(), maxValue: parsed.toString() }))
			} else {
				onUpdate({ ...filter, minValue: parsed })
			}
		} else if (input === '') {
			onUpdate({ ...filter, minValue: undefined })
		}
	}

	const handleMaxValueChange = (input: string) => {
		setLocalInputs((prev) => ({ ...prev, maxValue: input }))
		const parsed = parseNumberWithAbbreviation(input)
		if (parsed !== undefined && parsed >= minAllowed) {
			const currentMin = filter.minValue
			if (currentMin !== undefined && parsed < currentMin) {
				onUpdate({ ...filter, minValue: parsed, maxValue: currentMin })
				setLocalInputs((prev) => ({ ...prev, minValue: parsed.toString(), maxValue: currentMin.toString() }))
			} else {
				onUpdate({ ...filter, maxValue: parsed })
			}
		} else if (input === '') {
			onUpdate({ ...filter, maxValue: undefined })
		}
	}

	const handleOperatorChange = (operator: NumericOperator) => {
		const currentValue = filter.value ?? filter.minValue ?? filter.maxValue
		if (operator === 'between') {
			onUpdate({
				...filter,
				operator,
				value: undefined,
				minValue: filter.minValue ?? currentValue,
				maxValue: filter.maxValue ?? currentValue
			})
			return
		}

		if (operator === '>' || operator === '>=') {
			onUpdate({
				...filter,
				operator,
				value: currentValue,
				minValue: currentValue,
				maxValue: undefined
			})
			return
		}

		onUpdate({
			...filter,
			operator,
			value: currentValue,
			maxValue: currentValue,
			minValue: undefined
		})
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === 'Escape') {
			onEndEdit()
		}
	}

	const handleStartEdit = () => {
		setLocalInputs(getInitialInputs(filter))
		onStartEdit()
	}

	const isBetween = filter.operator === 'between'
	const displayValue = buildDisplayValue(filter)
	const hasValue = filter.value !== undefined || filter.minValue !== undefined || filter.maxValue !== undefined
	const categoryLabel = CATEGORY_LABELS[config.category]
	const categoryBadge = (
		<span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-pro-text-tertiary uppercase">
			{categoryLabel}
		</span>
	)

	if (config.type === 'boolean') {
		return (
			<div
				className={`group flex items-start justify-between rounded-md border px-2.5 py-2 ${CATEGORY_COLORS[config.category]} ${isEditing ? 'shadow-sm ring-1 ring-brand/60' : ''}`}
			>
				<div className="flex min-w-0 flex-col gap-0.5">
					<div className="flex items-center gap-1.5">
						<Icon name="check" className="size-3" />
						<span className="truncate text-xs font-semibold">{config.label}</span>
						{config.description ? (
							<Tooltip content={config.description} placement="top">
								<Icon name="circle-help" className="size-3 opacity-50" />
							</Tooltip>
						) : null}
						{categoryBadge}
					</div>
					<span className="truncate text-xs opacity-80">{displayValue}</span>
				</div>
				<button
					type="button"
					onClick={onRemove}
					className="rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100!"
				>
					<Icon name="x" className="size-3" />
				</button>
			</div>
		)
	}

	if (!isEditing && hasValue) {
		return (
			<div
				className={`group flex items-start justify-between rounded-md border px-2.5 py-2 ${CATEGORY_COLORS[config.category]} ${isEditing ? 'shadow-sm ring-1 ring-brand/60' : ''}`}
			>
				<button type="button" onClick={handleStartEdit} className="flex min-w-0 flex-1 items-start gap-1.5 text-left">
					<div className="flex min-w-0 flex-col gap-0.5">
						<div className="flex items-center gap-1.5">
							<span className="truncate text-xs font-semibold">{config.label}</span>
							{config.description ? (
								<Tooltip content={config.description} placement="top">
									<Icon name="circle-help" className="size-3 opacity-50" />
								</Tooltip>
							) : null}
							{categoryBadge}
						</div>
						<span className="truncate text-xs opacity-80">{displayValue}</span>
					</div>
				</button>
				<button
					type="button"
					onClick={onRemove}
					className="rounded-sm p-0.5 opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100!"
				>
					<Icon name="x" className="size-3" />
				</button>
			</div>
		)
	}

	if (config.type === 'numeric-single') {
		return (
			<div
				className={`flex flex-col gap-1.5 rounded-md border p-2 ${CATEGORY_COLORS[config.category]} ${isEditing ? 'shadow-sm ring-1 ring-brand/60' : ''}`}
			>
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-1.5">
						<span className="truncate text-xs font-semibold">{config.label}</span>
						{config.description ? (
							<Tooltip content={config.description} placement="top">
								<Icon name="circle-help" className="size-3 opacity-50" />
							</Tooltip>
						) : null}
						{categoryBadge}
					</div>
					<button type="button" onClick={onRemove} className="rounded-sm p-0.5 opacity-60 hover:opacity-100">
						<Icon name="x" className="size-3" />
					</button>
				</div>
				<div className="flex items-center gap-1.5">
					{prefix ? <span className="text-xs opacity-70">{prefix}</span> : null}
					<input
						type="text"
						inputMode="decimal"
						value={localValue}
						onChange={(e) => handleValueChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="e.g. 10, 1k, 1m"
						className="h-6 flex-1 rounded-sm border border-current/20 bg-black/30 px-2 text-xs outline-hidden placeholder:opacity-50 focus:border-current/50"
					/>
					{suffix ? <span className="text-xs opacity-70">{suffix}</span> : null}
				</div>
				<button
					type="button"
					onClick={onEndEdit}
					className="h-6 rounded-sm border border-current/20 bg-black/30 px-2 text-xs opacity-70 transition-opacity hover:opacity-100"
				>
					Done
				</button>
			</div>
		)
	}

	return (
		<div
			className={`flex flex-col gap-1.5 rounded-md border p-2 ${CATEGORY_COLORS[config.category]} ${isEditing ? 'shadow-sm ring-1 ring-brand/60' : ''}`}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate text-xs font-semibold">{config.label}</span>
					{categoryBadge}
				</div>
				<button type="button" onClick={onRemove} className="rounded-sm p-0.5 opacity-60 hover:opacity-100">
					<Icon name="x" className="size-3" />
				</button>
			</div>
			<Ariakit.ComboboxProvider
				selectedValue={filter.operator || '>='}
				setSelectedValue={(value) => {
					const operator = OPERATORS.find((option) => option.value === value)?.value
					if (!operator) throw new Error(`Unsupported numeric filter operator: ${value}`)
					handleOperatorChange(operator)
				}}
			>
				<Ariakit.ComboboxSelect className="flex h-6 w-full cursor-pointer items-center justify-between rounded-sm border border-current/20 bg-black/30 px-2 text-xs outline-hidden focus:border-current/50">
					<Ariakit.ComboboxSelectedValue />
					<Ariakit.ComboboxSelectArrow />
				</Ariakit.ComboboxSelect>
				<Ariakit.ComboboxPopover
					portal
					gutter={4}
					sameWidth
					className="z-100 rounded-sm border border-pro-cards-border bg-pro-cards-bg py-1 shadow-lg"
				>
					{OPERATORS.map((op) => (
						<Ariakit.ComboboxItem
							key={op.value}
							value={op.value}
							className="cursor-pointer px-2.5 py-1 text-xs text-pro-text-primary hover:bg-(--cards-bg2) data-active-item:bg-(--cards-bg2)"
						>
							{op.label}
						</Ariakit.ComboboxItem>
					))}
				</Ariakit.ComboboxPopover>
			</Ariakit.ComboboxProvider>
			{isBetween ? (
				<div className="flex items-center gap-1.5">
					{prefix ? <span className="text-xs opacity-70">{prefix}</span> : null}
					<input
						type="text"
						inputMode="decimal"
						value={localMinValue}
						onChange={(e) => handleMinValueChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Min"
						className="h-6 flex-1 rounded-sm border border-current/20 bg-black/30 px-2 text-xs outline-hidden placeholder:opacity-50 focus:border-current/50"
					/>
					<span className="text-xs opacity-70">-</span>
					<input
						type="text"
						inputMode="decimal"
						value={localMaxValue}
						onChange={(e) => handleMaxValueChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Max"
						className="h-6 flex-1 rounded-sm border border-current/20 bg-black/30 px-2 text-xs outline-hidden placeholder:opacity-50 focus:border-current/50"
					/>
					{suffix ? <span className="text-xs opacity-70">{suffix}</span> : null}
				</div>
			) : (
				<div className="flex items-center gap-1.5">
					{prefix ? <span className="text-xs opacity-70">{prefix}</span> : null}
					<input
						type="text"
						inputMode="decimal"
						value={localValue}
						onChange={(e) => handleValueChange(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="e.g. 10, 1k, 1m"
						className="h-6 flex-1 rounded-sm border border-current/20 bg-black/30 px-2 text-xs outline-hidden placeholder:opacity-50 focus:border-current/50"
					/>
					{suffix ? <span className="text-xs opacity-70">{suffix}</span> : null}
				</div>
			)}
			<button
				type="button"
				onClick={onEndEdit}
				className="h-6 rounded-sm border border-current/20 bg-black/30 px-2 text-xs opacity-70 transition-opacity hover:opacity-100"
			>
				Done
			</button>
		</div>
	)
}

export function FilterBuilder({ filters, onFiltersChange }: FilterBuilderProps) {
	const [search, setSearch] = useState('')
	const [expandedCategories, setExpandedCategories] = useState<Set<FilterCategory>>(new Set(['metrics', 'flags']))
	const [pendingFilters, setPendingFilters] = useState<Array<ActiveFilter>>([])
	const [editingFilterId, setEditingFilterId] = useState<string | null>(null)

	const savedFilters = useMemo(() => filtersToActiveFilters(filters), [filters])

	const allActiveFilters = useMemo(() => {
		const savedIds = new Set(savedFilters.map((f) => f.config.id))
		const uniquePending = pendingFilters.filter((f) => !savedIds.has(f.config.id))
		return [...savedFilters, ...uniquePending]
	}, [savedFilters, pendingFilters])

	const activeFilterIds = useMemo(() => new Set(allActiveFilters.map((f) => f.config.id)), [allActiveFilters])

	const filteredCategories = useMemo(() => {
		const searchLower = search.toLowerCase()
		const result: Array<{ category: FilterCategory; label: string; filters: Array<FilterConfig> }> = []

		for (const { key, label } of FILTER_CATEGORIES) {
			const categoryFilters = FILTERS_BY_CATEGORY.get(key) ?? EMPTY_CATEGORY_FILTERS
			const matchingFilters = categoryFilters.filter((f) => f.label.toLowerCase().includes(searchLower))

			if (matchingFilters.length > 0) {
				result.push({ category: key, label, filters: matchingFilters })
			}
		}

		return result
	}, [search])

	const totalFiltersAvailable = useMemo(() => {
		let total = 0
		for (const categoryFilters of FILTERS_BY_CATEGORY.values()) {
			total += categoryFilters.length
		}
		return total
	}, [])

	const inactiveFiltersCount = Math.max(totalFiltersAvailable - activeFilterIds.size, 0)

	const visibleAvailableCount = useMemo(
		() =>
			filteredCategories.reduce(
				(sum, { filters: categoryFilters }) => sum + categoryFilters.filter((f) => !activeFilterIds.has(f.id)).length,
				0
			),
		[filteredCategories, activeFilterIds]
	)

	const handleAddFilter = (config: FilterConfig) => {
		if (activeFilterIds.has(config.id)) return

		if (config.type === 'boolean') {
			const newFilter: ActiveFilter = {
				config,
				enabled: true,
				operator: undefined,
				value: undefined,
				minValue: undefined,
				maxValue: undefined
			}
			const newFilters = activeFilterToTableFilters([...savedFilters, newFilter], filters)
			onFiltersChange(newFilters)
		} else {
			const newFilter: ActiveFilter = {
				config,
				operator: '>=',
				value: undefined,
				minValue: undefined,
				maxValue: undefined,
				enabled: undefined
			}
			setPendingFilters((prev) => [...prev, newFilter])
			setEditingFilterId(config.id)
		}
	}

	const handleUpdateFilter = (updatedFilter: ActiveFilter) => {
		const isPending = pendingFilters.some((f) => f.config.id === updatedFilter.config.id)

		if (isPending) {
			const hasValue =
				updatedFilter.value !== undefined ||
				updatedFilter.minValue !== undefined ||
				updatedFilter.maxValue !== undefined

			if (hasValue) {
				setPendingFilters((prev) => prev.filter((f) => f.config.id !== updatedFilter.config.id))
				const newFilters = activeFilterToTableFilters([...savedFilters, updatedFilter], filters)
				onFiltersChange(newFilters)
			} else {
				setPendingFilters((prev) => prev.map((f) => (f.config.id === updatedFilter.config.id ? updatedFilter : f)))
			}
		} else {
			const newActiveFilters = savedFilters.map((f) => (f.config.id === updatedFilter.config.id ? updatedFilter : f))
			const newFilters = activeFilterToTableFilters(newActiveFilters, filters)
			onFiltersChange(newFilters)
		}
	}

	const handleRemoveFilter = (filterId: string) => {
		const isPending = pendingFilters.some((f) => f.config.id === filterId)

		if (isPending) {
			setPendingFilters((prev) => prev.filter((f) => f.config.id !== filterId))
		} else {
			const newActiveFilters = savedFilters.filter((f) => f.config.id !== filterId)
			const newFilters = activeFilterToTableFilters(newActiveFilters, filters)
			onFiltersChange(newFilters)
		}
		if (editingFilterId === filterId) {
			setEditingFilterId(null)
		}
	}

	const handleClearAll = () => {
		setPendingFilters([])
		setEditingFilterId(null)
		const clearedFilters = activeFilterToTableFilters([], filters)
		onFiltersChange(clearedFilters)
	}

	const toggleCategory = (category: FilterCategory) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev)
			if (next.has(category)) {
				next.delete(category)
			} else {
				next.add(category)
			}
			return next
		})
	}

	const expandAllCategories = () => {
		setExpandedCategories(new Set(FILTERS_BY_CATEGORY.keys()))
	}

	const collapseAllCategories = () => {
		setExpandedCategories(new Set())
	}

	return (
		<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-3">
			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold tracking-wide text-pro-text-secondary uppercase">
							Browse filters
						</span>
						<span className="rounded-full bg-(--cards-bg2) px-2 py-0.5 text-xs text-pro-text-tertiary">
							{search
								? `${visibleAvailableCount} match${visibleAvailableCount === 1 ? '' : 'es'}`
								: `${inactiveFiltersCount} available`}
						</span>
					</div>
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={expandAllCategories}
							className="rounded-md border border-pro-cards-border px-2 py-1 text-xs text-pro-text-tertiary transition hover:text-pro-text-primary"
						>
							Expand all
						</button>
						<button
							type="button"
							onClick={collapseAllCategories}
							className="rounded-md border border-pro-cards-border px-2 py-1 text-xs text-pro-text-tertiary transition hover:text-pro-text-primary"
						>
							Collapse
						</button>
					</div>
				</div>
				<div className="relative">
					<Icon name="search" className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-pro-text-tertiary" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search filters..."
						aria-label="Search filters"
						className="h-8 w-full rounded-md border border-pro-cards-border bg-(--cards-bg2) pr-8 pl-8 text-xs text-pro-text-primary outline-hidden transition-colors focus:border-brand"
					/>
					{search ? (
						<button
							type="button"
							onClick={() => setSearch('')}
							className="absolute top-1/2 right-2.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm hover:bg-pro-cards-bg"
						>
							<Icon name="x" className="size-3 text-pro-text-tertiary" />
						</button>
					) : null}
				</div>
				<div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto pr-1">
					{filteredCategories.map(({ category, label, filters: categoryFilters }) => {
						const isExpanded = expandedCategories.has(category) || search.length > 0
						const availableFilters = categoryFilters.filter((f) => !activeFilterIds.has(f.id))
						const badgeColor = CATEGORY_BADGE_COLORS[category]

						if (availableFilters.length === 0 && !isExpanded) return null

						return (
							<div key={category} className="rounded-md border border-pro-cards-border bg-(--cards-bg2)">
								<button
									type="button"
									onClick={() => toggleCategory(category)}
									className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left transition-colors hover:bg-pro-cards-border/30"
								>
									<div className="flex items-center gap-2">
										<span className={`rounded-sm px-1.5 py-0.5 text-xs font-semibold ${badgeColor}`}>{label}</span>
										<span className="text-xs text-pro-text-tertiary">{availableFilters.length}</span>
									</div>
									<Icon
										name="chevron-down"
										className={`size-3.5 text-pro-text-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
									/>
								</button>
								{isExpanded && availableFilters.length > 0 ? (
									<div className="border-t border-pro-cards-border bg-pro-cards-bg p-1">
										{availableFilters.map((filter) => (
											<button
												key={filter.id}
												type="button"
												onClick={() => handleAddFilter(filter)}
												className="group flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1 text-left transition-all hover:bg-(--cards-bg2)"
											>
												<div className="flex items-center gap-1.5">
													<span className="truncate text-xs text-pro-text-primary">{filter.label}</span>
													{filter.description ? (
														<Tooltip content={filter.description} placement="right">
															<Icon name="circle-help" className="size-3 text-pro-text-tertiary opacity-50" />
														</Tooltip>
													) : null}
												</div>
												<Icon
													name="plus"
													className="size-3 shrink-0 text-pro-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
												/>
											</button>
										))}
									</div>
								) : null}
							</div>
						)
					})}
					{filteredCategories.length === 0 ? (
						<div className="flex items-center justify-between rounded-md border border-dashed border-pro-cards-border bg-(--cards-bg2) p-3 text-xs text-pro-text-tertiary">
							<span>No filters match "{search}".</span>
							<button
								type="button"
								onClick={() => setSearch('')}
								className="rounded-md border border-pro-cards-border px-2 py-1 text-xs text-pro-text-tertiary transition hover:text-pro-text-primary"
							>
								Clear search
							</button>
						</div>
					) : null}
				</div>
			</div>

			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-xs font-medium text-pro-text-secondary">Active ({allActiveFilters.length})</span>
					</div>
					{allActiveFilters.length > 0 ? (
						<button
							type="button"
							onClick={handleClearAll}
							className="cursor-pointer text-xs text-pro-text-tertiary transition-colors hover:text-error"
						>
							Clear all
						</button>
					) : null}
				</div>
				<div className="grid max-h-[260px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-start gap-1.5 overflow-y-auto pr-1">
					{allActiveFilters.length === 0 ? (
						<div className="flex flex-col items-center justify-center rounded-md border border-dashed border-pro-cards-border py-6 text-center">
							<Icon name="settings" className="mb-2 size-5 text-pro-text-tertiary" />
							<p className="text-xs text-pro-text-tertiary">
								No filters applied. Add from the left to start narrowing results.
							</p>
						</div>
					) : (
						allActiveFilters.map((filter) => {
							const isPending = pendingFilters.some((f) => f.config.id === filter.config.id)
							const isEditing = editingFilterId === filter.config.id || isPending
							return (
								<FilterItemEditor
									key={filter.config.id}
									filter={filter}
									onUpdate={handleUpdateFilter}
									onRemove={() => handleRemoveFilter(filter.config.id)}
									isEditing={isEditing}
									onStartEdit={() => setEditingFilterId(filter.config.id)}
									onEndEdit={() => setEditingFilterId(null)}
								/>
							)
						})
					)}
				</div>
			</div>
		</div>
	)
}
