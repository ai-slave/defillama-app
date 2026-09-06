import { useMemo, useState } from 'react'
import { AriakitVirtualizedMultiSelect } from '~/containers/ProDashboard/components/AriakitVirtualizedMultiSelect'
import { buildOracleFilterOptions } from '~/containers/ProDashboard/oracleFilterOptions'
import { useProDashboardCatalog } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { useOracleNamesByProtocol } from '~/containers/ProDashboard/queries'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { getItemIconUrl } from '~/containers/ProDashboard/utils'

const EMPTY_CATEGORIES: Array<string> = []
const EMPTY_PROTOCOLS: Array<string> = []
const EMPTY_ORACLES: Array<string> = []
const ALL_CHAINS_SELECTION = ['All']

interface FiltersPanelProps {
	chains: Array<string>
	filters: UnifiedTableFilters
	availableChains: Array<{ label: string; value: string }>
	onChainsChange: (chains: Array<string>) => void
	onFiltersChange: (filters: UnifiedTableFilters) => void
}

export function FiltersPanel({ chains, filters, availableChains, onChainsChange, onFiltersChange }: FiltersPanelProps) {
	const { protocols } = useProDashboardCatalog()
	const { data: oracleNamesByProtocol } = useOracleNamesByProtocol()
	const [categoryMode, setCategoryMode] = useState<'include' | 'exclude'>('include')

	const chainSelectOptions = useMemo(() => {
		if (availableChains.some((option) => option.value === 'All')) {
			return availableChains
		}

		return [{ value: 'All', label: 'All Chains' }, ...availableChains]
	}, [availableChains])

	const selectedChainValues = chains.includes('All') ? ALL_CHAINS_SELECTION : chains

	const categoryOptions = useMemo(() => {
		if (!protocols || protocols.length === 0) return []
		const set = new Set<string>()
		for (const protocol of protocols) {
			if (protocol.category) set.add(protocol.category)
		}
		return Array.from(set)
			.sort((a, b) => a.localeCompare(b))
			.map((item) => ({ value: item, label: item }))
	}, [protocols])

	const protocolOptions = useMemo(() => {
		if (!protocols || protocols.length === 0) return []

		const childrenByParentId = new Map<string, typeof protocols>()
		const parentsOrSolo: typeof protocols = []

		for (const protocol of protocols) {
			if (protocol.parentProtocol) {
				const arr = childrenByParentId.get(protocol.parentProtocol) || []
				arr.push(protocol)
				childrenByParentId.set(protocol.parentProtocol, arr)
			} else {
				parentsOrSolo.push(protocol)
			}
		}

		parentsOrSolo.sort((a, b) => b.tvl - a.tvl)

		const options: Array<{ value: string; label: string; logo?: string; isChild?: boolean }> = []

		for (const parent of parentsOrSolo) {
			const childProtocols = (childrenByParentId.get(parent.id) ?? []).sort((a, b) => b.tvl - a.tvl)
			options.push({ value: parent.name, label: parent.name, ...(parent.logo ? { logo: parent.logo } : {}) })
			for (const child of childProtocols) {
				options.push({
					value: child.name,
					label: child.name,
					...(child.logo ? { logo: child.logo } : {}),
					isChild: true
				})
			}
		}

		return options
	}, [protocols])

	const oracleOptions = useMemo(() => {
		return oracleNamesByProtocol ? buildOracleFilterOptions(protocols, oracleNamesByProtocol) : []
	}, [protocols, oracleNamesByProtocol])

	const includeCategories = filters.categories ?? EMPTY_CATEGORIES
	const excludeCategories = filters.excludedCategories ?? EMPTY_CATEGORIES
	const categoryValues = categoryMode === 'include' ? includeCategories : excludeCategories

	const handleMultiSelectChange = (
		key: 'categories' | 'excludedCategories' | 'protocols' | 'oracles',
		values: Array<string>
	) => {
		const next: UnifiedTableFilters = { ...filters }
		if (values.length === 0) {
			delete next[key]
		} else {
			next[key] = values
		}
		onFiltersChange(next)
	}

	const handleCategoryMultiSelectChange = (values: Array<string>) => {
		const key = categoryMode === 'include' ? 'categories' : 'excludedCategories'
		const next: UnifiedTableFilters = { ...filters }
		if (values.length === 0) {
			delete next[key]
		} else {
			next[key] = values
		}
		onFiltersChange(next)
	}

	const handleChainMultiSelectChange = (values: Array<string>) => {
		if (values.length === 0) {
			onChainsChange(['All'])
			return
		}

		if (values.includes('All')) {
			if (!chains.includes('All')) {
				onChainsChange(['All'])
				return
			}

			if (values.length === 1) {
				onChainsChange(['All'])
				return
			}

			const filtered = values.filter((value) => value !== 'All')
			onChainsChange(filtered.length > 0 ? filtered : ['All'])
			return
		}

		onChainsChange(values)
	}

	return (
		<div className="max-h-[350px] overflow-y-auto">
			<div className="grid gap-3 md:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<AriakitVirtualizedMultiSelect
						label="Chains"
						options={chainSelectOptions}
						selectedValues={selectedChainValues}
						onChange={handleChainMultiSelectChange}
						placeholder="All chains..."
						renderIcon={(option) => (option.value === 'All' ? null : getItemIconUrl('chain', null, option.value))}
					/>
				</div>
				<div className="rounded-md border border-pro-cards-border bg-pro-cards-bg p-3 md:col-span-2">
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="text-xs font-semibold text-pro-text-secondary">Categories</p>
							<p className="text-[11px] text-pro-text-tertiary">Toggle include or exclude selections.</p>
						</div>
						<div className="flex items-center rounded-md border border-pro-cards-border">
							{(['include', 'exclude'] as const).map((mode) => {
								const isActive = categoryMode === mode
								const count = mode === 'include' ? includeCategories.length : excludeCategories.length
								return (
									<button
										type="button"
										key={mode}
										onClick={() => setCategoryMode(mode)}
										className={`px-2 py-1 text-[11px] font-medium transition ${
											isActive ? 'bg-brand/10 text-brand' : 'text-pro-text-tertiary hover:text-pro-text-primary'
										}`}
									>
										{mode === 'include' ? 'Include' : 'Exclude'}
										{count > 0 ? <span className="ml-1 text-[10px] text-pro-text-tertiary">({count})</span> : null}
									</button>
								)
							})}
						</div>
					</div>
					<AriakitVirtualizedMultiSelect
						label={categoryMode === 'include' ? 'Include Categories' : 'Exclude Categories'}
						options={categoryOptions}
						selectedValues={categoryValues}
						onChange={handleCategoryMultiSelectChange}
						placeholder={categoryMode === 'include' ? 'All categories...' : 'None'}
						className="[&>label]:sr-only"
					/>
				</div>
				<AriakitVirtualizedMultiSelect
					label="Protocols"
					options={protocolOptions}
					selectedValues={filters.protocols ?? EMPTY_PROTOCOLS}
					onChange={(values) => handleMultiSelectChange('protocols', values)}
					placeholder="All protocols..."
					renderIcon={(option) => option.logo || getItemIconUrl('protocol', option, option.value)}
					className="flex flex-col gap-1.5"
				/>
				<AriakitVirtualizedMultiSelect
					label="Oracles"
					options={oracleOptions}
					selectedValues={filters.oracles ?? EMPTY_ORACLES}
					onChange={(values) => handleMultiSelectChange('oracles', values)}
					placeholder="All oracles..."
					className="flex flex-col gap-1.5"
				/>
			</div>
		</div>
	)
}
