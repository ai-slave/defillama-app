import * as Ariakit from '@ariakit/react'
import { useMemo } from 'react'
import { Icon } from '~/ui/Icon'
import { LocalLoader } from '~/ui/Loaders'

interface ChartTypeOption {
	value: string
	label: string
	available?: boolean
}

interface ChartTypePillsProps {
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
	['Derivatives', ['openInterest', 'optionsPremium', 'optionsNotional']],
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
	['Native Token', ['chainMcap', 'chainPrice']]
] as const satisfies ReadonlyArray<readonly [string, ReadonlyArray<string>]>

export function ChartTypePills({
	chartTypes,
	selectedType,
	onSelect,
	isLoading = false,
	mode = 'protocol'
}: ChartTypePillsProps) {
	const chartTypeMap = useMemo(() => {
		const map = new Map<string, ChartTypeOption>()
		for (const ct of chartTypes) {
			map.set(ct.value, ct)
		}
		return map
	}, [chartTypes])

	const groups = mode === 'chain' ? CHAIN_GROUPS : PROTOCOL_GROUPS

	const groupedOptions = useMemo(() => {
		const result: Array<{ group: string; options: Array<ChartTypeOption> }> = []

		for (const [groupName, typeIds] of groups) {
			const options: Array<ChartTypeOption> = []
			for (const id of typeIds) {
				const chartType = chartTypeMap.get(id)
				if (chartType) {
					options.push(chartType)
				}
			}
			if (options.length > 0) {
				result.push({ group: groupName, options })
			}
		}

		return result
	}, [groups, chartTypeMap])

	const selectedLabel = useMemo(() => {
		if (!selectedType) return 'Select Chart Type'
		const ct = chartTypeMap.get(selectedType)
		return ct?.label || selectedType
	}, [selectedType, chartTypeMap])

	if (isLoading) {
		return (
			<div className="flex h-10 items-center justify-center">
				<LocalLoader />
			</div>
		)
	}

	return (
		<Ariakit.ComboboxProvider
			selectedValue={selectedType || ''}
			setSelectedValue={(value) => {
				if (value && typeof value === 'string') {
					onSelect(value)
				}
			}}
		>
			<Ariakit.ComboboxSelect className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-3 py-2 text-xs text-pro-text-primary transition-colors hover:border-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden">
				<span className={selectedType ? 'text-pro-text-primary' : 'text-pro-text-tertiary'}>{selectedLabel}</span>
				<Ariakit.ComboboxSelectArrow />
			</Ariakit.ComboboxSelect>
			<Ariakit.ComboboxPopover
				gutter={4}
				sameWidth
				unmountOnHide
				className="z-50 max-h-[320px] overflow-auto overscroll-contain rounded-lg border border-pro-cards-border bg-surface shadow-lg"
			>
				{groupedOptions.map(({ group, options }) => (
					<Ariakit.ComboboxGroup key={group} className="py-1">
						<Ariakit.ComboboxGroupLabel className="px-3 py-1.5 text-[10px] font-semibold tracking-wide text-pro-text-tertiary uppercase">
							{group}
						</Ariakit.ComboboxGroupLabel>
						{options.map((option) => {
							const isAvailable = option.available !== false

							return (
								<Ariakit.ComboboxItem
									key={option.value}
									value={option.value}
									disabled={!isAvailable}
									className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs transition-colors ${
										isAvailable
											? 'text-pro-text-primary hover:bg-brand-muted focus-visible:bg-brand-muted data-active-item:bg-brand-muted'
											: 'cursor-not-allowed text-pro-text-tertiary opacity-50'
									}`}
								>
									<span>{option.label}</span>
									<Ariakit.ComboboxItemSelected>
										{(selected) =>
											selected ? <Icon name="check" height={14} width={14} className="text-pro-accent" /> : null
										}
									</Ariakit.ComboboxItemSelected>
								</Ariakit.ComboboxItem>
							)
						})}
					</Ariakit.ComboboxGroup>
				))}
			</Ariakit.ComboboxPopover>
		</Ariakit.ComboboxProvider>
	)
}
