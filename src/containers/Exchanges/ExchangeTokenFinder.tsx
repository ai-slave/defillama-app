import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { MultiSelectCombobox } from '~/components/Select/MultiSelectCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import type { TokenExchangeListing } from '~/containers/Markets/api.types'
import { fetchTokenExchangeListings } from '~/containers/Token/api'
import { hydrateTokenSearchOptionsByIds, mergeTokenSearchResults, searchTokens } from '~/containers/TokenSearch/search'
import { TOKEN_SEARCH_LIMIT } from '~/containers/TokenSearch/types'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { focusRegionOnLeave } from '~/ui/focus'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { letterLogoDataUri } from '~/utils/icons'
import { pushShallowQuery } from '~/utils/routerQuery'
import { resolveCountryAvailability } from './countryAvailability'
import { ExchangeCountrySelect, type useExchangeCountry } from './ExchangeCountrySelect'
import type { MasterExchangeRegionCatalogResponse } from './master.types'
import type { ExchangeDirectoryModel, ExchangeSegment } from './models'
import {
	EXCHANGES_QUERY_KEYS,
	getTokenFinderMode,
	getTokenFinderTokens,
	type TokenFinderMode,
	withCountryParam
} from './queryState'

const SEGMENTS = new Set<ExchangeSegment>(['spot', 'linear_perp', 'inverse_perp'])
const EMPTY_TOKEN_LISTINGS: Array<TokenExchangeListing> = []
const SEGMENT_LABELS: Record<ExchangeSegment, string> = {
	spot: 'Spot',
	linear_perp: 'USD Perps',
	inverse_perp: 'COIN Perps'
}

interface FinderRow {
	slug: string
	name: string
	volume24h: number | null
	listings: Array<{ token: string; segments: Array<ExchangeSegment> }>
}

export function buildTokenFinderRows({
	selectedTokens,
	tokens,
	mode,
	directory,
	country,
	catalog
}: {
	selectedTokens: Array<string>
	tokens: Array<TokenExchangeListing>
	mode: TokenFinderMode
	directory: ExchangeDirectoryModel
	country: string | null
	catalog: MasterExchangeRegionCatalogResponse | null
}): Array<FinderRow> {
	const selected = new Set(selectedTokens)
	const directoryBySlug = new Map<string, ExchangeDirectoryModel['rows'][number]>()
	for (const venue of directory.rows) directoryBySlug.set(venue.slug, venue)
	const rows = new Map<
		string,
		{ name: string; volume24h: number | null; listings: Map<string, { token: string; segments: Set<ExchangeSegment> }> }
	>()
	for (const token of tokens) {
		if (!selected.has(token.coingecko_id)) continue
		for (const listing of token.venues) {
			const venue = directoryBySlug.get(listing.slug)
			if (!venue) continue
			let availableSegments: Array<ExchangeSegment> | null = null
			if (country && catalog) {
				if (!venue.regional) continue
				const availability = resolveCountryAvailability(catalog, venue.regional, country)
				if (availability.availability === 'unavailable') continue
				availableSegments = availability.segments
			}
			const segments = new Set<ExchangeSegment>()
			for (const segment of listing.segments) {
				if (!SEGMENTS.has(segment)) continue
				if (availableSegments && !availableSegments.includes(segment)) continue
				segments.add(segment)
			}
			if (segments.size === 0) continue
			let row = rows.get(listing.slug)
			if (!row) {
				row = { name: venue.name, volume24h: venue.totalVolume24h, listings: new Map() }
				rows.set(listing.slug, row)
			}
			row.listings.set(token.coingecko_id, { token: token.symbol, segments })
		}
	}

	const result: Array<FinderRow> = []
	for (const [slug, row] of rows) {
		if (mode === 'all' && row.listings.size !== selectedTokens.length) continue
		const listings: FinderRow['listings'] = []
		for (const listing of row.listings.values()) {
			listings.push({ token: listing.token, segments: [...listing.segments] })
		}
		result.push({
			slug,
			name: row.name,
			volume24h: row.volume24h,
			listings
		})
	}
	return result.sort((a, b) => {
		if (a.volume24h == null && b.volume24h != null) return 1
		if (a.volume24h != null && b.volume24h == null) return -1
		return (b.volume24h ?? 0) - (a.volume24h ?? 0) || a.name.localeCompare(b.name)
	})
}

export function ExchangeTokenFinder({
	directory,
	countryState
}: {
	directory: ExchangeDirectoryModel
	countryState: ReturnType<typeof useExchangeCountry>
}) {
	const router = useRouter()
	const selectedTokens = useMemo(() => getTokenFinderTokens(router.query), [router.query])
	const mode = getTokenFinderMode(router.query)
	const [tokenSearch, setTokenSearch] = useState('')
	const debouncedTokenSearch = useDebouncedValue(tokenSearch, 200)
	const tokenSearchQuery = useQuery({
		queryKey: ['exchange-token-finder', 'token-search', debouncedTokenSearch],
		queryFn: () => searchTokens(debouncedTokenSearch, TOKEN_SEARCH_LIMIT),
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})
	const selectedTokenQuery = useQuery({
		queryKey: ['exchange-token-finder', 'selected-tokens', selectedTokens],
		queryFn: () => hydrateTokenSearchOptionsByIds(selectedTokens),
		enabled: selectedTokens.length > 0,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})
	const listingsQuery = useQuery({
		queryKey: ['exchange-token-finder'],
		queryFn: fetchTokenExchangeListings,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false
	})
	const tokens = listingsQuery.data?.tokens ?? EMPTY_TOKEN_LISTINGS
	const tokenOptions = useMemo(
		() =>
			mergeTokenSearchResults(tokenSearchQuery.data ?? [], selectedTokenQuery.data ?? []).map((token) => ({
				value: token.id,
				label: `${token.name} (${token.symbol.toUpperCase()})`,
				selectedLabel: token.symbol.toUpperCase(),
				logo: token.logo
			})),
		[tokenSearchQuery.data, selectedTokenQuery.data]
	)
	const rows = useMemo(
		() =>
			buildTokenFinderRows({
				selectedTokens,
				tokens,
				mode,
				directory,
				country: countryState.country,
				catalog: countryState.catalog
			}),
		[selectedTokens, tokens, mode, directory, countryState.country, countryState.catalog]
	)

	return (
		<div className="flex flex-col gap-2">
			<Card padding="sm" className="flex flex-col gap-2">
				<div className="flex flex-wrap gap-2">
					<div className="min-w-0 basis-full lg:flex-1 lg:basis-96">
						<MultiSelectCombobox
							heading="Tokens"
							data={tokenOptions}
							placeholder="Select up to 8 tokens"
							selectedValues={selectedTokens}
							filterOptions={false}
							onSearchChange={setTokenSearch}
							isLoading={tokenSearchQuery.isLoading}
							emptyMessage={tokenSearchQuery.isError ? 'Token search failed.' : 'No tokens found.'}
							setSelectedValues={(values) => {
								void pushShallowQuery(router, {
									[EXCHANGES_QUERY_KEYS.tokenFinderTokens]: values.slice(0, 8).join(',') || undefined
								})
							}}
						/>
					</div>
					<SegmentedControl<TokenFinderMode>
						value={mode}
						onValueChange={(nextMode) => {
							void pushShallowQuery(router, {
								[EXCHANGES_QUERY_KEYS.tokenFinderMode]: nextMode === 'all' ? undefined : nextMode
							})
						}}
						options={[
							{ value: 'all', label: 'Must list all' },
							{ value: 'any', label: 'Can list any' }
						]}
						label="Token matching"
						variant="default"
						size="md"
					/>
					<div className="min-w-0">
						<ExchangeCountrySelect
							catalog={countryState.catalog}
							catalogFailed={countryState.catalogFailed}
							selectedCountry={countryState.country}
							onCountryChange={countryState.setCountry}
						/>
					</div>
				</div>
				<p className="body-sm text-secondary">
					“Must list all” needs every selected token; “Can list any” needs at least one. Picking a country drops the
					segments unavailable there.
				</p>
			</Card>

			<Card padding="none" className="overflow-x-auto">
				{selectedTokens.length === 0 ? (
					<p className="p-4 body-sm text-tertiary">Select one or more tokens to find exchanges.</p>
				) : listingsQuery.isPending ? (
					<div className="flex min-h-32 items-center justify-center">
						<LoadingIndicator />
					</div>
				) : listingsQuery.isError ? (
					<div className="p-4">
						<InlineStatus
							variant="error"
							action={
								<Button
									// The retry leaves once the read succeeds; the region keeps focus.
									ref={focusRegionOnLeave}
									size="sm"
									onClick={() => void listingsQuery.refetch()}
									pendingLabel="Retrying…"
									pending={listingsQuery.isFetching}
								>
									Try again
								</Button>
							}
						>
							Token listings failed to load.
						</InlineStatus>
					</div>
				) : rows.length === 0 ? (
					<p className="p-4 body-sm text-tertiary">No exchanges match the selected tokens and region.</p>
				) : (
					<table className="w-full text-left body-sm">
						<thead>
							<tr className="border-b border-subtle">
								<th className="w-[32%] px-4 py-3 label-sm">Exchange</th>
								<th className="px-4 py-3 label-sm">Listings</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.slug} className="border-b border-subtle last:border-0">
									<td className="px-4 py-2.5">
										<BasicLink
											href={withCountryParam(`/exchange/${row.slug}`, countryState.country)}
											className="flex min-w-0 items-center gap-2 text-link hover:underline"
										>
											<TokenLogo
												name={row.slug}
												kind="exchange"
												size={24}
												fallbackSrc={letterLogoDataUri(row.name)}
												alt={`${row.name} logo`}
											/>
											<span className="truncate label-md">{row.name}</span>
										</BasicLink>
									</td>
									<td className="px-4 py-2.5 text-secondary">
										{row.listings
											.map(
												({ token, segments }) =>
													`${token.toUpperCase()} · ${segments.map((segment) => SEGMENT_LABELS[segment]).join(', ')}`
											)
											.join('; ')}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</Card>
		</div>
	)
}
