import * as Ariakit from '@ariakit/react'
import { useMemo, useState } from 'react'
import { Icon } from '~/components/Icon'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { selectTriggerStyles } from '~/components/Select/types'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import {
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName,
	popoverRowWithBorderStyles,
	popoverSingleSelectCheckStyles,
	popoverSurfaceStyles
} from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import {
	activeEquityFiltersToDraft,
	countActiveEquityFilters,
	countDraftEquityFilters,
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
	type EquityFilterConfig,
	type EquityNumericFilterConfig,
	type EquityNumericOperator
} from './filters'
import type { IEquitiesListCompanyRow } from './types'

const OPERATOR_OPTIONS: Array<{ value: EquityNumericOperator; label: string }> = [
	{ value: '>=', label: '>=' },
	{ value: '>', label: '>' },
	{ value: '<=', label: '<=' },
	{ value: '<', label: '<' },
	{ value: 'between', label: 'between' }
]

const CATEGORICAL_VALUE_LABELS: Record<EquityCategoricalFilterField, string> = {
	country: 'Countries',
	sector: 'Sectors',
	industry: 'Industries'
}

const CATEGORY_LABELS: Record<EquityFilterCategory, string> = EQUITY_FILTER_CATEGORIES.reduce(
	(acc, category) => {
		acc[category.key] = category.label
		return acc
	},
	{} as Record<EquityFilterCategory, string>
)

function getUniqueValues(companies: IEquitiesListCompanyRow[], key: 'country' | 'sector' | 'industry'): string[] {
	const values = new Set<string>()
	for (const company of companies) {
		if (company[key]) values.add(company[key])
	}
	return Array.from(values).sort((a, b) => a.localeCompare(b))
}

function replaceFilter(filters: EquityDraftFilter[], nextFilter: EquityDraftFilter): EquityDraftFilter[] {
	const next = filters.slice()
	const index = next.findIndex((filter) => filter.id === nextFilter.id)
	if (index === -1) next.push(nextFilter)
	else next[index] = nextFilter
	return next
}

function removeFilter(filters: EquityDraftFilter[], id: string): EquityDraftFilter[] {
	return filters.filter((filter) => filter.id !== id)
}

function FilterDescription({ config }: { config: EquityFilterConfig }) {
	if (!config.description) return null

	return (
		<Tooltip content={config.description} placement="top">
			<Icon name="circle-help" className="size-3 text-tertiary" />
		</Tooltip>
	)
}

function OperatorSelect({
	value,
	onChange
}: {
	value: EquityNumericOperator
	onChange: (operator: EquityNumericOperator) => void
}) {
	return (
		<Ariakit.SelectProvider value={value} setValue={(nextValue) => onChange(nextValue as EquityNumericOperator)}>
			<Ariakit.Select className={`${selectTriggerStyles('input', 'md')} shrink-0`}>
				<Ariakit.SelectValue />
				<Ariakit.SelectArrow />
			</Ariakit.Select>
			<Ariakit.SelectPopover
				portal
				gutter={6}
				sameWidth
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={`${popoverSurfaceStyles} z-100`}
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>
				{OPERATOR_OPTIONS.map((operator) => (
					<Ariakit.SelectItem key={operator.value} value={operator.value} className={popoverRowWithBorderStyles}>
						<span>{operator.label}</span>
						<span className={popoverSingleSelectCheckStyles(operator.value === value)} aria-hidden>
							<Icon name="check" className="size-3" />
						</span>
					</Ariakit.SelectItem>
				))}
			</Ariakit.SelectPopover>
		</Ariakit.SelectProvider>
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
		<div
			role="group"
			aria-label="Match mode"
			className="flex min-h-8 shrink-0 items-center gap-0.5 rounded-lg border border-medium bg-page p-0.5 label-sm"
		>
			{MODE_OPTIONS.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => onChange(option.value)}
					data-active={value === option.value}
					aria-pressed={value === option.value}
					className="flex cursor-pointer items-center self-stretch rounded-md px-2.5 text-secondary hover:text-primary data-[active=true]:bg-brand data-[active=true]:text-on-brand"
				>
					{option.label}
				</button>
			))}
		</div>
	)
}

function NumericInput({
	value,
	onChange,
	placeholder,
	prefix,
	suffix
}: {
	value: string
	onChange: (value: string) => void
	placeholder: string
	prefix?: string
	suffix?: string
}) {
	return (
		<label className="flex min-h-8 min-w-0 flex-1 items-center gap-1 rounded-lg border border-medium bg-page px-3 py-1.5 label-sm text-primary focus-within:border-brand">
			{prefix ? <span className="text-tertiary">{prefix}</span> : null}
			<input
				type="text"
				inputMode="decimal"
				value={value}
				onChange={(event) => onChange(event.currentTarget.value)}
				placeholder={placeholder}
				className="min-w-0 flex-1 bg-transparent outline-hidden placeholder:text-tertiary"
			/>
			{suffix ? <span className="text-tertiary">{suffix}</span> : null}
		</label>
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
		<Card padding="sm" className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate label-sm text-primary">{config.label}</span>
					<FilterDescription config={config} />
					<span className="rounded-full bg-surface-elevated-2 px-1.5 py-0.5 label-xs text-secondary uppercase">
						{CATEGORY_LABELS[config.category]}
					</span>
				</div>
				<Button type="button" variant="ghost" size="sm" square onClick={onRemove}>
					<Icon name="x" className="size-3.5" />
					<span className="sr-only">Remove {config.label} filter</span>
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<OperatorSelect value={operator} onChange={updateOperator} />
				{isBetween ? (
					<>
						<NumericInput
							value={inputs.minValue}
							onChange={updateMinValue}
							placeholder="Min"
							prefix={prefix}
							suffix={suffix}
						/>
						<NumericInput
							value={inputs.maxValue}
							onChange={updateMaxValue}
							placeholder="Max"
							prefix={prefix}
							suffix={suffix}
						/>
					</>
				) : (
					<NumericInput
						value={inputs.value}
						onChange={updateValue}
						placeholder="10b, 500m, 20"
						prefix={prefix}
						suffix={suffix}
					/>
				)}
			</div>
		</Card>
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
	options: string[]
	onUpdate: (filter: EquityDraftFilter) => void
	onRemove: () => void
}) {
	const values = filter.values
	const mode = filter.mode
	const valueLabel = CATEGORICAL_VALUE_LABELS[config.field]

	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-1.5">
					<span className="truncate label-sm text-primary">{config.label}</span>
					<span className="rounded-full bg-surface-elevated-2 px-1.5 py-0.5 label-xs text-secondary uppercase">
						{CATEGORY_LABELS[config.category]}
					</span>
				</div>
				<Button type="button" variant="ghost" size="sm" square onClick={onRemove}>
					<Icon name="x" className="size-3.5" />
					<span className="sr-only">Remove {config.label} filter</span>
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<ModeToggle value={mode} onChange={(nextMode) => onUpdate({ ...filter, mode: nextMode })} />
				<SelectWithCombobox
					allValues={options}
					selectedValues={values}
					setSelectedValues={(next) => onUpdate({ ...filter, values: next })}
					label={valueLabel}
					labelType="smol"
					variant="default"
					size="sm"
					visibleOptionLimit={null}
					selectAllScope="matches"
					searchPlaceholder={`Search ${valueLabel.toLowerCase()}...`}
					emptyLabel="No matches found"
					popoverClassName="z-100 max-sm:h-[88dvh]! max-sm:max-h-[88dvh] max-sm:w-full sm:min-w-[260px] sm:max-h-[min(360px,60dvh)]! lg:max-h-[min(360px,60dvh)]!"
					triggerProps={{
						'aria-label': `${valueLabel} values`,
						className: `${selectTriggerStyles('input', 'md')} flex-1`
					}}
				/>
			</div>
		</Card>
	)
}

function ActiveFilterEditor({
	filter,
	categoricalOptions,
	onUpdate,
	onRemove
}: {
	filter: EquityDraftFilter
	categoricalOptions: Record<string, string[]>
	onUpdate: (filter: EquityDraftFilter) => void
	onRemove: () => void
}) {
	if (filter.kind === 'categorical') {
		const config = getEquityCategoricalFilterConfig(filter.id)
		return (
			<CategoricalFilterEditor
				config={config}
				filter={filter}
				options={categoricalOptions[config.field] ?? []}
				onUpdate={onUpdate}
				onRemove={onRemove}
			/>
		)
	}

	const config = getEquityNumericFilterConfig(filter.id)
	return <NumericFilterEditor config={config} filter={filter} onUpdate={onUpdate} onRemove={onRemove} />
}

interface EquitiesFiltersDialogProps {
	companies: IEquitiesListCompanyRow[]
	filters: EquityActiveFilter[]
	onFiltersChange: (filters: EquityActiveFilter[]) => void
}

export function EquitiesFiltersDialog({ companies, filters, onFiltersChange }: EquitiesFiltersDialogProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [draftFilters, setDraftFilters] = useState<EquityDraftFilter[]>(() => activeEquityFiltersToDraft(filters))
	const isSmallScreen = useMedia('(max-width: 639px)')

	const activeCount = countActiveEquityFilters(filters)
	const draftActiveCount = countDraftEquityFilters(draftFilters)

	const categoricalOptions = useMemo(
		() => ({
			country: getUniqueValues(companies, 'country'),
			sector: getUniqueValues(companies, 'sector'),
			industry: getUniqueValues(companies, 'industry')
		}),
		[companies]
	)

	const groupedAvailableFilters = useMemo(() => {
		const activeIds = new Set(draftFilters.map((filter) => filter.id))
		const normalizedSearch = search.trim().toLowerCase()
		const groups = new Map<EquityFilterCategory, EquityFilterConfig[]>()
		for (const category of EQUITY_FILTER_CATEGORIES) {
			groups.set(category.key, [])
		}

		for (const config of EQUITY_FILTER_CONFIGS) {
			if (activeIds.has(config.id)) continue
			if (
				normalizedSearch &&
				!config.label.toLowerCase().includes(normalizedSearch) &&
				!config.id.toLowerCase().includes(normalizedSearch)
			) {
				continue
			}
			groups.get(config.category)!.push(config)
		}

		return EQUITY_FILTER_CATEGORIES.map((category) => ({
			...category,
			filters: groups.get(category.key) ?? []
		})).filter((category) => category.filters.length > 0)
	}, [draftFilters, search])

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraftFilters(activeEquityFiltersToDraft(filters))
			setSearch('')
		}
		setOpen(nextOpen)
	}

	const addFilter = (config: EquityFilterConfig) => {
		setDraftFilters((currentFilters) =>
			currentFilters.some((filter) => filter.id === config.id)
				? currentFilters
				: currentFilters.concat(createDefaultEquityDraftFilter(config))
		)
	}

	const commitFilters = () => {
		onFiltersChange(draftEquityFiltersToActive(draftFilters))
		setOpen(false)
	}

	return (
		<Ariakit.DialogProvider open={open} setOpen={handleOpenChange}>
			<Ariakit.DialogDisclosure render={<Button type="button" size="md" />}>
				<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs leading-none">
					{activeCount}
				</span>
				<span>Filters</span>
				<Icon name="settings" className="size-3.5" />
			</Ariakit.DialogDisclosure>
			<Ariakit.Dialog
				className={`${dialogSurfaceStyles} [--dialog-width:860px] sm:max-h-[min(760px,calc(100%-32px))]`}
				unmountOnHide
				portal
			>
				<div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3">
					<div className="flex items-baseline gap-2.5">
						<DialogHeading>Filters</DialogHeading>
						<span className="text-xs text-tertiary">
							{draftActiveCount}/{EQUITY_FILTER_CONFIGS.length}
						</span>
					</div>
					<DialogCloseButton className="-mr-1" />
				</div>

				<div className="border-b border-subtle px-4 py-3">
					<label className="relative block">
						<span className="sr-only">Search filters</span>
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<Input
							type="text"
							name="search"
							inputMode="search"
							placeholder={`Search ${EQUITY_FILTER_CONFIGS.length} filters...`}
							autoFocus={!isSmallScreen}
							value={search}
							className="w-full pr-9 pl-8"
							onChange={(event) => setSearch(event.currentTarget.value)}
						/>
						{search ? (
							<button
								type="button"
								onClick={() => setSearch('')}
								className="absolute top-0 right-2 bottom-0 my-auto flex size-5 items-center justify-center rounded-sm text-tertiary hover:bg-hover-row hover:text-primary"
							>
								<Icon name="x" className="size-3.5" />
								<span className="sr-only">Clear search</span>
							</button>
						) : null}
					</label>
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] sm:overflow-hidden">
					<section className="order-2 flex min-h-0 flex-col border-t border-subtle max-sm:shrink-0 sm:order-1 sm:border-t-0 sm:border-r">
						<div className="border-b border-subtle px-4 py-2">
							<h3 className="label-sm text-secondary">Browse filters</h3>
						</div>
						<div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 max-sm:overflow-visible">
							{groupedAvailableFilters.map((group) => (
								<section key={group.key} className="flex flex-col gap-2">
									<div className="flex items-baseline gap-1.5">
										<span className="label-xs tracking-wide text-tertiary uppercase">{group.label}</span>
										<span className="body-xs text-tertiary/70">· {group.filters.length}</span>
									</div>
									<div className="flex flex-wrap gap-1">
										{group.filters.map((config) => (
											<button
												key={config.id}
												type="button"
												onClick={() => addFilter(config)}
												className="group flex items-center gap-1.5 rounded-full border border-subtle bg-transparent px-2.5 py-1 text-xs text-primary transition-[background-color,border-color,color] duration-150 ease-out hover:border-brand hover:bg-hover-row focus-visible:border-brand focus-visible:bg-hover-row"
											>
												<Icon name="plus" className="size-3 text-tertiary group-hover:text-link" />
												<span>{config.label}</span>
											</button>
										))}
									</div>
								</section>
							))}

							{groupedAvailableFilters.length === 0 ? (
								<div className="flex flex-col items-center gap-1 py-8 text-center">
									<p className="body-sm text-tertiary">No filters match "{search}".</p>
									<button
										type="button"
										onClick={() => setSearch('')}
										className="text-xs text-secondary underline-offset-2 hover:text-primary hover:underline"
									>
										Clear search
									</button>
								</div>
							) : null}
						</div>
					</section>

					<section className="order-1 flex min-h-0 flex-col max-sm:shrink-0 sm:order-2">
						<div className="border-b border-subtle px-4 py-2">
							<h3 className="label-sm text-secondary">Active filters</h3>
						</div>
						<div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4 max-sm:overflow-visible">
							{draftFilters.length > 0 ? (
								draftFilters.map((filter) => (
									<ActiveFilterEditor
										key={filter.id}
										filter={filter}
										categoricalOptions={categoricalOptions}
										onUpdate={(nextFilter) =>
											setDraftFilters((currentFilters) => replaceFilter(currentFilters, nextFilter))
										}
										onRemove={() => setDraftFilters((currentFilters) => removeFilter(currentFilters, filter.id))}
									/>
								))
							) : (
								<div className="rounded-md border border-dashed border-subtle bg-page p-4 text-sm text-tertiary">
									<span className="sm:hidden">Add filters from the list below to narrow the table.</span>
									<span className="max-sm:hidden">Add filters from the left to narrow the table.</span>
								</div>
							)}
						</div>
					</section>
				</div>

				<div className="flex items-center justify-between gap-2 border-t border-subtle bg-overlay px-4 py-3">
					{draftFilters.length > 0 ? (
						<Button type="button" variant="ghost" size="md" onClick={() => setDraftFilters([])}>
							Clear all
						</Button>
					) : (
						<span className="label-sm text-tertiary">No filters selected</span>
					)}
					<div className="flex items-center gap-2">
						<Ariakit.DialogDismiss render={<Button type="button" size="md" />}>Cancel</Ariakit.DialogDismiss>
						<Button type="button" variant="primary" size="md" onClick={commitFilters}>
							Done
						</Button>
					</div>
				</div>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

export function EquityActiveFilterPills({
	filters,
	onRemove
}: {
	filters: EquityActiveFilter[]
	onRemove: (id: string) => void
}) {
	if (filters.length === 0) return null

	return (
		<div className="flex flex-wrap gap-1">
			{filters.map((filter) => (
				<button
					key={filter.id}
					type="button"
					onClick={() => onRemove(filter.id)}
					className="hover-wash group flex items-center gap-1 rounded-full border border-brand bg-brand-muted px-2 py-1 text-xs text-primary"
				>
					<span>{formatEquityActiveFilter(filter)}</span>
					<Icon name="x" className="size-3 text-secondary group-hover:text-primary" />
				</button>
			))}
		</div>
	)
}
