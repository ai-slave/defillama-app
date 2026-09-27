import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { Select } from '~/components/Select/Select'
import { useRangeFilter } from '~/hooks/useRangeFilter'
import { Card } from '~/ui/Card'
import { formatNumber } from '~/utils/numberFormat'
import { stablecoinAttributeOptions, stablecoinBackingOptions, stablecoinPegTypeOptions } from './filterPolicy'

const isStablecoinChartQueryKey = (key: string) => key === 'chartType' || key === 'chartView' || key === 'groupBy'

type StablecoinFilterKey = string

function Attribute({ nestedMenu }: { nestedMenu: boolean }) {
	return (
		<Select
			allValues={stablecoinAttributeOptions}
			label="Attribute"
			nestedMenu={nestedMenu}
			labelType="smol"
			variant="filter"
			size="md"
			includeQueryKey="attribute"
			excludeQueryKey="excludeAttribute"
		/>
	)
}

function BackingType({
	nestedMenu,
	availableBackings
}: {
	nestedMenu: boolean
	availableBackings: Array<StablecoinFilterKey>
}) {
	const backingOptions = useMemo(() => {
		if (!availableBackings || availableBackings.length === 0) return stablecoinBackingOptions
		const allowed = new Set(availableBackings)
		return stablecoinBackingOptions.filter((o) => allowed.has(o.key))
	}, [availableBackings])

	return (
		<Select
			allValues={backingOptions}
			label="Backing Type"
			nestedMenu={nestedMenu}
			labelType="smol"
			variant="filter"
			size="md"
			includeQueryKey="backing"
			excludeQueryKey="excludeBacking"
		/>
	)
}

function PegType({
	nestedMenu,
	availablePegTypes
}: {
	nestedMenu: boolean
	availablePegTypes: Array<StablecoinFilterKey>
}) {
	const pegTypeOptions = useMemo(() => {
		if (!availablePegTypes || availablePegTypes.length === 0) return stablecoinPegTypeOptions
		const allowed = new Set(availablePegTypes)
		return stablecoinPegTypeOptions.filter((o) => allowed.has(o.key))
	}, [availablePegTypes])

	return (
		<Select
			allValues={pegTypeOptions}
			label="Peg Type"
			nestedMenu={nestedMenu}
			labelType="smol"
			variant="filter"
			size="md"
			includeQueryKey="pegtype"
			excludeQueryKey="excludePegtype"
		/>
	)
}

function McapRange({ nestedMenu }: { nestedMenu: boolean }) {
	const { min, max, handleSubmit, handleClear } = useRangeFilter('minMcap', 'maxMcap')

	return (
		<FilterBetweenRange
			trigger={
				<>
					{min || max ? (
						<>
							<span>Mcap: </span>
							<span className="text-link">{`${formatNumber(min) ?? 'min'} - ${formatNumber(max) ?? 'max'}`}</span>
						</>
					) : (
						'Mcap'
					)}
				</>
			}
			onSubmit={handleSubmit}
			onClear={handleClear}
			nestedMenu={nestedMenu}
			min={min}
			max={max}
			placement="bottom-start"
			variant="primary"
			size="md"
		/>
	)
}

function ResetAllStablecoinFilters({ pathname, nestedMenu }: { pathname: string; nestedMenu: boolean }) {
	const router = useRouter()

	let hasActiveQueryFilters = false
	const chartQuery: Record<string, string | Array<string>> = {}
	for (const key in router.query) {
		const value = router.query[key]
		if (key === 'chain' || value === undefined) continue
		if (isStablecoinChartQueryKey(key)) {
			if (Array.isArray(value) ? value.length > 0 : value !== '') chartQuery[key] = value
			continue
		}
		if (Array.isArray(value) ? value.length > 0 : value !== '') hasActiveQueryFilters = true
	}

	const resetFilters = () => {
		void router.push({ pathname, query: chartQuery }, undefined, { shallow: true })
	}

	return (
		<ResetFiltersButton nestedMenu={nestedMenu} onClick={resetFilters} disabled={!hasActiveQueryFilters}>
			Reset all filters
		</ResetFiltersButton>
	)
}

function PeggedFiltersDropdowns({
	pathname,
	nestedMenu,
	availableBackings,
	availablePegTypes
}: {
	pathname: string
	nestedMenu?: boolean
	availableBackings: Array<StablecoinFilterKey>
	availablePegTypes: Array<StablecoinFilterKey>
}) {
	return (
		<>
			<Attribute nestedMenu={!!nestedMenu} />
			<BackingType nestedMenu={!!nestedMenu} availableBackings={availableBackings} />
			<PegType nestedMenu={!!nestedMenu} availablePegTypes={availablePegTypes} />
			<McapRange nestedMenu={!!nestedMenu} />
			<ResetAllStablecoinFilters pathname={pathname} nestedMenu={!!nestedMenu} />
		</>
	)
}

export function PeggedFilters(props: {
	pathname: string
	availableBackings: Array<StablecoinFilterKey>
	availablePegTypes: Array<StablecoinFilterKey>
}) {
	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<ResponsiveFilterLayout desktopClassName="hidden min-h-8 flex-wrap gap-1.5 sm:flex">
				{(nestedMenu) => <PeggedFiltersDropdowns {...props} nestedMenu={nestedMenu} />}
			</ResponsiveFilterLayout>
		</Card>
	)
}
