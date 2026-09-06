import { useMemo, useState } from 'react'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { formatNumber } from '~/utils/numberFormat'
import { FDV_RANGES, LISTING_STATUS_LABELS, UTR_SECTORS } from './constants'
import { Leaderboard, type UtrSort } from './Leaderboard'
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

export function UniversalTokenRating({ universe, topMovers, scoringConfig }: UniversalTokenRatingProps) {
	const [docsOpen, setDocsOpen] = useState(false)

	const sectorOptions = useMemo(() => {
		const availableSectors = new Set<string>()
		for (const row of universe.rows) {
			if (row.sector) availableSectors.add(row.sector)
		}
		return availableSectors.size > 0 ? [...availableSectors].sort() : [...UTR_SECTORS]
	}, [universe.rows])

	const [fdvRanges, setFdvRanges] = useState<Array<string>>(() => FDV_RANGES.map((range) => range.key))
	const [sectors, setSectors] = useState<Array<string>>(() => sectorOptions)
	const [listingStatuses, setListingStatuses] = useState<Array<string>>(() => Object.keys(LISTING_STATUS_LABELS))
	const [sort, setSort] = useState<UtrSort>({ key: 'rank', desc: false })
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [searchError, setSearchError] = useState<string | null>(null)
	const [focusRequest, setFocusRequest] = useState<UtrFocusRequest | null>(null)

	const activeFilterCount =
		(fdvRanges.length === FDV_RANGES.length ? 0 : 1) +
		(sectors.length === sectorOptions.length ? 0 : 1) +
		(listingStatuses.length === Object.keys(LISTING_STATUS_LABELS).length ? 0 : 1) +
		(sort.key === 'rank' ? 0 : 1)

	const resetFilters = () => {
		setFdvRanges(FDV_RANGES.map((range) => range.key))
		setSectors(sectorOptions)
		setListingStatuses(Object.keys(LISTING_STATUS_LABELS))
		setSort({ key: 'rank', desc: false })
	}

	const searchProject = () => {
		const match = findUtrSearchMatch(universe.rows, searchQuery)
		if (!match) {
			setSearchError(searchQuery.trim() ? 'No matching token found' : 'Enter a token name or ticker')
			return
		}
		resetFilters()
		setSearchError(null)
		setFocusRequest((current) => ({ asset: match.asset, nonce: (current?.nonce ?? 0) + 1 }))
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

	const filteredRows = useMemo(() => {
		return universe.rows.filter((row) => {
			if (row.fdvUsd == null) {
				if (fdvRanges.length !== FDV_RANGES.length) return false
			} else if (
				!FDV_RANGES.some(
					(range) => fdvRanges.includes(range.key) && row.fdvUsd! >= range.min && row.fdvUsd! < range.max
				)
			) {
				return false
			}
			if (row.sector == null) {
				if (sectors.length !== sectorOptions.length) return false
			} else if (!sectors.includes(row.sector)) {
				return false
			}
			if (!listingStatuses.includes(row.listingStatus)) return false
			return true
		})
	}, [universe.rows, fdvRanges, sectors, listingStatuses, sectorOptions])

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
				<form
					className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[360px]"
					onSubmit={(event) => {
						event.preventDefault()
						searchProject()
					}}
				>
					<label className="min-w-0 flex-1">
						<span className="sr-only">Search tokens</span>
						<Input
							list="utr-project-options"
							value={searchQuery}
							onChange={(event) => {
								setSearchQuery(event.target.value)
								setSearchError(null)
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
					<Button type="submit" size="md" square aria-label="Find token in leaderboard">
						<Icon name="search" height={14} width={14} />
					</Button>
				</form>
				{searchError ? (
					<span id="utr-search-error" role="alert" className="w-full body-sm text-error lg:order-last">
						{searchError}
					</span>
				) : null}
				<span className="max-lg:hidden">
					<SelectWithCombobox
						allValues={FDV_RANGES.map((range) => ({ key: range.key, name: range.label }))}
						selectedValues={fdvRanges}
						setSelectedValues={setFdvRanges}
						label="FDV Range"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				</span>
				<span className="max-lg:hidden">
					<SelectWithCombobox
						allValues={sectorOptions.map((sector) => ({ key: sector, name: sector }))}
						selectedValues={sectors}
						setSelectedValues={setSectors}
						label="Sector"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				</span>
				<span className="max-lg:hidden">
					<SelectWithCombobox
						allValues={Object.entries(LISTING_STATUS_LABELS).map(([key, name]) => ({ key, name }))}
						selectedValues={listingStatuses}
						setSelectedValues={setListingStatuses}
						label="Exchange Listing Status"
						labelType="smol"
						variant="filter"
						size="md"
					/>
				</span>
				<Button
					type="button"
					size="md"
					onClick={() => setFiltersOpen(true)}
					className="flex-1 justify-center lg:hidden"
				>
					Filter
					{activeFilterCount ? <span className="label-sm text-link">({activeFilterCount})</span> : null}
					<Icon name="settings" height={14} width={14} />
				</Button>
				<span className="ml-auto max-lg:ml-0 max-lg:flex-1">
					<Button type="button" size="md" onClick={() => setDocsOpen(true)} className="w-full justify-center">
						Documentation
						<Icon name="file-text" height={14} width={14} />
					</Button>
				</span>
			</div>
			{filterChips.length > 0 ? (
				<div className="flex flex-wrap items-center gap-1.5 lg:hidden">
					{filterChips.map((chip) => (
						<button
							key={chip.key}
							type="button"
							onClick={chip.onRemove}
							className="flex cursor-pointer items-center gap-1.5 rounded-full border border-medium bg-surface px-3 py-1 label-sm text-link"
						>
							{chip.label}
							<Icon name="x" height={12} width={12} />
						</button>
					))}
				</div>
			) : null}

			<Panel padding="none" className="max-lg:hidden">
				<PanelHeader className="justify-between">
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
				<PanelHeader className="justify-between">
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
				fdvOptions={FDV_RANGES.map((range) => ({ key: range.key, name: range.label }))}
				fdvRanges={fdvRanges}
				setFdvRanges={setFdvRanges}
				sectorOptions={sectorOptions.map((sector) => ({ key: sector, name: sector }))}
				sectors={sectors}
				setSectors={setSectors}
				statusOptions={Object.entries(LISTING_STATUS_LABELS).map(([key, name]) => ({ key, name }))}
				listingStatuses={listingStatuses}
				setListingStatuses={setListingStatuses}
				sort={sort}
				setSort={(next) => setSort(next)}
				onReset={resetFilters}
			/>
		</div>
	)
}
