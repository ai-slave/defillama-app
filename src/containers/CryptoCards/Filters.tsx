import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { ResponsiveFilterLayout } from '~/components/Filters/ResponsiveFilterLayout'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Checkbox } from '~/ui/Checkbox'
import { nestedMenuActionStyles } from '~/ui/Popover'
import { pushShallowQuery } from '~/utils/routerQuery'
import { CARDS_QUERY_KEYS } from './CardsTable'
import {
	CARD_TYPE_OPTIONS,
	CARDS_FILTER_QUERY_KEYS,
	cardsChainOptions,
	cardsCountryOptions,
	CUSTODY_OPTIONS,
	NETWORK_OPTIONS,
	NONE_SELECTED,
	resolveCardsFilterState
} from './filterPolicy'
import type { CardTierRow } from './models'

const ALL_COUNTRIES_SELECTION = 'all'

function AvailabilityFilter({ nestedMenu, rows }: { nestedMenu: boolean; rows: Array<CardTierRow> }) {
	const router = useRouter()
	const { country, includeUnknown } = resolveCardsFilterState(router.query)

	const countryOptions = useMemo(
		() => [{ key: ALL_COUNTRIES_SELECTION, name: 'All countries' }, ...cardsCountryOptions(rows)],
		[rows]
	)

	return (
		<SelectWithCombobox
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
			variant="filter-responsive"
			size="md"
			searchPlaceholder="Search countries..."
			customHeader={
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
	options,
	selected,
	searchPlaceholder
}: {
	nestedMenu: boolean
	label: string
	queryKey: string
	options: Array<{ key: string; name: string }>
	selected: Array<string>
	searchPlaceholder?: string
}) {
	const router = useRouter()
	return (
		<SelectWithCombobox
			allValues={options}
			selectedValues={selected}
			setSelectedValues={(values) => {
				const nextSelected = Array.isArray(values) ? values : [values]
				const isAll = nextSelected.length === options.length
				void pushShallowQuery(router, {
					[queryKey]: isAll ? undefined : nextSelected.length === 0 ? NONE_SELECTED : nextSelected
				})
			}}
			label={label}
			labelType="smol"
			nestedMenu={nestedMenu}
			variant="filter-responsive"
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
	return (
		<Checkbox
			variant={nestedMenu ? 'filter-borderless' : 'filter'}
			checked={checked}
			onChange={(event) => {
				void pushShallowQuery(router, { [queryKey]: event.target.checked ? 'true' : undefined })
			}}
		>
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

	return nestedMenu ? (
		<button type="button" onClick={resetFilters} disabled={!hasActiveQueryFilters} className={nestedMenuActionStyles}>
			Reset all filters
		</button>
	) : (
		<Button type="button" size="md" onClick={resetFilters} disabled={!hasActiveQueryFilters}>
			Reset all filters
		</Button>
	)
}

function CardsFiltersDropdowns({ nestedMenu, rows }: { nestedMenu?: boolean; rows: Array<CardTierRow> }) {
	const router = useRouter()
	const { custody, cardTypes, networks, chains, physicalOnly, virtualOnly } = resolveCardsFilterState(router.query)
	const chainOptions = useMemo(() => cardsChainOptions(rows), [rows])
	return (
		<>
			<AvailabilityFilter nestedMenu={!!nestedMenu} rows={rows} />
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Type"
				queryKey={CARDS_FILTER_QUERY_KEYS.cardType}
				options={[...CARD_TYPE_OPTIONS]}
				selected={cardTypes}
			/>
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Network"
				queryKey={CARDS_FILTER_QUERY_KEYS.network}
				options={[...NETWORK_OPTIONS]}
				selected={networks}
			/>
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Custody"
				queryKey={CARDS_FILTER_QUERY_KEYS.custody}
				options={[...CUSTODY_OPTIONS]}
				selected={custody}
			/>
			<FacetFilter
				nestedMenu={!!nestedMenu}
				label="Chains"
				queryKey={CARDS_FILTER_QUERY_KEYS.chain}
				options={chainOptions}
				selected={chains ?? chainOptions.map((option) => option.key)}
				searchPlaceholder="Search chains..."
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
