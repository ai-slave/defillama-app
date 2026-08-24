import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import type { SelectOption } from '~/components/Select/types'
import { pushShallowQuery } from '~/utils/routerQuery'
import { fetchExchangeRegionCatalog } from './master.api'
import type { MasterExchangeRegionCatalogResponse } from './master.types'
import { EXCHANGES_QUERY_KEYS, parseExchangeCountry } from './queryState'

const GLOBAL_COUNTRY_SELECTION = 'global'

/** Countries pinned to the top of the dropdown, in this order; the rest follow alphabetically. */
const POPULAR_COUNTRIES = [
	'US',
	'GB',
	'DE',
	'NL',
	'FR',
	'ES',
	'IT',
	'CH',
	'CA',
	'JP',
	'KR',
	'IN',
	'AE',
	'TR',
	'BR',
	'AR',
	'AU',
	'SG',
	'HK',
	'MX',
	'NG',
	'ZA',
	'CN'
] as const

const POPULARITY_RANK = new Map<string, number>(POPULAR_COUNTRIES.map((country, index) => [country, index]))

/** Popular countries first (in POPULAR_COUNTRIES order), then the rest alphabetically by display label. */
export function orderCountryOptions(options: SelectOption[]): SelectOption[] {
	return [...options].sort((left, right) => {
		const leftRank = POPULARITY_RANK.get(left.key) ?? POPULAR_COUNTRIES.length
		const rightRank = POPULARITY_RANK.get(right.key) ?? POPULAR_COUNTRIES.length
		if (leftRank !== rightRank) return leftRank - rightRank
		return left.name.localeCompare(right.name)
	})
}

const CATALOG_STALE_TIME = 60 * 60 * 1000

const COUNTRY_DISPLAY_NAMES =
	typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null

export function countryLabel(country: string): string {
	try {
		return COUNTRY_DISPLAY_NAMES?.of(country) ?? country
	} catch {
		return country
	}
}

function useExchangeRegionCatalog(): {
	catalog: MasterExchangeRegionCatalogResponse | null
	catalogFailed: boolean
} {
	const query = useQuery({
		queryKey: ['exchange-region-catalog'],
		queryFn: fetchExchangeRegionCatalog,
		staleTime: CATALOG_STALE_TIME,
		refetchOnWindowFocus: false
	})
	return { catalog: query.data ?? null, catalogFailed: query.isError }
}

export function resolveExchangeCountry(
	query: Parameters<typeof parseExchangeCountry>[0],
	catalog: MasterExchangeRegionCatalogResponse | null
): string | null {
	const country = parseExchangeCountry(query)
	return country && catalog && country in catalog.country_regions ? country : null
}

/** The single URL-derived country state used by every Exchanges surface. */
export function useExchangeCountry() {
	const router = useRouter()
	const { catalog, catalogFailed } = useExchangeRegionCatalog()
	const country = resolveExchangeCountry(router.query, catalog)
	const setCountry = useCallback(
		(nextCountry: string | null) =>
			pushShallowQuery(router, {
				[EXCHANGES_QUERY_KEYS.country]: nextCountry?.toLowerCase()
			}),
		[router]
	)
	return { country, setCountry, catalog, catalogFailed }
}

function countryOptions(catalog: MasterExchangeRegionCatalogResponse | null): SelectOption[] {
	const countries: SelectOption[] = []
	if (catalog) {
		for (const country of catalog.countries) {
			const regionKey = catalog.country_regions[country]
			const region = regionKey ? catalog.regions[regionKey] : undefined
			if (!region) throw new Error(`Missing region for ${country}`)
			countries.push({
				key: country,
				name: countryLabel(country),
				help: region.label
			})
		}
	}
	return [{ key: GLOBAL_COUNTRY_SELECTION, name: 'Global default' }, ...orderCountryOptions(countries)]
}

export function ExchangeCountrySelect({
	catalog,
	catalogFailed = false,
	selectedCountry,
	onCountryChange
}: {
	catalog: MasterExchangeRegionCatalogResponse | null
	catalogFailed?: boolean
	selectedCountry: string | null
	onCountryChange: (country: string | null) => void
}) {
	const options = useMemo(() => countryOptions(catalog), [catalog])
	return (
		<>
			<SelectWithCombobox
				allValues={options}
				selectedValues={[selectedCountry ?? GLOBAL_COUNTRY_SELECTION]}
				setSelectedValues={(values) => {
					const country = values[0]
					onCountryChange(!country || country === GLOBAL_COUNTRY_SELECTION ? null : country)
				}}
				label="Country"
				labelType="regular"
				singleSelect
				variant="filter-responsive"
				size="md"
				searchPlaceholder="Search countries..."
				triggerProps={{ disabled: catalog === null }}
			/>
			{catalogFailed ? (
				<p className="body-sm text-warning" role="status">
					Country filter unavailable, showing global data
				</p>
			) : null}
		</>
	)
}
