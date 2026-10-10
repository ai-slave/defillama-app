import type * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { RaisesSearch } from '~/containers/Raises/Search'
import { useRangeFilter } from '~/hooks/useRangeFilter'
import { Card } from '~/ui/Card'
import { formatUsd, USD_LOWERCASE_MILLIONS_OPTIONS } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'

interface IDropdownMenusProps {
	header: string
	headingAs?: 'h1' | 'h2'
	pathname?: string
	investors: Array<string>
	chains: Array<string>
	sectors: Array<string>
	rounds: Array<string>
	hasActiveFilters: boolean
	amountQuickPicks: ReadonlyArray<number>
}

export function RaisesFilters(props: IDropdownMenusProps) {
	const HeadingTag = props.headingAs ?? 'h2'
	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<HeadingTag className="heading-xs">{props.header}</HeadingTag>
			<RaisesSearch list={props.investors} />
			<ResponsiveFilterLayout>{(nestedMenu) => <Filters {...props} nestedMenu={nestedMenu} />}</ResponsiveFilterLayout>
		</Card>
	)
}

function Filters({
	investors,
	chains,
	sectors,
	rounds,
	hasActiveFilters,
	pathname,
	amountQuickPicks,
	nestedMenu
}: IDropdownMenusProps & { nestedMenu: boolean }) {
	const router = useRouter()

	const resetFilters = () => {
		// Clear only query params while keeping the route.
		void pushShallowQuery(
			router,
			{
				investor: undefined,
				excludeInvestor: undefined,
				chain: undefined,
				excludeChain: undefined,
				sector: undefined,
				excludeSector: undefined,
				round: undefined,
				excludeRound: undefined,
				minRaised: undefined,
				maxRaised: undefined
			},
			pathname || router.pathname || '/raises'
		)
	}

	return (
		<>
			{investors.length > 0 ? (
				<SelectWithCombobox
					label="Investors"
					allValues={investors}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter"
					size="md"
					includeQueryKey="investor"
					excludeQueryKey="excludeInvestor"
				/>
			) : null}

			{chains.length > 0 ? (
				<SelectWithCombobox
					label="Chains"
					allValues={chains}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter"
					size="md"
					includeQueryKey="chain"
					excludeQueryKey="excludeChain"
				/>
			) : null}

			{sectors.length > 0 ? (
				<SelectWithCombobox
					label="Sectors"
					allValues={sectors}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter"
					size="md"
					includeQueryKey="sector"
					excludeQueryKey="excludeSector"
				/>
			) : null}

			{rounds.length > 0 ? (
				<SelectWithCombobox
					label="Rounds"
					allValues={rounds}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter"
					size="md"
					includeQueryKey="round"
					excludeQueryKey="excludeRound"
				/>
			) : null}

			<RaisedRange nestedMenu={nestedMenu} placement="bottom-start" quickPicks={amountQuickPicks} />

			<ResetFiltersButton nestedMenu={nestedMenu} onClick={resetFilters} disabled={!hasActiveFilters}>
				Reset all filters
			</ResetFiltersButton>
		</>
	)
}

function RaisedRange({
	nestedMenu,
	placement,
	quickPicks
}: {
	nestedMenu: boolean
	placement?: Ariakit.PopoverStoreProps['placement']
	quickPicks: ReadonlyArray<number>
}) {
	const { min, max, handleSubmit, handleClear } = useRangeFilter('minRaised', 'maxRaised')

	return (
		<FilterBetweenRange
			heading="Amount Raised"
			quickPicks={quickPicks.map((value) => ({ label: formatUsd(value, USD_LOWERCASE_MILLIONS_OPTIONS), value }))}
			trigger={
				<>
					{min !== null || max !== null ? (
						<>
							<span>Amount Raised: </span>
							<span className="text-link">{`${formatUsd(min, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'min'} - ${formatUsd(max, USD_LOWERCASE_MILLIONS_OPTIONS) ?? 'max'}`}</span>
						</>
					) : (
						<span>Amount Raised</span>
					)}
				</>
			}
			onSubmit={handleSubmit}
			onClear={handleClear}
			nestedMenu={nestedMenu}
			min={min}
			max={max}
			variant="primary"
			size="md"
			placement={placement}
		/>
	)
}
