import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { RaisesSearch } from '~/containers/Raises/Search'
import { useRangeFilter } from '~/hooks/useRangeFilter'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { nestedMenuActionStyles } from '~/ui/Popover'
import { formatNumber } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'

interface IDropdownMenusProps {
	header: string
	headingAs?: 'h1' | 'h2'
	pathname?: string
	investors: string[]
	selectedInvestors: string[]
	chains: string[]
	selectedChains: string[]
	sectors: string[]
	selectedSectors: string[]
	rounds: string[]
	selectedRounds: string[]
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
	selectedInvestors,
	chains,
	selectedChains,
	sectors,
	selectedSectors,
	rounds,
	selectedRounds,
	pathname,
	nestedMenu
}: IDropdownMenusProps & { nestedMenu: boolean }) {
	const router = useRouter()

	// Check if any filters are active based on URL query params.
	// The selected* arrays default to "all values" when no query is set, so using their lengths
	// would incorrectly mark filters as active (especially on investor pages).
	const hasActiveFilters =
		(!!router.query.investor && router.query.investor !== 'All') ||
		(!!router.query.chain && router.query.chain !== 'All') ||
		(!!router.query.sector && router.query.sector !== 'All') ||
		(!!router.query.round && router.query.round !== 'All') ||
		!!router.query.minRaised ||
		!!router.query.maxRaised

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
					selectedValues={selectedInvestors}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter-responsive"
					size="md"
					includeQueryKey="investor"
					excludeQueryKey="excludeInvestor"
				/>
			) : null}

			{chains.length > 0 ? (
				<SelectWithCombobox
					label="Chains"
					allValues={chains}
					selectedValues={selectedChains}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter-responsive"
					size="md"
					includeQueryKey="chain"
					excludeQueryKey="excludeChain"
				/>
			) : null}

			{sectors.length > 0 ? (
				<SelectWithCombobox
					label="Sectors"
					allValues={sectors}
					selectedValues={selectedSectors}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter-responsive"
					size="md"
					includeQueryKey="sector"
					excludeQueryKey="excludeSector"
				/>
			) : null}

			{rounds.length > 0 ? (
				<SelectWithCombobox
					label="Rounds"
					allValues={rounds}
					selectedValues={selectedRounds}
					nestedMenu={nestedMenu}
					labelType="smol"
					variant="filter-responsive"
					size="md"
					includeQueryKey="round"
					excludeQueryKey="excludeRound"
				/>
			) : null}

			<RaisedRange nestedMenu={nestedMenu} placement="bottom-start" />

			{nestedMenu ? (
				<button type="button" onClick={resetFilters} disabled={!hasActiveFilters} className={nestedMenuActionStyles}>
					Reset all filters
				</button>
			) : (
				<Button type="button" size="md" onClick={resetFilters} disabled={!hasActiveFilters}>
					Reset all filters
				</Button>
			)}
		</>
	)
}

function RaisedRange({
	nestedMenu,
	placement
}: {
	nestedMenu: boolean
	placement?: Ariakit.PopoverStoreProps['placement']
}) {
	const { min, max, handleSubmit, handleClear } = useRangeFilter('minRaised', 'maxRaised')

	return (
		<FilterBetweenRange
			trigger={
				<>
					{min !== null || max !== null ? (
						<>
							<span>Amount Raised: </span>
							<span className="text-link">{`${formatNumber(min) ?? 'min'} - ${formatNumber(max) ?? 'max'}`}</span>
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
