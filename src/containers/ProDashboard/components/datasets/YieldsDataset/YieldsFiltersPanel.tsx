import * as React from 'react'
import { VirtualizedMultiSelect } from '~/components/Select/VirtualizedSelect'
import type { YieldsFilters } from '~/containers/ProDashboard/types'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { formatNumber } from '~/utils/numberFormat'

const EMPTY_CATEGORIES: Array<string> = []
const EMPTY_PROTOCOLS: Array<string> = []
const EMPTY_TOKENS: Array<string> = []

interface YieldsFiltersPanelProps {
	setShowFiltersPanel: (show: boolean) => void
	filters: YieldsFilters
	setFilters: (filters: YieldsFilters) => void
	availableProtocols: Array<{ value: string; label: string; logo?: string }>
	availableTokens: Array<string>
	availableCategories: Array<string>
	onApplyFilters: (filters?: YieldsFilters) => void
	onResetFilters: () => void
	activeFilterCount: number
	/** Closing the panel removes the control that had focus, so focus goes back to the Filters toggle. */
	toggleRef: React.RefObject<HTMLButtonElement | null>
}

const parseFormattedNumber = (value: string): number | undefined => {
	const cleaned = value.replace(/,/g, '')
	const parsed = Number(cleaned)
	return cleaned && !Number.isNaN(parsed) ? parsed : undefined
}

export function YieldsFiltersPanel({
	setShowFiltersPanel,
	filters,
	setFilters,
	availableProtocols,
	availableTokens,
	availableCategories,
	onApplyFilters,
	onResetFilters,
	activeFilterCount,
	toggleRef
}: YieldsFiltersPanelProps) {
	const [localFilters, setLocalFilters] = React.useState<YieldsFilters>(filters)
	const tokenOptions = availableTokens.map((token) => ({ value: token, label: token }))
	const selectedCategories = new Set(localFilters.categories ?? EMPTY_CATEGORIES)

	const updateFilter = <K extends keyof YieldsFilters>(key: K, value: YieldsFilters[K]) => {
		setLocalFilters((prev) => ({
			...prev,
			[key]: value
		}))
	}

	const handleApply = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		keepFocus(
			() => {
				setFilters(localFilters)
				onApplyFilters(localFilters)
				setShowFiltersPanel(false)
			},
			() => toggleRef.current
		)
	}

	const handleReset = () => {
		const emptyFilters: YieldsFilters = {}
		setLocalFilters(emptyFilters)
		setFilters(emptyFilters)
		onResetFilters()
	}

	return (
		<form
			onSubmit={handleApply}
			className="relative mb-4 rounded-md border border-pro-cards-border bg-pro-cards-bg p-4"
			style={{ zIndex: 50, pointerEvents: 'auto' }}
		>
			<div className="mb-3 flex items-center justify-between">
				<h4 className="label-md text-pro-text-primary">Filter yields</h4>
				<div className="flex items-center gap-2">
					{activeFilterCount > 0 ? (
						<Button
							variant="secondary"
							size="sm"
							// The button leaves once nothing is filtered; focus moves to the first filter field.
							onClick={(event) => {
								const form = event.currentTarget.form!
								keepFocus(handleReset, () => form.querySelector('input'))
							}}
						>
							Clear all ({activeFilterCount})
						</Button>
					) : null}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
				<div>
					<h5 className="mb-3 title-sm text-pro-text-secondary">Yield filters</h5>

					<div className="space-y-3">
						<div>
							<p className="mb-2 label-sm text-pro-text-secondary">Total APY range</p>
							<div className="flex items-center gap-2">
								<input
									type="number"
									aria-label="Minimum total APY"
									placeholder="Min %"
									value={localFilters.apyMin || ''}
									onChange={(e) => updateFilter('apyMin', e.target.value ? Number(e.target.value) : undefined)}
									className="flex-1 rounded-md border border-pro-cards-border bg-pro-glass-bg px-2 py-1.5 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
								/>
								<span className="text-pro-text-tertiary">-</span>
								<input
									type="number"
									aria-label="Maximum total APY"
									placeholder="Max %"
									value={localFilters.apyMax || ''}
									onChange={(e) => updateFilter('apyMax', e.target.value ? Number(e.target.value) : undefined)}
									className="flex-1 rounded-md border border-pro-cards-border bg-pro-glass-bg px-2 py-1.5 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
								/>
							</div>
						</div>

						<div>
							<p className="mb-2 label-sm text-pro-text-secondary">Base APY range</p>
							<div className="flex items-center gap-2">
								<input
									type="number"
									aria-label="Minimum base APY"
									placeholder="Min %"
									value={localFilters.baseApyMin || ''}
									onChange={(e) => updateFilter('baseApyMin', e.target.value ? Number(e.target.value) : undefined)}
									className="flex-1 rounded-md border border-pro-cards-border bg-pro-glass-bg px-2 py-1.5 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
								/>
								<span className="text-pro-text-tertiary">-</span>
								<input
									type="number"
									aria-label="Maximum base APY"
									placeholder="Max %"
									value={localFilters.baseApyMax || ''}
									onChange={(e) => updateFilter('baseApyMax', e.target.value ? Number(e.target.value) : undefined)}
									className="flex-1 rounded-md border border-pro-cards-border bg-pro-glass-bg px-2 py-1.5 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
								/>
							</div>
						</div>

						<label className="group flex cursor-pointer items-center gap-2">
							<div className="relative size-4">
								<input
									type="checkbox"
									checked={localFilters.hasRewards || false}
									onChange={(e) => updateFilter('hasRewards', e.target.checked)}
									className="sr-only"
								/>
								<div
									className={`size-4 rounded-sm border-2 transition-all duration-150 ${
										localFilters.hasRewards
											? 'border-brand bg-brand'
											: 'border-pro-text-tertiary bg-transparent group-hover:border-pro-text-secondary'
									}`}
								>
									{localFilters.hasRewards ? (
										<svg className="size-3 text-on-brand" fill="currentColor" viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
									) : null}
								</div>
							</div>
							<span className="text-sm text-pro-text-primary">Has Reward Incentives</span>
						</label>
					</div>
				</div>

				<div>
					<h5 className="mb-3 title-sm text-pro-text-secondary">Pool filters</h5>

					<div className="space-y-3">
						<div>
							<p className="mb-2 label-sm text-pro-text-secondary">TVL range (USD)</p>
							<div className="flex items-center gap-2">
								<input
									type="text"
									aria-label="Minimum TVL"
									placeholder="Min"
									value={formatNumber(localFilters.tvlMin, { maximumFractionDigits: 0 }) ?? ''}
									onChange={(e) => updateFilter('tvlMin', parseFormattedNumber(e.target.value))}
									className="flex-1 rounded-md border border-pro-cards-border bg-pro-glass-bg px-2 py-1.5 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
								/>
								<span className="text-pro-text-tertiary">-</span>
								<input
									type="text"
									aria-label="Maximum TVL"
									placeholder="Max"
									value={formatNumber(localFilters.tvlMax, { maximumFractionDigits: 0 }) ?? ''}
									onChange={(e) => updateFilter('tvlMax', parseFormattedNumber(e.target.value))}
									className="flex-1 rounded-md border border-pro-cards-border bg-pro-glass-bg px-2 py-1.5 text-sm text-pro-text-primary transition-colors placeholder:text-pro-text-tertiary focus:border-brand focus:outline-hidden"
								/>
							</div>
						</div>
					</div>
				</div>

				<div>
					<h5 className="mb-3 title-sm text-pro-text-secondary">Pool types</h5>

					<div className="space-y-2">
						<label className="group flex cursor-pointer items-center gap-2">
							<div className="relative size-4">
								<input
									type="checkbox"
									checked={localFilters.stablesOnly || false}
									onChange={(e) => updateFilter('stablesOnly', e.target.checked)}
									className="sr-only"
								/>
								<div
									className={`size-4 border-2 transition-all duration-150 ${
										localFilters.stablesOnly
											? 'border-brand bg-brand'
											: 'border-pro-text-tertiary bg-transparent group-hover:border-pro-text-secondary'
									}`}
								>
									{localFilters.stablesOnly ? (
										<svg className="size-3 text-on-brand" fill="currentColor" viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clipRule="evenodd"
											/>
										</svg>
									) : null}
								</div>
							</div>
							<span className="text-sm text-pro-text-primary">Stablecoins Only</span>
						</label>

						<div className="mt-4">
							<p className="mb-3 label-sm text-pro-text-secondary">Pool categories</p>
							<div className="space-y-2">
								{availableCategories.map((category) => (
									<label key={category} className="group flex cursor-pointer items-center gap-2">
										<div className="relative size-4">
											<input
												type="checkbox"
												checked={selectedCategories.has(category)}
												onChange={(e) => {
													const currentCategories = localFilters.categories ?? EMPTY_CATEGORIES
													if (e.target.checked) {
														updateFilter('categories', [...currentCategories, category])
													} else {
														const filtered = currentCategories.filter((value) => value !== category)
														updateFilter('categories', filtered.length > 0 ? filtered : undefined)
													}
												}}
												className="sr-only"
											/>
											<div
												className={`size-4 rounded-sm border-2 transition-all duration-150 ${
													selectedCategories.has(category)
														? 'border-brand bg-brand'
														: 'border-pro-text-tertiary bg-transparent group-hover:border-pro-text-secondary'
												}`}
											>
												{selectedCategories.has(category) ? (
													<svg className="size-3 text-on-brand" fill="currentColor" viewBox="0 0 20 20">
														<path
															fillRule="evenodd"
															d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
															clipRule="evenodd"
														/>
													</svg>
												) : null}
											</div>
										</div>
										<span className="text-sm text-pro-text-primary">{category}</span>
									</label>
								))}
							</div>
						</div>
					</div>
				</div>

				<div>
					<h5 className="mb-3 title-sm text-pro-text-secondary">Protocol & token filters</h5>

					<div className="space-y-3">
						<VirtualizedMultiSelect
							label="Protocols"
							options={availableProtocols}
							selectedValues={localFilters.protocols ?? EMPTY_PROTOCOLS}
							onChange={(values) => updateFilter('protocols', values.length > 0 ? values : undefined)}
							placeholder="Select protocols…"
						/>

						<VirtualizedMultiSelect
							label="Pool Tokens"
							options={tokenOptions}
							selectedValues={localFilters.tokens ?? EMPTY_TOKENS}
							onChange={(values) => updateFilter('tokens', values.length > 0 ? values : undefined)}
							placeholder="Select tokens…"
						/>
					</div>
				</div>
			</div>

			<div className="mt-4 flex items-center justify-between border-t border-pro-cards-border pt-3">
				<Button
					variant="ghost"
					size="sm"
					onClick={() =>
						keepFocus(
							() => setShowFiltersPanel(false),
							() => toggleRef.current
						)
					}
				>
					Cancel
				</Button>
				<Button type="submit" variant="primary" size="sm">
					Apply filters
				</Button>
			</div>
		</form>
	)
}
