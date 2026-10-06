import { useState } from 'react'
import {
	ActiveFilterCard,
	FilterBrowser,
	FilterBuilderContent,
	FilterBuilderDialog,
	FilterNumberInput,
	NoActiveFilters
} from '~/components/FilterBuilderDialog'
import { parseEquityFilterNumber } from '~/containers/Equities/filters'
import {
	getTokensFilterConfig,
	TOKENS_FILTER_CATEGORIES,
	TOKENS_FILTER_CONFIGS,
	type TokensActiveFilter,
	type TokensFilterCategory,
	type TokensFilterField
} from './filters'

const CATEGORY_LABELS = Object.fromEntries(
	TOKENS_FILTER_CATEGORIES.map((category) => [category.key, category.label])
) as Record<TokensFilterCategory, string>

interface TokensDraftFilter {
	id: TokensFilterField
	minInput: string
	maxInput: string
}

function activeFiltersToDraft(filters: Array<TokensActiveFilter>): Array<TokensDraftFilter> {
	return filters.map((filter) => ({
		id: filter.id,
		minInput: filter.min != null ? String(filter.min) : '',
		maxInput: filter.max != null ? String(filter.max) : ''
	}))
}

function draftFiltersToActive(drafts: Array<TokensDraftFilter>): Array<TokensActiveFilter> {
	const filters: Array<TokensActiveFilter> = []
	for (const draft of drafts) {
		const min = parseEquityFilterNumber(draft.minInput) ?? null
		const max = parseEquityFilterNumber(draft.maxInput) ?? null
		if (min == null && max == null) continue
		filters.push({ id: draft.id, min, max })
	}
	return filters
}

export function TokensFiltersDialog({
	filters,
	onFiltersChange
}: {
	filters: Array<TokensActiveFilter>
	onFiltersChange: (filters: Array<TokensActiveFilter>) => void
}) {
	return (
		<FilterBuilderDialog appliedCount={filters.length}>
			<TokensFiltersSession filters={filters} onFiltersChange={onFiltersChange} />
		</FilterBuilderDialog>
	)
}

function TokensFiltersSession({
	filters,
	onFiltersChange
}: {
	filters: Array<TokensActiveFilter>
	onFiltersChange: (filters: Array<TokensActiveFilter>) => void
}) {
	const [draftFilters, setDraftFilters] = useState(() => activeFiltersToDraft(filters))
	const activeIds = new Set(draftFilters.map((draft) => draft.id))
	const groups = TOKENS_FILTER_CATEGORIES.map((category) => ({
		label: category.label,
		filters: TOKENS_FILTER_CONFIGS.filter((config) => config.category === category.key && !activeIds.has(config.id))
	}))
	const updateDraft = (next: TokensDraftFilter) =>
		setDraftFilters((current) => current.map((item) => (item.id === next.id ? next : item)))

	return (
		<FilterBuilderContent
			draftCount={draftFilters.length}
			browse={
				<FilterBrowser
					groups={groups}
					onAdd={(id) => setDraftFilters((current) => current.concat({ id, minInput: '', maxInput: '' }))}
				/>
			}
			active={
				draftFilters.length > 0 ? (
					draftFilters.map((draft) => {
						const config = getTokensFilterConfig(draft.id)
						const prefix = config.format === 'currency' ? '$' : undefined
						const suffix = config.format === 'percent' ? '%' : undefined
						return (
							<ActiveFilterCard
								key={draft.id}
								label={config.label}
								category={CATEGORY_LABELS[config.category]}
								onRemove={() => setDraftFilters((current) => current.filter((item) => item.id !== draft.id))}
							>
								<div className="flex items-center gap-2">
									<FilterNumberInput
										label={`${config.label} minimum`}
										value={draft.minInput}
										onChange={(minInput) => updateDraft({ ...draft, minInput })}
										placeholder="Min"
										prefix={prefix}
										suffix={suffix}
									/>
									<FilterNumberInput
										label={`${config.label} maximum`}
										value={draft.maxInput}
										onChange={(maxInput) => updateDraft({ ...draft, maxInput })}
										placeholder="Max"
										prefix={prefix}
										suffix={suffix}
									/>
								</div>
							</ActiveFilterCard>
						)
					})
				) : (
					<NoActiveFilters />
				)
			}
			onClearAll={() => setDraftFilters([])}
			onApply={() => onFiltersChange(draftFiltersToActive(draftFilters))}
		/>
	)
}
