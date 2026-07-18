import * as Ariakit from '@ariakit/react'
import { useMemo, useState } from 'react'
import { parseEquityFilterNumber } from '~/containers/Equities/filters'
import { useMedia } from '~/hooks/useMedia'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles } from '~/ui/Input'
import {
	formatTokensActiveFilter,
	getTokensFilterConfig,
	TOKENS_FILTER_CATEGORIES,
	TOKENS_FILTER_CONFIGS,
	type TokensActiveFilter,
	type TokensFilterCategory,
	type TokensFilterConfig,
	type TokensFilterField
} from './filters'

const CATEGORY_LABELS: Record<TokensFilterCategory, string> = TOKENS_FILTER_CATEGORIES.reduce(
	(acc, category) => {
		acc[category.key] = category.label
		return acc
	},
	{} as Record<TokensFilterCategory, string>
)

interface TokensDraftFilter {
	id: TokensFilterField
	minInput: string
	maxInput: string
}

function activeFiltersToDraft(filters: TokensActiveFilter[]): TokensDraftFilter[] {
	return filters.map((filter) => ({
		id: filter.id,
		minInput: filter.min != null ? String(filter.min) : '',
		maxInput: filter.max != null ? String(filter.max) : ''
	}))
}

function draftFiltersToActive(drafts: TokensDraftFilter[]): TokensActiveFilter[] {
	const filters: TokensActiveFilter[] = []
	for (const draft of drafts) {
		const min = parseEquityFilterNumber(draft.minInput) ?? null
		const max = parseEquityFilterNumber(draft.maxInput) ?? null
		if (min == null && max == null) continue
		filters.push({ id: draft.id, min, max })
	}
	return filters
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

function FilterEditor({
	config,
	draft,
	onUpdate,
	onRemove
}: {
	config: TokensFilterConfig
	draft: TokensDraftFilter
	onUpdate: (draft: TokensDraftFilter) => void
	onRemove: () => void
}) {
	const prefix = config.format === 'currency' ? '$' : undefined
	const suffix = config.format === 'percent' ? '%' : undefined

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
				<NumericInput
					value={draft.minInput}
					onChange={(minInput) => onUpdate({ ...draft, minInput })}
					placeholder="Min"
					prefix={prefix}
					suffix={suffix}
				/>
				<NumericInput
					value={draft.maxInput}
					onChange={(maxInput) => onUpdate({ ...draft, maxInput })}
					placeholder="Max"
					prefix={prefix}
					suffix={suffix}
				/>
			</div>
		</Card>
	)
}

export function TokensFiltersDialog({
	filters,
	onFiltersChange
}: {
	filters: TokensActiveFilter[]
	onFiltersChange: (filters: TokensActiveFilter[]) => void
}) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [draftFilters, setDraftFilters] = useState<TokensDraftFilter[]>(() => activeFiltersToDraft(filters))
	const isSmallScreen = useMedia('(max-width: 639px)')

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setDraftFilters(activeFiltersToDraft(filters))
			setSearch('')
		}
		setOpen(nextOpen)
	}

	const addFilter = (config: TokensFilterConfig) => {
		setDraftFilters((current) =>
			current.some((draft) => draft.id === config.id)
				? current
				: current.concat({ id: config.id, minInput: '', maxInput: '' })
		)
	}

	const commitFilters = () => {
		onFiltersChange(draftFiltersToActive(draftFilters))
		setOpen(false)
	}

	const groupedAvailableFilters = useMemo(() => {
		const activeIds = new Set(draftFilters.map((draft) => draft.id))
		const normalizedSearch = search.trim().toLowerCase()
		const groups = new Map<TokensFilterCategory, TokensFilterConfig[]>()
		for (const category of TOKENS_FILTER_CATEGORIES) {
			groups.set(category.key, [])
		}

		for (const config of TOKENS_FILTER_CONFIGS) {
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

		return TOKENS_FILTER_CATEGORIES.map((category) => ({
			...category,
			filters: groups.get(category.key) ?? []
		})).filter((category) => category.filters.length > 0)
	}, [draftFilters, search])

	return (
		<Ariakit.DialogProvider open={open} setOpen={handleOpenChange}>
			<Ariakit.DialogDisclosure render={<Button type="button" size="md" />}>
				<span className="flex min-w-4 items-center justify-center rounded-full border border-medium px-1 py-0.25 label-xs leading-none">
					{filters.length}
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
							{draftFilters.length}/{TOKENS_FILTER_CONFIGS.length}
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
							placeholder={`Search ${TOKENS_FILTER_CONFIGS.length} filters...`}
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
								draftFilters.map((draft) => (
									<FilterEditor
										key={draft.id}
										config={getTokensFilterConfig(draft.id)}
										draft={draft}
										onUpdate={(nextDraft) =>
											setDraftFilters((current) => current.map((item) => (item.id === nextDraft.id ? nextDraft : item)))
										}
										onRemove={() => setDraftFilters((current) => current.filter((item) => item.id !== draft.id))}
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

export function TokensActiveFilterPills({
	filters,
	onRemove
}: {
	filters: TokensActiveFilter[]
	onRemove: (id: TokensFilterField) => void
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
					<span>{formatTokensActiveFilter(filter)}</span>
					<Icon name="x" className="size-3 text-secondary group-hover:text-primary" />
				</button>
			))}
		</div>
	)
}
