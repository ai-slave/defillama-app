import { useRouter } from 'next/router'
import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { updateQueryFromSelected } from '~/components/Select/query'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { Button } from '~/ui/Button'
import { neighbourRowControl, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { formatNumber } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { FDV_RANGES, LISTING_STATUS_LABELS, UTR_SECTORS } from './constants'
import { filterUtrRows, readUtrFilters, UTR_FILTER_KEYS } from './filters'
import { Leaderboard, scrollToLeaderboardRow, type UtrSort } from './Leaderboard'
import { MobileFiltersDrawer } from './MobileFiltersDrawer'
import { findUtrSearchMatch, type UtrFocusRequest } from './navigation'
import { PerformanceMatrix } from './PerformanceMatrix'
import { CantFindTokenBanner, UtrDisclaimer } from './TokenPage'
import { TopMovers } from './TopMovers'
import type { UtrScoringConfig, UtrTopMover, UtrUniverse } from './types'
import { UtrDocsDrawer } from './UtrDocsDrawer'

export type UniversalTokenRatingProps = {
	universe: UtrUniverse
	topMovers: Array<UtrTopMover>
	scoringConfig?: UtrScoringConfig | null
}

const FDV_OPTIONS = FDV_RANGES.map((range) => ({ key: range.key, name: range.label }))
const STATUS_OPTIONS = Object.entries(LISTING_STATUS_LABELS).map(([key, name]) => ({ key, name }))

const SEARCH_INPUT_ID = 'utr-search-input'

function readPreHydrationSearch() {
	if (typeof window === 'undefined') return ''
	const input = document.getElementById(SEARCH_INPUT_ID)
	return input instanceof HTMLInputElement ? input.value : ''
}

export function UniversalTokenRating({ universe, topMovers, scoringConfig }: UniversalTokenRatingProps) {
	const router = useRouter()
	const [docsOpen, setDocsOpen] = useState(false)

	const sectorOptions = useMemo(() => {
		const availableSectors = new Set<string>()
		for (const row of universe.rows) {
			if (row.sector) availableSectors.add(row.sector)
		}
		return availableSectors.size > 0 ? [...availableSectors].sort() : [...UTR_SECTORS]
	}, [universe.rows])

	const sectorPickerOptions = useMemo(
		() => sectorOptions.map((sector) => ({ key: sector, name: sector })),
		[sectorOptions]
	)

	// Filters live in the URL so a reload or a shared link keeps them; search stays local.
	const filters = useMemo(() => readUtrFilters(router.query, sectorOptions), [router.query, sectorOptions])
	const { fdvRanges, sectors, listingStatuses } = filters
	const { fdv: fdvKeys, sector: sectorKeys, listing: listingKeys } = UTR_FILTER_KEYS
	const setFdvRanges = (values: Array<string>) =>
		updateQueryFromSelected(router, fdvKeys.include, fdvKeys.exclude, [...fdvKeys.all], values)
	const setSectors = (values: Array<string>) =>
		updateQueryFromSelected(router, sectorKeys.include, sectorKeys.exclude, sectorOptions, values)
	const setListingStatuses = (values: Array<string>) =>
		updateQueryFromSelected(router, listingKeys.include, listingKeys.exclude, [...listingKeys.all], values)
	const [sort, setSort] = useState<UtrSort>({ key: 'rank', desc: false })
	const [filtersOpen, setFiltersOpen] = useState(false)
	const filterButtonRef = useRef<HTMLButtonElement>(null)
	// The search is not a form, so nothing submits natively before hydration, and text typed before then is kept,
	// as the site search does.
	const [searchQuery, setSearchQuery] = useState(readPreHydrationSearch)
	const [searchError, setSearchError] = useState<string | null>(null)
	const [focusRequest, setFocusRequest] = useState<UtrFocusRequest | null>(null)

	const activeFilterCount =
		(fdvRanges.length === FDV_RANGES.length ? 0 : 1) +
		(sectors.length === sectorOptions.length ? 0 : 1) +
		(listingStatuses.length === Object.keys(LISTING_STATUS_LABELS).length ? 0 : 1) +
		(sort.key === 'rank' ? 0 : 1)

	const resetFilters = () => {
		setSort({ key: 'rank', desc: false })
		return pushShallowQuery(router, {
			[fdvKeys.include]: undefined,
			[fdvKeys.exclude]: undefined,
			[sectorKeys.include]: undefined,
			[sectorKeys.exclude]: undefined,
			[listingKeys.include]: undefined,
			[listingKeys.exclude]: undefined
		})
	}

	const searchProject = () => {
		const match = findUtrSearchMatch(universe.rows, searchQuery)
		if (!match) {
			setSearchError(searchQuery.trim() ? 'No matching token found' : 'Enter a token name or ticker')
			return
		}
		setSearchError(null)
		// The reset reaches the rows only once the push resolves; a focus request made earlier pages against the
		// filtered rows, and the reset that lands after it returns the leaderboard to page one. Waiting also lets
		// the filter chips collapse before the row scrolls into view.
		void resetFilters().then((navigated) => {
			// A later navigation cancelled this one, so the filters were not reset.
			if (!navigated) return
			flushSync(() => setFocusRequest((current) => ({ asset: match.asset, nonce: (current?.nonce ?? 0) + 1 })))
			scrollToLeaderboardRow(match.asset)
		})
	}

	const filterChips: Array<{ key: string; label: string; onRemove: () => void }> = []
	if (fdvRanges.length !== FDV_RANGES.length) {
		for (const range of FDV_RANGES.filter((range) => fdvRanges.includes(range.key))) {
			filterChips.push({
				key: `fdv-${range.key}`,
				label: range.label,
				onRemove: () => setFdvRanges(fdvRanges.filter((key) => key !== range.key))
			})
		}
	}
	if (sectors.length !== sectorOptions.length) {
		for (const sector of sectors) {
			filterChips.push({
				key: `sector-${sector}`,
				label: sector,
				onRemove: () => setSectors(sectors.filter((key) => key !== sector))
			})
		}
	}
	if (listingStatuses.length !== Object.keys(LISTING_STATUS_LABELS).length) {
		for (const status of listingStatuses) {
			filterChips.push({
				key: `status-${status}`,
				label: LISTING_STATUS_LABELS[status as keyof typeof LISTING_STATUS_LABELS] ?? status,
				onRemove: () => setListingStatuses(listingStatuses.filter((key) => key !== status))
			})
		}
	}

	const filteredRows = useMemo(
		() => filterUtrRows(universe.rows, filters, sectorOptions),
		[universe.rows, filters, sectorOptions]
	)

	const scoredLabel = (
		<span className="body-sm text-secondary">
			<strong className="text-primary">{formatNumber(universe.scoredCount)}</strong> of{' '}
			{formatNumber(universe.totalCount)} tokens scored
		</span>
	)

	if (universe.rows.length === 0) return null

	return (
		<div className="flex flex-col gap-2">
			<TopMovers movers={topMovers} />

			<div className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle bg-surface p-2">
				<div role="search" className="flex min-w-0 flex-1 items-center gap-2 max-lg:basis-full lg:max-w-[360px]">
					<label className="min-w-0 flex-1">
						<span className="sr-only">Search tokens</span>
						<Input
							id={SEARCH_INPUT_ID}
							list="utr-project-options"
							value={searchQuery}
							onChange={(event) => {
								setSearchQuery(event.target.value)
								setSearchError(null)
							}}
							onKeyDown={(event) => {
								if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
								event.preventDefault()
								searchProject()
							}}
							placeholder="Search token or ticker"
							aria-invalid={searchError ? true : undefined}
							aria-describedby={searchError ? 'utr-search-error' : undefined}
							className="w-full"
						/>
						<datalist id="utr-project-options">
							{universe.rows.map((row) => (
								<option key={row.asset} value={`${row.name} (${row.symbol})`} />
							))}
						</datalist>
					</label>
					<Button type="button" size="md" square aria-label="Find token in leaderboard" onClick={searchProject}>
						<Icon name="search" height={14} width={14} />
					</Button>
				</div>
				{searchError ? (
					<span id="utr-search-error" role="alert" className="w-full body-sm text-error lg:order-last">
						{searchError}
					</span>
				) : null}
				<span className="max-lg:hidden">
					<SelectWithCombobox
						allValues={FDV_OPTIONS}
						includeQueryKey={fdvKeys.include}
						excludeQueryKey={fdvKeys.exclude}
						label="FDV Range"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				</span>
				<span className="max-lg:hidden">
					<SelectWithCombobox
						allValues={sectorPickerOptions}
						includeQueryKey={sectorKeys.include}
						excludeQueryKey={sectorKeys.exclude}
						label="Sector"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				</span>
				<span className="max-lg:hidden">
					<SelectWithCombobox
						allValues={STATUS_OPTIONS}
						includeQueryKey={listingKeys.include}
						excludeQueryKey={listingKeys.exclude}
						label="Exchange Listing Status"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				</span>
				<Button
					ref={filterButtonRef}
					type="button"
					size="md"
					onClick={() => setFiltersOpen(true)}
					className="ml-auto lg:hidden"
				>
					Filter
					{activeFilterCount ? <span className="label-sm text-link">({activeFilterCount})</span> : null}
					<Icon name="settings" height={14} width={14} />
				</Button>
				<Button type="button" size="md" onClick={() => setDocsOpen(true)} className="lg:ml-auto">
					Documentation
					<Icon name="file-text" height={14} width={14} />
				</Button>
			</div>
			{filterChips.length > 0 ? (
				<div className="flex flex-wrap items-center gap-1.5 lg:hidden">
					{filterChips.map((chip) => (
						<button
							key={chip.key}
							type="button"
							onClick={chip.onRemove}
							// The chip leaves once the URL drops its filter. It hands focus to the next chip, else the previous
							// one, else the Filter button.
							ref={passFocusOnLeave((node) => neighbourRowControl(node, node) ?? filterButtonRef.current)}
							className="flex cursor-pointer items-center gap-1.5 rounded-full border border-medium bg-surface px-3 py-1 label-sm text-link"
						>
							<span className="sr-only">Remove </span>
							{chip.label}
							<Icon name="x" height={12} width={12} />
						</button>
					))}
				</div>
			) : null}

			<Panel padding="none" className="max-lg:hidden">
				<PanelHeader>
					<PanelTitle>Performance Matrix</PanelTitle>
					{scoredLabel}
				</PanelHeader>
				<PerformanceMatrix rows={filteredRows} grading={scoringConfig?.grading} />
			</Panel>

			<Panel padding="none" className="lg:hidden">
				<PanelHeader>
					<PanelTitle>Top-10 Project Rating Matrix</PanelTitle>
				</PanelHeader>
				<PerformanceMatrix
					rows={filteredRows.slice(0, 10)}
					grading={scoringConfig?.grading}
					className="h-[320px] w-full"
				/>
				<div className="p-3">
					<div className="flex items-center gap-2 rounded-lg bg-surface-elevated-1 px-3 py-2.5 body-sm text-secondary">
						<Icon name="circle-help" height={16} width={16} className="shrink-0 text-link" />
						View the full chart on desktop
					</div>
				</div>
			</Panel>

			<Panel padding="none">
				<PanelHeader>
					<PanelTitle>Leaderboard Ranking</PanelTitle>
					{scoredLabel}
				</PanelHeader>
				<Leaderboard
					rows={filteredRows}
					fdvRanges={fdvRanges}
					sectors={sectors}
					listingStatuses={listingStatuses}
					grading={scoringConfig?.grading}
					sort={sort}
					setSort={setSort}
					focusRequest={focusRequest}
				/>
			</Panel>

			<CantFindTokenBanner />
			<UtrDisclaimer />

			<UtrDocsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} scoringConfig={scoringConfig} />
			<MobileFiltersDrawer
				open={filtersOpen}
				onClose={() => setFiltersOpen(false)}
				fdvOptions={FDV_OPTIONS}
				fdvRanges={fdvRanges}
				setFdvRanges={setFdvRanges}
				sectorOptions={sectorPickerOptions}
				sectors={sectors}
				setSectors={setSectors}
				statusOptions={STATUS_OPTIONS}
				listingStatuses={listingStatuses}
				setListingStatuses={setListingStatuses}
				sort={sort}
				setSort={setSort}
				canReset={activeFilterCount > 0 || sort.desc}
				onReset={resetFilters}
			/>
		</div>
	)
}
