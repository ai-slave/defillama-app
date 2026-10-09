import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { ResetFiltersButton } from '~/components/Filters/ResetFiltersButton'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { NestedMenuToggle } from '~/components/NestedMenu'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { ExcludeQueryKey } from '~/components/Select/types'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { pushShallowQuery } from '~/utils/routerQuery'
import { CARDS_QUERY_KEYS } from './CardsTable'
import {
	CARD_TYPE_OPTIONS,
	CARDS_FILTER_QUERY_KEYS,
	cardsChainOptions,
	cardsCountryOptions,
	CUSTODY_OPTIONS,
	NETWORK_OPTIONS,
	resolveCardsAvailability,
	resolveCardsFilterState
} from './filterPolicy'
import type { CardTierRow } from './models'

const ALL_COUNTRIES_SELECTION = 'all'

function AvailabilityFilter({ nestedMenu, rows }: { nestedMenu: boolean; rows: Array<CardTierRow> }) {
	const router = useRouter()
	const { country, includeUnknown } = resolveCardsAvailability(router.query)

	const countryOptions = useMemo(
		() => [{ key: ALL_COUNTRIES_SELECTION, name: 'All countries' }, ...cardsCountryOptions(rows)],
		[rows]
	)

	return (
		<SelectWithCombobox
			heading="Availability"
			allValues={countryOptions}
			selectedValues={[country ?? ALL_COUNTRIES_SELECTION]}
			setSelectedValues={(values) => {
				const nextCountry = Array.isArray(values) ? values[0] : values
				const isAll = !nextCountry || nextCountry === ALL_COUNTRIES_SELECTION
				void pushShallowQuery(router, {
					[CARDS_FILTER_QUERY_KEYS.country]: isAll ? undefined : nextCountry.toLowerCase(),
					// The unknown toggle qualifies a country selection; clear it alongside.
					...(isAll ? { [CARDS_FILTER_QUERY_KEYS.includeUnknown]: undefined } : {})
				})
			}}
			label={country ? `Available in: ${country}` : 'Availability'}
			labelType="none"
			singleSelect
			nestedMenu={nestedMenu}
			variant="filter"
			size="md"
			searchPlaceholder="Search countries…"
			headerRow={
				<Checkbox
					variant="filter-borderless"
					checked={includeUnknown}
					disabled={country == null}
					onChange={(event) => {
						void pushShallowQuery(router, {
							[CARDS_FILTER_QUERY_KEYS.includeUnknown]: event.target.checked ? 'true' : undefined
						})
					}}
				>
					Show unknown availability
				</Checkbox>
			}
		/>
	)
}

/** A multi-select facet over a fixed option list; all selected = inactive (param removed). */
function FacetFilter({
	nestedMenu,
	label,
	queryKey,
	excludeQueryKey,
	options,
	searchPlaceholder
}: {
	nestedMenu: boolean
	label: string
	queryKey: string
	excludeQueryKey: ExcludeQueryKey
	options: Array<{ key: string; name: string }>
	searchPlaceholder?: string
}) {
	return (
		<SelectWithCombobox
			allValues={options}
			includeQueryKey={queryKey}
			excludeQueryKey={excludeQueryKey}
			label={label}
			labelType="smol"
			nestedMenu={nestedMenu}
			variant="filter"
			size="md"
			{...(searchPlaceholder ? { searchPlaceholder } : {})}
		/>
	)
}

/** A boolean "only show cards with X" filter backed by one query key. */
function OnlyWithCheckbox({
	nestedMenu,
	queryKey,
	checked,
	children
}: {
	nestedMenu: boolean
	queryKey: string
	checked: boolean
	children: ReactNode
}) {
	const router = useRouter()
	const setChecked = (next: boolean) => {
		void pushShallowQuery(router, { [queryKey]: next ? 'true' : undefined })
	}
	return nestedMenu ? (
		<NestedMenuToggle checked={checked} onChange={setChecked}>
			{children}
		</NestedMenuToggle>
	) : (
		<Checkbox variant="filter" checked={checked} onChange={(event) => setChecked(event.target.checked)}>
			{children}
		</Checkbox>
	)
}

function ResetAllCardsFilters({ nestedMenu }: { nestedMenu: boolean }) {
	const router = useRouter()
	const hasActiveQueryFilters =
		router.query[CARDS_QUERY_KEYS.columnGroup] != null ||
		Object.values(CARDS_FILTER_QUERY_KEYS).some((key) => router.query[key] != null)

	const resetFilters = () => {
		void router.push('/crypto-cards', undefined, { shallow: true })
	}

	return (
		<ResetFiltersButton nestedMenu={nestedMenu} onClick={resetFilters} disabled={!hasActiveQueryFilters}>
			Reset all filters
		</ResetFiltersButton>
	)
}

function CardsFiltersDropdowns({ nestedMenu, rows }: { nestedMenu?: boolean; rows: Array<CardTierRow> }) {
	const router = useRouter()
	const chainOptions = useMemo(() => cardsChainOptions(rows), [rows])
	const { physicalOnly, virtualOnly } = resolveCardsFilterState(
		router.query,
		chainOptions.map((option) => option.key)
	)
	return (
		<>
			<AvailabilityFilter nestedMenu={!!nestedMenu} rows={rows} />
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Type"
				queryKey={CARDS_FILTER_QUERY_KEYS.cardType}
				excludeQueryKey={CARDS_FILTER_QUERY_KEYS.excludeCardType}
				options={[...CARD_TYPE_OPTIONS]}
			/>
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Network"
				queryKey={CARDS_FILTER_QUERY_KEYS.network}
				excludeQueryKey={CARDS_FILTER_QUERY_KEYS.excludeNetwork}
				options={[...NETWORK_OPTIONS]}
			/>
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Custody"
				queryKey={CARDS_FILTER_QUERY_KEYS.custody}
				excludeQueryKey={CARDS_FILTER_QUERY_KEYS.excludeCustody}
				options={[...CUSTODY_OPTIONS]}
			/>
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Chains"
				queryKey={CARDS_FILTER_QUERY_KEYS.chain}
				excludeQueryKey={CARDS_FILTER_QUERY_KEYS.excludeChain}
				options={chainOptions}
				searchPlaceholder="Search chains…"
			/>
			<OnlyWithCheckbox nestedMenu={!!nestedMenu} queryKey={CARDS_FILTER_QUERY_KEYS.physical} checked={physicalOnly}>
				Physical card
			</OnlyWithCheckbox>
			<OnlyWithCheckbox nestedMenu={!!nestedMenu} queryKey={CARDS_FILTER_QUERY_KEYS.virtual} checked={virtualOnly}>
				Virtual card
			</OnlyWithCheckbox>
			<ResetAllCardsFilters nestedMenu={!!nestedMenu} />
		</>
	)
}

export function CardsFilters(props: { rows: Array<CardTierRow> }) {
	return (
		<Card padding="sm" className="flex flex-col gap-2">
			<ResponsiveFilterLayout desktopClassName="hidden min-h-8 flex-wrap gap-1.5 sm:flex">
				{(nestedMenu) => <CardsFiltersDropdowns {...props} nestedMenu={nestedMenu} />}
			</ResponsiveFilterLayout>
		</Card>
	)
}
