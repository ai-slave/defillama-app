import * as React from 'react'
import { VirtualizedMultiSelect } from '~/components/Select/VirtualizedSelect'
import type { YieldsFilters } from '~/containers/ProDashboard/types'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { keepFocus } from '~/ui/focus'
import { Input } from '~/ui/Input'
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
		<Card
			noValidate
			onSubmit={handleApply}
			as="form"
			padding="md"
			className="relative mb-4"
			style={{ zIndex: 50, pointerEvents: 'auto' }}
		>
			<div className="mb-3 flex items-center justify-between">
				<h4 className="label-md text-primary">Filter yields</h4>
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
					<h5 className="mb-3 title-sm text-secondary">Yield filters</h5>

					<div className="space-y-3">
						<div>
							<p className="mb-2 label-sm text-secondary">Total APY range</p>
							<div className="flex items-center gap-2">
								<Input
									type="number"
									aria-label="Minimum total APY"
									placeholder="Min %"
									value={localFilters.apyMin || ''}
									onChange={(e) => updateFilter('apyMin', e.target.value ? Number(e.target.value) : undefined)}
									className="min-w-0 flex-1"
								/>
								<span className="text-tertiary">-</span>
								<Input
									type="number"
									aria-label="Maximum total APY"
									placeholder="Max %"
									value={localFilters.apyMax || ''}
									onChange={(e) => updateFilter('apyMax', e.target.value ? Number(e.target.value) : undefined)}
									className="min-w-0 flex-1"
								/>
							</div>
						</div>

						<div>
							<p className="mb-2 label-sm text-secondary">Base APY range</p>
							<div className="flex items-center gap-2">
								<Input
									type="number"
									aria-label="Minimum base APY"
									placeholder="Min %"
									value={localFilters.baseApyMin || ''}
									onChange={(e) => updateFilter('baseApyMin', e.target.value ? Number(e.target.value) : undefined)}
									className="min-w-0 flex-1"
								/>
								<span className="text-tertiary">-</span>
								<Input
									type="number"
									aria-label="Maximum base APY"
									placeholder="Max %"
									value={localFilters.baseApyMax || ''}
									onChange={(e) => updateFilter('baseApyMax', e.target.value ? Number(e.target.value) : undefined)}
									className="min-w-0 flex-1"
								/>
							</div>
						</div>

						<Checkbox
							variant="inline"
							checked={localFilters.hasRewards || false}
							onChange={(e) => updateFilter('hasRewards', e.target.checked)}
						>
							Has reward incentives
						</Checkbox>
					</div>
				</div>

				<div>
					<h5 className="mb-3 title-sm text-secondary">Pool filters</h5>

					<div className="space-y-3">
						<div>
							<p className="mb-2 label-sm text-secondary">TVL range (USD)</p>
							<div className="flex items-center gap-2">
								<Input
									type="text"
									aria-label="Minimum TVL"
									placeholder="Min"
									value={formatNumber(localFilters.tvlMin, { maximumFractionDigits: 0 }) ?? ''}
									onChange={(e) => updateFilter('tvlMin', parseFormattedNumber(e.target.value))}
									className="min-w-0 flex-1"
								/>
								<span className="text-tertiary">-</span>
								<Input
									type="text"
									aria-label="Maximum TVL"
									placeholder="Max"
									value={formatNumber(localFilters.tvlMax, { maximumFractionDigits: 0 }) ?? ''}
									onChange={(e) => updateFilter('tvlMax', parseFormattedNumber(e.target.value))}
									className="min-w-0 flex-1"
								/>
							</div>
						</div>
					</div>
				</div>

				<div>
					<h5 className="mb-3 title-sm text-secondary">Pool types</h5>

					<div className="space-y-2">
						<Checkbox
							variant="inline"
							checked={localFilters.stablesOnly || false}
							onChange={(e) => updateFilter('stablesOnly', e.target.checked)}
						>
							Stablecoins only
						</Checkbox>

						<div className="mt-4">
							<p className="mb-3 label-sm text-secondary">Pool categories</p>
							<div className="space-y-2">
								{availableCategories.map((category) => (
									<Checkbox
										key={category}
										variant="inline"
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
									>
										{category}
									</Checkbox>
								))}
							</div>
						</div>
					</div>
				</div>

				<div>
					<h5 className="mb-3 title-sm text-secondary">Protocol & token filters</h5>

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

			<div className="mt-4 flex items-center justify-between border-t border-subtle pt-3">
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
		</Card>
	)
}
