import { useQuery } from '@tanstack/react-query'
import { matchSorter } from 'match-sorter'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { VirtualizedMultiSelect } from '~/components/Select/VirtualizedSelect'
import { TokenLogo } from '~/components/TokenLogo'
import { fetchChainsByCategory, fetchChainsCategories } from '~/containers/Chains/api'
import { useVirtualItems } from '~/hooks/useVirtualItems'
import { Button } from '~/ui/Button'
import { CheckboxIndicator } from '~/ui/Checkbox'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, searchFieldIconStyles, searchFieldInputPlacementStyles } from '~/ui/Input'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { chainIconUrl } from '~/utils/icons'
import { useProDashboardCatalog } from '../../../ProDashboardAPIContext'
import { useComparisonWizardContext } from '../ComparisonWizardContext'

interface Option {
	value: string
	label: string
	logo: string
	isChild?: boolean
	parentSlug?: string
}

async function fetchCategoryChains(category: string) {
	try {
		const data = await fetchChainsByCategory(category)
		return { category, chains: (data?.chainsUnique as Array<string>) || [] }
	} catch {
		return { category, chains: [] as Array<string> }
	}
}

export function SelectItemsStep() {
	const { state, actions } = useComparisonWizardContext()
	const { protocols, chains, protocolsLoading, protocolCatalog } = useProDashboardCatalog()
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	const [selectedCategories, setSelectedCategories] = useState<Array<string>>([])
	const listRef = useRef<HTMLDivElement>(null)
	// Clearing removes the control that did it; focus moves on to the search, where picking continues.
	const searchRef = useRef<HTMLInputElement>(null)

	const { data: chainCategoriesList } = useQuery({
		queryKey: ['pro-dashboard', 'chain-categories'],
		queryFn: async () => {
			const data = await fetchChainsCategories()
			return (data?.categories as Array<string>) || []
		},
		staleTime: 60 * 60 * 1000,
		enabled: state.comparisonType === 'chains'
	})

	const { data: chainCategoryData } = useQuery({
		queryKey: ['pro-dashboard', 'chains-by-category', chainCategoriesList],
		queryFn: async () => {
			if (!chainCategoriesList) return new Map<string, Set<string>>()
			const results = await Promise.all(chainCategoriesList.map(fetchCategoryChains))
			const chainsInCategory = new Map<string, Set<string>>()
			for (const { category, chains: categoryChains } of results) {
				chainsInCategory.set(category, new Set(categoryChains))
			}
			return chainsInCategory
		},
		staleTime: 60 * 60 * 1000,
		enabled: state.comparisonType === 'chains' && !!chainCategoriesList?.length
	})

	const options: Array<Option> = useMemo(() => {
		if (state.comparisonType === 'chains') {
			return [...chains]
				.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
				.map((chainItem) => ({
					value: chainItem.name,
					label: chainItem.name,
					logo: chainIconUrl(chainItem.name.toLowerCase().replace(/\s+/g, '-'))
				}))
		}

		const childrenByParentId = new Map<string, typeof protocols>()
		const parentsOrSolo: typeof protocols = []
		const parentIdToSlug = new Map<string, string>()

		for (const protocol of protocols) {
			if (protocol.parentProtocol) {
				const existing = childrenByParentId.get(protocol.parentProtocol) || []
				childrenByParentId.set(protocol.parentProtocol, [...existing, protocol])
			} else {
				parentsOrSolo.push(protocol)
				parentIdToSlug.set(protocol.id, protocol.slug)
			}
		}

		parentsOrSolo.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))

		const result: Array<Option> = []

		for (const parent of parentsOrSolo) {
			result.push({
				value: parent.slug,
				label: parent.name,
				logo: parent.logo ?? ''
			})
			const children = childrenByParentId.get(parent.id) || []
			if (children.length > 0) {
				children.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
				for (const child of children) {
					result.push({
						value: child.slug,
						label: child.name,
						logo: child.logo ?? '',
						isChild: true,
						parentSlug: parent.slug
					})
				}
			}
		}

		return result
	}, [state.comparisonType, chains, protocols])

	const protocolCategoryOptions = useMemo(() => {
		const categoriesSet = new Set<string>()
		for (const protocol of protocols) {
			if (protocol.category) {
				categoriesSet.add(protocol.category)
			}
		}
		return Array.from(categoriesSet)
			.sort()
			.map((cat) => ({ value: cat, label: cat }))
	}, [protocols])

	const selectedCategoriesSet = useMemo(() => new Set(selectedCategories), [selectedCategories])

	const filteredOptions = useMemo(() => {
		let filtered: Array<Option> = options

		if (selectedCategoriesSet.size > 0) {
			if (state.comparisonType === 'chains') {
				filtered = filtered.filter((o) => {
					for (const cat of selectedCategoriesSet) {
						if (chainCategoryData?.get(cat)?.has(o.value)) return true
					}
					return false
				})
			} else {
				const matchingProtocols = protocols
					.filter((p) => p.category && selectedCategoriesSet.has(p.category))
					.sort((a, b) => (b.tvl || 0) - (a.tvl || 0))

				filtered = matchingProtocols.map((protocol) => ({
					value: protocol.slug,
					label: protocol.name,
					logo: protocol.logo ?? ''
				}))
			}
		}

		const searchQuery = deferredSearch.trim()
		if (searchQuery) {
			filtered = matchSorter(filtered, searchQuery, {
				keys: ['label'],
				threshold: matchSorter.rankings.CONTAINS
			})
		}

		return filtered
	}, [options, deferredSearch, selectedCategoriesSet, state.comparisonType, chainCategoryData, protocols])

	const virtualizer = useVirtualItems({
		count: filteredOptions.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => 44,
		overscan: 8
	})

	const typeLabel = state.comparisonType === 'chains' ? 'Chains' : 'Protocols'

	const optionsMap = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])

	const selectedLabels = useMemo(() => {
		return state.selectedItems.map((item) => {
			const option = optionsMap.get(item)
			return { value: item, label: option?.label || item, logo: option?.logo }
		})
	}, [state.selectedItems, optionsMap])

	const selectedItemsSet = useMemo(() => new Set(state.selectedItems), [state.selectedItems])

	return (
		<div className="flex flex-col gap-4">
			<div className="text-center">
				<h3 className="label-md text-primary">Select {typeLabel}</h3>
				<p className="mt-1 body-sm text-secondary">Choose 1–10 {typeLabel.toLowerCase()} for your dashboard.</p>
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="label-sm text-secondary">Selected ({state.selectedItems.length}/10)</span>
					{state.selectedItems.length > 0 ? (
						// -mr-2.25 (px-2 + 1px border) puts the label on the list's edge; -my-1 keeps the row 16px.
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() =>
								keepFocus(
									() => actions.setSelectedItems([]),
									() => searchRef.current
								)
							}
							className="-my-1 -mr-2.25"
						>
							Clear all
						</Button>
					) : null}
				</div>
				<div className="relative">
					<div className="flex h-[32px] [scrollbar-width:none] items-center gap-2 overflow-x-auto scroll-smooth pr-6 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
						{state.selectedItems.length > 0 ? (
							selectedLabels.map((item) => (
								<div
									key={item.value}
									className="flex shrink-0 items-center gap-1.5 rounded-md border border-medium pl-1.5 body-sm text-primary"
								>
									<TokenLogo src={item.logo} alt={`Logo of ${item.label}`} size={16} />
									<span className="whitespace-nowrap">{item.label}</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										square
										aria-label={`Remove ${item.label}`}
										onClick={(event) => {
											const next = neighbourRowControl(event.currentTarget.parentElement!, event.currentTarget)
											keepFocus(
												() => actions.toggleSelectedItem(item.value),
												() => next ?? searchRef.current
											)
										}}
									>
										<Icon name="x" height={12} width={12} />
									</Button>
								</div>
							))
						) : (
							<span className="body-sm text-tertiary">No {typeLabel.toLowerCase()} selected.</span>
						)}
					</div>
					{state.selectedItems.length > 2 ? (
						<div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-linear-to-l from-overlay to-transparent" />
					) : null}
				</div>
			</div>

			<div className="flex flex-col overflow-hidden rounded-lg border border-subtle">
				<div className="border-b border-subtle p-2">
					<div className="mb-2">
						<VirtualizedMultiSelect
							label="Filter by category"
							options={
								state.comparisonType === 'chains'
									? (chainCategoriesList || []).map((c) => ({ value: c, label: c }))
									: protocolCategoryOptions
							}
							selectedValues={selectedCategories}
							onChange={setSelectedCategories}
							placeholder="All categories"
							maxSelections={5}
						/>
					</div>
					<div className="relative">
						<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						<Input
							ref={searchRef}
							type="text"
							onInput={(e) => setSearch(e.currentTarget.value)}
							aria-label={`Search ${typeLabel.toLowerCase()}`}
							placeholder={`Search ${typeLabel.toLowerCase()}…`}
							className={searchFieldInputPlacementStyles}
						/>
					</div>
				</div>

				<div ref={listRef} className="h-[280px] overflow-y-auto">
					{protocolsLoading ? (
						<div role="status" aria-live="polite" className="flex h-full items-center justify-center">
							<LoadingIndicator label={`Loading ${typeLabel.toLowerCase()}`} />
						</div>
					) : protocolCatalog.status === 'error' ? (
						<div className="flex h-full flex-col items-center justify-center gap-2 p-3">
							<InlineStatus variant="error">Failed to load {typeLabel.toLowerCase()}.</InlineStatus>
							<Button
								type="button"
								size="sm"
								pendingLabel={protocolCatalog.retrying ? 'Retrying…' : null}
								onClick={protocolCatalog.retry}
							>
								Retry
							</Button>
						</div>
					) : filteredOptions.length === 0 ? (
						<p role="status" className="flex h-full items-center justify-center body-sm text-tertiary">
							No {typeLabel.toLowerCase()} found.
						</p>
					) : (
						<div
							style={{
								height: `${virtualizer.totalSize}px`,
								width: '100%',
								position: 'relative'
							}}
						>
							{virtualizer.items.map((virtualRow) => {
								const option = filteredOptions[virtualRow.index]
								const isDirectlySelected = selectedItemsSet.has(option.value)
								const isParentSelected = option.isChild && option.parentSlug && selectedItemsSet.has(option.parentSlug)
								const isSelected = isDirectlySelected || isParentSelected
								const isDisabledByParent = isParentSelected && !isDirectlySelected
								const isDisabledByLimit = !isSelected && selectedItemsSet.size >= 10
								const isDisabled = isDisabledByParent || isDisabledByLimit

								return (
									<button
										key={option.value}
										type="button"
										role="checkbox"
										aria-checked={!!isSelected}
										aria-label={option.label}
										onClick={() => actions.toggleSelectedItem(option.value)}
										disabled={isDisabled}
										className={`group absolute top-0 left-0 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
											isSelected ? 'bg-brand-faint' : 'not-disabled:hover:bg-hover-row'
										} ${option.isChild ? 'pl-8' : ''}`}
										style={{
											height: `${virtualRow.size}px`,
											transform: `translateY(${virtualRow.start}px)`
										}}
									>
										<CheckboxIndicator checked={!!isSelected} />

										<span className={option.isChild ? 'opacity-70' : undefined}>
											<TokenLogo src={option.logo} alt={`Logo of ${option.label}`} size={24} />
										</span>

										<span
											className={`min-w-0 flex-1 truncate body-md ${option.isChild ? 'text-secondary' : 'text-primary'}`}
										>
											{option.label}
										</span>
									</button>
								)
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
