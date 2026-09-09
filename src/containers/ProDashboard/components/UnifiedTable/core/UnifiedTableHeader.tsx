import { Icon } from '~/ui/Icon'
import type { UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
import { ProCardOverflowMenu } from '../../ProCardActions'
import type { ActiveFilterChip } from '../utils/filterChips'
import type { CsvExportLevel } from './csvExportLevels'

interface GroupingOption {
	id: string
	label: string
}

interface UnifiedTableHeaderProps {
	title: string
	scopeDescription: string
	rowHeadersSummary: string | null
	onCustomizeColumns?: (() => void) | undefined
	onDuplicate?: (() => void) | undefined
	onCsvExport?: (() => void | Promise<void>) | undefined
	onCsvExportLevel?: ((level: CsvExportLevel) => void | Promise<void>) | undefined
	rowHeaders?: Array<UnifiedRowHeaderType>
	isExportDisabled?: boolean
	isLoading?: boolean
	onSearchChange: (value: string) => void
	filterChips: Array<ActiveFilterChip>
	onFilterRemove?: ((chip: ActiveFilterChip) => void) | undefined
	onClearFilters?: (() => void) | undefined
	filtersEditable?: boolean
	activeFilterCount: number
	onFiltersClick?: (() => void) | undefined
	groupingOptions?: Array<GroupingOption>
	selectedGroupingId?: string | undefined
	onGroupingChange?: ((optionId: string) => void) | undefined
}

export function UnifiedTableHeader({
	title,
	scopeDescription,
	rowHeadersSummary,
	onCustomizeColumns,
	onDuplicate,
	onCsvExport,
	onCsvExportLevel,
	rowHeaders,
	isExportDisabled = false,
	isLoading = false,
	onSearchChange,
	filterChips,
	onFilterRemove,
	onClearFilters,
	filtersEditable = false,
	activeFilterCount,
	onFiltersClick,
	groupingOptions,
	selectedGroupingId,
	onGroupingChange
}: UnifiedTableHeaderProps) {
	const hasCsvLevels = Boolean(rowHeaders && rowHeaders.length > 1 && onCsvExportLevel)
	const hasFilters = filterChips.length > 0
	const canMutateFilters = filtersEditable && Boolean(onFilterRemove)
	const isGroupingInteractive = Boolean(onGroupingChange)
	const groupingSelectValue = groupingOptions
		? groupingOptions.find((option) => option.id === selectedGroupingId)?.id || groupingOptions[0]?.id || ''
		: ''

	return (
		<div className="mb-3 flex flex-col gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex min-w-0 flex-col gap-1">
					<h3 className="text-base font-semibold text-pro-text-primary">{title}</h3>
					<div className="flex flex-wrap gap-2 text-xs text-pro-text-secondary">
						<span>{scopeDescription}</span>
						{rowHeadersSummary ? (
							<>
								<span>•</span>
								<span>Grouped by {rowHeadersSummary}</span>
							</>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-2">
					{isGroupingInteractive && groupingOptions?.length ? (
						<div className="relative">
							<select
								aria-label="Group table rows"
								value={groupingSelectValue}
								onChange={(event) => onGroupingChange?.(event.target.value)}
								className="appearance-none rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 pr-8 text-sm text-pro-text-primary transition-colors"
							>
								{groupingOptions.map((option) => (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								))}
							</select>
							<Icon
								name="chevron-down"
								height={14}
								width={14}
								className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-pro-text-tertiary"
							/>
						</div>
					) : null}
					{onFiltersClick ? (
						<button
							type="button"
							onClick={onFiltersClick}
							className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
								activeFilterCount
									? 'border-brand bg-brand/10 text-brand'
									: 'pro-border pro-hover-bg pro-panel-bg text-pro-text-primary'
							}`}
						>
							<span>Filters</span>
							<span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-pro-cards-border px-1 text-xs font-semibold text-pro-text-secondary">
								{activeFilterCount}
							</span>
						</button>
					) : null}

					{onCustomizeColumns ? (
						<button
							type="button"
							onClick={onCustomizeColumns}
							className="inline-flex items-center gap-2 rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary"
						>
							<Icon name="settings" height={14} width={14} />
							<span>Customize Columns</span>
						</button>
					) : null}
					<ProCardOverflowMenu
						onDuplicate={onDuplicate}
						disabled={isExportDisabled}
						csvLevels={
							hasCsvLevels && onCsvExportLevel && rowHeaders
								? { rowHeaders, onExport: onCsvExportLevel, isLoading }
								: undefined
						}
						csv={!hasCsvLevels && onCsvExport ? { onClick: onCsvExport, isLoading } : undefined}
					/>
				</div>
			</div>

			<div className="mt-2 flex flex-col gap-2">
				<div className="relative w-full">
					<Icon
						name="search"
						height={16}
						width={16}
						className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-pro-text-tertiary"
					/>
					<input
						type="search"
						aria-label="Search table rows"
						onInput={(event) => onSearchChange(event.currentTarget.value)}
						placeholder="Search protocols, chains, categories..."
						className="w-full rounded-md border border-subtle bg-pro-cards-bg py-2 pr-3 pl-9 text-sm text-pro-text-primary focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-hidden"
					/>
				</div>
				{hasFilters ? (
					<div className="flex flex-wrap items-center gap-2">
						{filterChips.map((chip) => (
							<span
								key={chip.id}
								className="inline-flex items-center gap-1 rounded-full border border-pro-cards-border bg-pro-cards-bg px-2 py-1 text-xs text-pro-text-secondary"
							>
								<span className="font-medium text-pro-text-primary">{chip.label}</span>
								{chip.value ? <span className="text-pro-text-secondary">: {chip.value}</span> : null}
								{canMutateFilters ? (
									<button
										type="button"
										onClick={() => onFilterRemove?.(chip)}
										className="ml-1 rounded-full p-0.5 text-pro-text-tertiary transition-colors hover:bg-border-subtle hover:text-pro-text-primary"
										aria-label={`Remove filter: ${chip.label}`}
									>
										<Icon name="x" height={12} width={12} />
									</button>
								) : null}
							</span>
						))}
						{hasFilters && canMutateFilters && onClearFilters ? (
							<button type="button" onClick={onClearFilters} className="text-xs font-medium text-brand hover:underline">
								Clear all filters
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	)
}
