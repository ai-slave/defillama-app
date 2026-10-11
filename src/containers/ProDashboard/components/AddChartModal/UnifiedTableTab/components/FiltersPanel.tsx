import { useMemo, useState } from 'react'
import {
	BoundParameterChip,
	useModalFieldBinding
} from '~/containers/ProDashboard/components/AddChartModal/bindingContext'
import { buildOracleFilterOptions } from '~/containers/ProDashboard/oracleFilterOptions'
import { useProDashboardCatalog } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { useOracleNamesByProtocol } from '~/containers/ProDashboard/queries'
import type { UnifiedTableFilters } from '~/containers/ProDashboard/unifiedTable/config/current'
import { getItemIconUrl } from '~/containers/ProDashboard/utils'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { VirtualizedMultiSelect, type VirtualizedSelectOption } from '~/ui/VirtualizedSelect'

const EMPTY_CATEGORIES: Array<string> = []
const EMPTY_PROTOCOLS: Array<string> = []
const EMPTY_ORACLES: Array<string> = []
const NO_CHAINS: Array<string> = []

interface FiltersPanelProps {
	chains: Array<string>
	filters: UnifiedTableFilters
	availableChains: Array<VirtualizedSelectOption>
	onChainsChange: (chains: Array<string>) => void
	onFiltersChange: (filters: UnifiedTableFilters) => void
}

function countedLabel(label: string, count: number) {
	return count > 0 ? `${label} (${count})` : label
}

export function FiltersPanel({ chains, filters, availableChains, onChainsChange, onFiltersChange }: FiltersPanelProps) {
	const { protocols } = useProDashboardCatalog()
	const { data: oracleNamesByProtocol } = useOracleNamesByProtocol()
	const [categoryMode, setCategoryMode] = useState<'include' | 'exclude'>('include')

	const chainParameter = useModalFieldBinding('chains', 'chain')

	// No pick means every chain, so the list has no "All chains" row of its own beside Select all.
	const chainSelectOptions = useMemo(() => {
		const base = availableChains.filter((option) => option.value !== 'All')
		return chainParameter.options.length > 0 ? [...chainParameter.options, ...base] : base
	}, [availableChains, chainParameter.options])
	const realChainCount = chainSelectOptions.length - chainParameter.options.length

	const selectedChainValues = chains.includes('All') ? NO_CHAINS : chains

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

		const options: Array<VirtualizedSelectOption> = []

		for (const parent of parentsOrSolo) {
			const childProtocols = (childrenByParentId.get(parent.id) ?? []).sort((a, b) => b.tvl - a.tvl)
			options.push({ value: parent.name, label: parent.name, logo: getItemIconUrl('protocol', parent, parent.slug) })
			for (const child of childProtocols) {
				options.push({
					value: child.name,
					label: child.name,
					logo: getItemIconUrl('protocol', child, child.slug),
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
		for (const value of values) {
			const variable = chainParameter.resolveSelection(value)
			if (variable) {
				onChainsChange([variable.value])
				chainParameter.bind(variable.id)
				return
			}
		}

		chainParameter.unbind()
		// Every chain picked, or none, is the "All" filter, which also covers chains listed later.
		onChainsChange(values.length === 0 || values.length === realChainCount ? ['All'] : values)
	}

	return (
		<div className="max-h-[350px] overflow-y-auto">
			<div className="grid gap-3 md:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<VirtualizedMultiSelect
						label="Chains"
						options={chainSelectOptions}
						selectedValues={selectedChainValues}
						onChange={handleChainMultiSelectChange}
						placeholder="All chains"
					/>
					{chainParameter.boundVariable ? (
						<BoundParameterChip label={chainParameter.boundVariable.label} onUnbind={chainParameter.unbind} />
					) : null}
				</div>
				<VirtualizedMultiSelect
					label="Categories"
					labelAction={
						<SegmentedControl<'include' | 'exclude'>
							label="Category match"
							value={categoryMode}
							onValueChange={setCategoryMode}
							options={[
								{ value: 'include', label: countedLabel('Include', includeCategories.length) },
								{ value: 'exclude', label: countedLabel('Exclude', excludeCategories.length) }
							]}
							variant="default"
							size="sm"
						/>
					}
					options={categoryOptions}
					selectedValues={categoryValues}
					onChange={handleCategoryMultiSelectChange}
					placeholder={categoryMode === 'include' ? 'All categories' : 'None'}
					className="md:col-span-2"
				/>
				<VirtualizedMultiSelect
					label="Protocols"
					options={protocolOptions}
					selectedValues={filters.protocols ?? EMPTY_PROTOCOLS}
					onChange={(values) => handleMultiSelectChange('protocols', values)}
					placeholder="All protocols"
				/>
				<VirtualizedMultiSelect
					label="Oracles"
					options={oracleOptions}
					selectedValues={filters.oracles ?? EMPTY_ORACLES}
					onChange={(values) => handleMultiSelectChange('oracles', values)}
					placeholder="All oracles"
				/>
			</div>
		</div>
	)
}
