import { useMemo } from 'react'
import { VirtualizedSelect, type VirtualizedSelectOption } from '~/components/Select/VirtualizedSelect'

interface ChartTypeOption {
	value: string
	label: string
	available?: boolean
}

interface ChartTypePillsProps {
	label: string
	chartTypes: Array<ChartTypeOption>
	selectedType: string | null
	onSelect: (type: string) => void
	isLoading?: boolean
	mode?: 'chain' | 'protocol'
}

const PROTOCOL_GROUPS = [
	['Value', ['tvl', 'treasury']],
	['Volume', ['volume', 'aggregators', 'perps', 'perpsAggregators', 'bridgeAggregators']],
	['Fees & Revenue', ['fees', 'revenue', 'unlocks', 'incentives', 'holdersRevenue']],
	['Derivatives', ['openInterest', 'optionsPremium', 'optionsNotional', 'optionsOpenInterest']],
	['Token', ['tokenMcap', 'tokenPrice', 'tokenVolume']],
	['DeFi', ['medianApy', 'borrowed']],
	['Ratios', ['pfRatio', 'psRatio']]
] as const satisfies ReadonlyArray<readonly [string, ReadonlyArray<string>]>

const CHAIN_GROUPS = [
	['Value', ['tvl', 'bridgedTvl']],
	['Volume', ['volume', 'aggregators', 'perps', 'perpsAggregators', 'bridgeAggregators']],
	['Derivatives', ['optionsPremium', 'optionsNotional']],
	['Fees & Revenue', ['fees', 'revenue', 'chainFees', 'chainRevenue']],
	['Activity', ['txs', 'activeUsers', 'newUsers', 'gasUsed']],
	['Stablecoins', ['stablecoins', 'stablecoinInflows']],
	['Native token', ['chainMcap', 'chainPrice']]
] as const satisfies ReadonlyArray<readonly [string, ReadonlyArray<string>]>

export function ChartTypePills({
	label,
	chartTypes,
	selectedType,
	onSelect,
	isLoading = false,
	mode = 'protocol'
}: ChartTypePillsProps) {
	const options = useMemo(() => {
		const byValue = new Map<string, ChartTypeOption>()
		for (const ct of chartTypes) byValue.set(ct.value, ct)

		const result: Array<VirtualizedSelectOption> = []
		for (const [group, typeIds] of mode === 'chain' ? CHAIN_GROUPS : PROTOCOL_GROUPS) {
			for (const id of typeIds) {
				const chartType = byValue.get(id)
				if (!chartType) continue
				result.push({ value: chartType.value, label: chartType.label, group, disabled: chartType.available === false })
			}
		}
		return result
	}, [chartTypes, mode])

	return (
		<VirtualizedSelect
			variant="field"
			label={label}
			options={options}
			placeholder="Select chart type"
			selectedValue={selectedType}
			onChange={(option) => onSelect(option.value)}
			isLoading={isLoading}
		/>
	)
}
