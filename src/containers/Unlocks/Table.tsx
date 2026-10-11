import type { ParsedUrlQuery } from 'node:querystring'
import {
	type ColumnFiltersState,
	createColumnHelper,
	type ExpandedState,
	type SortingState,
	useTable
} from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { startTransition, useDeferredValue, useMemo, useState } from 'react'
import { Bookmark } from '~/components/Bookmark'
import { FilterBetweenRange } from '~/components/Filters/FilterBetweenRange'
import { BasicLink } from '~/components/Link'
import { readSelectionFromQuery } from '~/components/Select/query'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { expandedFilteredTableFeatures } from '~/components/Table/features/expandedFiltering'
import { getColumnSelectState, getColumnVisibilityForSelection } from '~/components/Table/search/columnSelect'
import { useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { TokenLogo } from '~/components/TokenLogo'
import type { EnrichedProtocolEmission } from '~/containers/Unlocks/queries'
import { UnconstrainedSmolLineChart } from '~/containers/Unlocks/UnconstrainedSmolLineChart'
import { UpcomingEvent } from '~/containers/Unlocks/UpcomingEvent'
import { setStorageItem, useStorageItem } from '~/contexts/localStorageStore'
import { useNowSeconds } from '~/hooks/useNowSeconds'
import type { FormSubmitEvent } from '~/types/forms'
import { Button, StableLabel } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { searchFieldWrapperStyles } from '~/ui/Input'
import { SearchField } from '~/ui/SearchField'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatPercent, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery, readSingleQueryValue } from '~/utils/routerQuery'

const optionsKey = 'unlockTable'

interface IUnlocksTableProps {
	protocols: Array<EnrichedProtocolEmission>
	showOnlyWatchlist: boolean
	savedProtocols: Set<string>
	/** The page's clock at render time; the table hides events that passed before it. */
	initialNowSec: number
}
const columnHelper = createColumnHelper<typeof expandedFilteredTableFeatures, EnrichedProtocolEmission>()

const formatUnlockTypeLabel = (type: string) =>
	type
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ')

export function getUnlockTypes(protocols: Array<EnrichedProtocolEmission>): Array<string> {
	const categories = new Set<string>()
	for (const protocol of protocols) {
		for (const event of protocol.events) categories.add(event.category)
	}
	return Array.from(categories).sort((a, b) => a.localeCompare(b))
}

export interface UnlockTableFilterOptions {
	showOnlyWatchlist: boolean
	savedProtocols: Set<string>
	allUnlockTypes: Array<string>
	selectedUnlockTypes: Array<string>
	minUnlockValue: number | null
	maxUnlockValue: number | null
	minPerc: number | ''
	maxPerc: number | ''
}

export const parseUnlockFilterValue = (value: string | Array<string> | undefined): number | '' => {
	if (typeof value !== 'string' || value === '') return ''
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : ''
}

/** The table filters the Upcoming Unlocks chart cannot follow: it draws every protocol's schedule. */
export function hasActiveUnlockTableFilters(query: ParsedUrlQuery, unlockTypes: Array<string>): boolean {
	return (
		readSingleQueryValue(query.watchlist) === 'true' ||
		readSelectionFromQuery(query, 'unlockType', 'excludeUnlockType', unlockTypes).length !== unlockTypes.length ||
		parseUnlockFilterValue(query.minUnlockValue) !== '' ||
		parseUnlockFilterValue(query.maxUnlockValue) !== '' ||
		parseUnlockFilterValue(query.minUnlockPerc) !== '' ||
		parseUnlockFilterValue(query.maxUnlockPerc) !== ''
	)
}

export const filterUnlockTableProtocols = (
	protocols: Array<EnrichedProtocolEmission>,
	{
		showOnlyWatchlist,
		savedProtocols,
		allUnlockTypes,
		selectedUnlockTypes,
		minUnlockValue,
		maxUnlockValue,
		minPerc,
		maxPerc
	}: UnlockTableFilterOptions
): Array<EnrichedProtocolEmission> => {
	const isCategoryFilterActive = selectedUnlockTypes.length !== allUnlockTypes.length
	const isValueFilterActive = minUnlockValue !== null || maxUnlockValue !== null
	const isPercentageFilterActive = minPerc !== '' || maxPerc !== ''
	const isAnyFilterActive =
		showOnlyWatchlist || isCategoryFilterActive || isValueFilterActive || isPercentageFilterActive

	if (!isAnyFilterActive) return protocols

	const selectedCategories = isCategoryFilterActive ? new Set(selectedUnlockTypes) : null
	const filteredProtocols: Array<EnrichedProtocolEmission> = []

	for (const protocol of protocols) {
		if (showOnlyWatchlist && !savedProtocols.has(protocol.name)) continue

		const upcomingEvents = protocol.upcomingEvent
		let filteredUpcomingEvents: EnrichedProtocolEmission['upcomingEvent'] | null = null
		if (selectedCategories) {
			for (let index = 0; index < upcomingEvents.length; index++) {
				const event = upcomingEvents[index]!
				if (selectedCategories.has(event.category)) {
					filteredUpcomingEvents?.push(event)
				} else if (filteredUpcomingEvents === null) {
					filteredUpcomingEvents = upcomingEvents.slice(0, index)
				}
			}
		}

		const events = filteredUpcomingEvents ?? upcomingEvents
		if (isCategoryFilterActive && events.length === 0) continue

		let totalUnlockValue: number | null = null
		if ((isValueFilterActive || isPercentageFilterActive) && protocol.tPrice != null && protocol.tPrice > 0) {
			totalUnlockValue = protocol.next24h.total * protocol.tPrice
		}

		if (isValueFilterActive && totalUnlockValue === null) continue
		if (minUnlockValue !== null && totalUnlockValue! < minUnlockValue) continue
		if (maxUnlockValue !== null && totalUnlockValue! > maxUnlockValue) continue

		if (isPercentageFilterActive) {
			const mcap = protocol.mcap
			if (totalUnlockValue === null || mcap == null || mcap <= 0) continue
			const percentageToUnlock = (totalUnlockValue / mcap) * 100
			if (minPerc !== '' && percentageToUnlock < minPerc) continue
			if (maxPerc !== '' && percentageToUnlock > maxPerc) continue
		}

		filteredProtocols.push(filteredUpcomingEvents === null ? protocol : { ...protocol, upcomingEvent: events })
	}

	return filteredProtocols
}

export function UnlocksTable({ protocols, showOnlyWatchlist, savedProtocols, initialNowSec }: IUnlocksTableProps) {
	const router = useRouter()
	const unlockTypes = useMemo(() => getUnlockTypes(protocols), [protocols])
	const unlockTypeOptions = useMemo(
		() => unlockTypes.map((type) => ({ name: formatUnlockTypeLabel(type), key: type })),
		[unlockTypes]
	)

	const setQueryParam = (key: string, value: string | undefined) => {
		void pushShallowQuery(router, { [key]: value })
	}

	const selectedUnlockTypes = useMemo(
		() => readSelectionFromQuery(router.query, 'unlockType', 'excludeUnlockType', unlockTypes),
		[router.query, unlockTypes]
	)

	const {
		minUnlockValue: minUnlockValueQuery,
		maxUnlockValue: maxUnlockValueQuery,
		minUnlockPerc: minUnlockPercQuery,
		maxUnlockPerc: maxUnlockPercQuery
	} = router.query
	const min = parseUnlockFilterValue(minUnlockValueQuery)
	const max = parseUnlockFilterValue(maxUnlockValueQuery)
	const minUnlockValue = min === '' ? null : min
	const maxUnlockValue = max === '' ? null : max
	const minPerc = parseUnlockFilterValue(minUnlockPercQuery)
	const maxPerc = parseUnlockFilterValue(maxUnlockPercQuery)

	const handleUnlockValueSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		const form = e.currentTarget
		const minUnlockValueInput = (form.elements.namedItem('min') as HTMLInputElement | null)?.value ?? ''
		const maxUnlockValueInput = (form.elements.namedItem('max') as HTMLInputElement | null)?.value ?? ''
		void pushShallowQuery(router, {
			minUnlockValue: minUnlockValueInput || undefined,
			maxUnlockValue: maxUnlockValueInput || undefined
		})
	}

	const handleUnlockValueClear = () => {
		void pushShallowQuery(router, {
			minUnlockValue: undefined,
			maxUnlockValue: undefined
		})
	}

	const handleUnlockPercSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		const form = e.currentTarget
		const minUnlockPerc = (form.elements.namedItem('min') as HTMLInputElement | null)?.value ?? ''
		const maxUnlockPerc = (form.elements.namedItem('max') as HTMLInputElement | null)?.value ?? ''
		void pushShallowQuery(router, {
			minUnlockPerc: minUnlockPerc || undefined,
			maxUnlockPerc: maxUnlockPerc || undefined
		})
	}

	const handleUnlockPercClear = () => {
		void pushShallowQuery(router, {
			minUnlockPerc: undefined,
			maxUnlockPerc: undefined
		})
	}

	const rawColumnsInStorage = useStorageItem(optionsKey, '{}')
	const columnsInStorage = useDeferredValue(rawColumnsInStorage)

	// Columns missing from the stored map are visible, so columns added later show up for returning readers.
	const columnVisibility = useMemo(() => {
		try {
			return JSON.parse(columnsInStorage) as Record<string, boolean>
		} catch {
			// A corrupt stored value falls back to the defaults.
			return {}
		}
	}, [columnsInStorage])

	const [sorting, setSorting] = useState<SortingState>([{ id: 'upcomingEvent', desc: false }])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [expanded, setExpanded] = useState<ExpandedState>({})

	const filteredData = useMemo(() => {
		return filterUnlockTableProtocols(protocols, {
			showOnlyWatchlist,
			savedProtocols,
			allUnlockTypes: unlockTypes,
			selectedUnlockTypes,
			minUnlockValue,
			maxUnlockValue,
			minPerc,
			maxPerc
		})
	}, [
		protocols,
		savedProtocols,
		showOnlyWatchlist,
		unlockTypes,
		selectedUnlockTypes,
		minUnlockValue,
		maxUnlockValue,
		minPerc,
		maxPerc
	])

	const nowSec = useNowSeconds(initialNowSec)
	const columns = useMemo(() => [...emissionsColumns, upcomingEventColumn(nowSec)], [nowSec])

	const instance = useTable({
		features: expandedFilteredTableFeatures,
		data: filteredData,
		columns,
		state: {
			sorting,
			columnFilters,
			expanded,
			columnVisibility
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		filterFromLeafRows: true,
		onSortingChange: (updater) => startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => startTransition(() => setColumnFilters(updater)),
		onExpandedChange: (updater) => startTransition(() => setExpanded(updater))
	})
	const leafColumns = instance.getAllLeafColumns()
	const columnSelect = getColumnSelectState(leafColumns, columnVisibility)
	const [projectName, setProjectName] = useTableSearch({
		instance,
		columnToSearch: 'name'
	})

	return (
		<Card padding="none">
			<TableToolbar>
				<SearchField
					label="Search projects"
					name="search"
					value={projectName}
					onChange={setProjectName}
					placeholder="Search projects…"
					className={searchFieldWrapperStyles}
				/>

				<Button
					type="button"
					onClick={() => setQueryParam('watchlist', showOnlyWatchlist ? undefined : 'true')}
					size="md"
					aria-pressed={showOnlyWatchlist}
				>
					<Icon name="bookmark" className={showOnlyWatchlist ? 'size-4 fill-current' : 'size-4'} />
					<StableLabel
						labels={['Show Watchlist', 'Show All']}
						current={showOnlyWatchlist ? 'Show All' : 'Show Watchlist'}
					/>
				</Button>

				<FilterBetweenRange
					heading="Next 24h Value"
					trigger={<span>Next 24h Value</span>}
					onSubmit={handleUnlockValueSubmit}
					onClear={handleUnlockValueClear}
					min={min ?? ''}
					max={max ?? ''}
					variant="primary"
					size="md"
					placement="bottom-start"
				/>

				<FilterBetweenRange
					heading="Next 24h %"
					trigger={<span>Next 24h %</span>}
					onSubmit={handleUnlockPercSubmit}
					onClear={handleUnlockPercClear}
					min={minPerc ?? ''}
					max={maxPerc ?? ''}
					variant="primary"
					size="md"
					placement="bottom-start"
				/>

				<SelectWithCombobox
					allValues={columnSelect.options}
					selectedValues={columnSelect.selected}
					setSelectedValues={(selected: Array<string>) =>
						setStorageItem(optionsKey, JSON.stringify(getColumnVisibilityForSelection(leafColumns, selected)))
					}
					nestedMenu={false}
					label="Columns"
					labelType="smol"
					variant="filter"
					size="md"
				/>

				<SelectWithCombobox
					allValues={unlockTypeOptions}
					includeQueryKey="unlockType"
					excludeQueryKey="excludeUnlockType"
					nestedMenu={false}
					label="Next Event Types"
					labelType="smol"
					variant="filter"
					size="md"
				/>
			</TableToolbar>
			<VirtualTable table={instance} stripedBg rowSize={56} />
		</Card>
	)
}

const emissionsColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableHiding: false,
		filterFn: (row, _columnId, filterValue) => {
			const searchValue = String(filterValue ?? '')
				.toLowerCase()
				.trim()
			if (!searchValue) return true
			const nameMatch = row.original.name.toLowerCase().includes(searchValue)
			const symbolMatch = row.original.tSymbol?.toLowerCase().includes(searchValue) ?? false
			return nameMatch || symbolMatch
		},
		enableSorting: false,
		cell: ({ row }) => {
			const protocolName = row.original.name
			const geckoId = row.original.gecko_id
			return (
				<div className="flex h-full items-center">
					<span className="relative flex items-center gap-2 pl-6">
						<Bookmark size="sm" readableName={protocolName} className="absolute -left-1.5 hidden lg:flex" />
						<TokenLogo
							name={protocolName}
							kind="token"
							data-lgonly
							fallbackSrc={geckoId ? geckoTokenIconUrl(geckoId) : null}
							alt={`Logo of ${protocolName}`}
						/>
						<BasicLink
							href={`/unlocks/${slug(protocolName)}`}
							className="min-w-0 truncate label-md text-link hover:underline"
						>
							{protocolName}
						</BasicLink>
					</span>
				</div>
			)
		},
		meta: {
			headerClassName: 'w-[160px] lg:w-[214px]'
		}
	}),
	columnHelper.accessor((row) => row.tPrice ?? undefined, {
		id: 'tPrice',
		header: 'Price',
		cell: ({ row }) => {
			const value = row.original.tPrice
			return (
				<div className="flex h-full items-center justify-end">
					{value != null
						? formatUsd(value, {
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})
						: ''}
				</div>
			)
		},
		meta: {
			headerClassName: 'w-[90px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.mcap ?? undefined, {
		id: 'mcap',
		header: 'Mcap',
		cell: ({ row }) => {
			const value = row.original.mcap
			if (value == null) return null
			return (
				<div className="flex h-full items-center justify-end">
					{formatUsd(value, {
						compact: true,
						minimumCompactValue: 1_000_000,
						compactSuffix: 'lowercase'
					})}
				</div>
			)
		},
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor(
		(row) => {
			if (row.maxSupply <= 0) return undefined
			return Math.max(0, Math.min(100, 100 - (row.totalLocked / row.maxSupply) * 100))
		},
		{
			id: 'totalLocked',
			header: 'Unlocked Supply',
			cell: ({ getValue }) => {
				const pctUnlocked = getValue()
				if (pctUnlocked === undefined) return null

				return (
					<div className="flex h-full w-full flex-col items-end justify-center gap-2 px-2">
						<span className="text-primary">
							{formatPercent(pctUnlocked, {
								input: 'percent',
								compact: true,
								minimumCompactValue: 1_000_000,
								compactSuffix: 'lowercase'
							})}
						</span>
						<div className="h-2 w-full rounded-full bg-surface-elevated-2">
							<div
								className="h-2 rounded-full bg-brand"
								style={{
									width: `${pctUnlocked}%`
								}}
							/>
						</div>
					</div>
				)
			},
			meta: {
				headerClassName: 'w-[152px]',
				align: 'end',
				headerHelperText: 'Share of maximum supply unlocked at the emissions artifact snapshot.'
			}
		}
	),
	columnHelper.accessor((row) => (row.historicalPrice.length > 0 ? row.historicalPrice : undefined), {
		id: 'prevUnlock',
		header: 'Prev. Unlock Analysis',
		cell: ({ row }) => {
			const historicalPrice = row.original.historicalPrice
			if (historicalPrice.length === 0) {
				return <div className="flex h-full items-center justify-end" />
			}
			return (
				<div className="flex h-full items-center justify-end">
					<div className="relative w-full">
						<UnconstrainedSmolLineChart
							series={historicalPrice}
							name=""
							color={
								historicalPrice[Math.floor(historicalPrice.length / 2)]![1] >=
								historicalPrice[historicalPrice.length - 1]![1]
									? 'red'
									: 'green'
							}
							className="h-[36px]"
							extraData={{
								lastEvent: row.original.lastEvent
							}}
						/>
					</div>
				</div>
			)
		},
		meta: {
			headerClassName: 'w-[min(184px,40vw)]',
			align: 'end',
			headerHelperText:
				"Price trend shown from 7 days before to 7 days after the most recent unlock event. Doesn't include Non-Circulating and Farming emissions."
		}
	}),
	columnHelper.accessor(
		(row) => {
			if (row.historicalPrice.length < 8) return undefined
			const priceAtUnlock = row.historicalPrice[7]![1]
			if (priceAtUnlock <= 0) return undefined
			const priceAfter7d = row.historicalPrice[row.historicalPrice.length - 1]![1]
			return ((priceAfter7d - priceAtUnlock) / priceAtUnlock) * 100
		},
		{
			id: 'postUnlock',
			header: '7d Price Change After Unlock',
			cell: ({ getValue }) => (
				<div className="flex h-full items-center justify-end">
					<Change value={getValue()} />
				</div>
			),
			meta: {
				headerClassName: 'w-[236px]',
				align: 'end',
				headerHelperText:
					'Observed token price change during the 7 days after the most recent unlock. This does not imply that the unlock caused the change.'
			}
		}
	),
	columnHelper.accessor((row) => (row.tPrice != null && row.tPrice > 0 ? row.tPrice * row.next24h.total : undefined), {
		id: 'nextEvent',
		header: 'Next 24h Unlocks',
		cell: ({ row }) => {
			const price = row.original.tPrice
			if (price == null || price <= 0) return <div className="flex h-full items-center justify-end" />
			const next24h = row.original.next24h
			const value = next24h.total * price

			return (
				<div className="flex h-full items-center justify-end">
					<Tooltip
						content={`Cliff: ${formatUsd(next24h.cliff * price)}. Linear: ${formatUsd(next24h.linear * price)}.`}
						render={<span className="flex flex-col gap-1" />}
					>
						{formatUsd(value, {
							compact: true,
							minimumCompactValue: 1_000_000,
							compactSuffix: 'lowercase'
						})}
					</Tooltip>
				</div>
			)
		},
		meta: {
			headerClassName: 'w-[158px]',
			align: 'end',
			headerHelperText:
				'Cliff unlocks plus linear releases accrued during the exact rolling 24-hour period from the emissions artifact snapshot. Events without a known amount or valid snapshot price are excluded.'
		}
	})
])

const upcomingEventColumn = (nowSec: number) =>
	columnHelper.accessor(
		(row) => {
			const timestamp = row.upcomingEvent[0]?.timestamp
			if (!timestamp || timestamp < nowSec) return undefined
			return timestamp
		},
		{
			id: 'upcomingEvent',
			header: 'Next Event',
			cell: ({ row }) => {
				if (row.original.upcomingEvent.length === 0) return null
				const { timestamp } = row.original.upcomingEvent[0]!
				if (!timestamp || timestamp < nowSec) return null

				return (
					<UpcomingEvent
						{...{
							timestamp,
							event: row.original.upcomingEvent,
							price: row.original.tPrice,
							symbol: row.original.tSymbol,
							mcap: row.original.mcap,
							maxSupply: row.original.maxSupply,
							name: row.original.name,
							initialNowSec: nowSec,
							...(row.original.gecko_id !== undefined ? { geckoId: row.original.gecko_id } : {})
						}}
					/>
				)
			},
			meta: {
				headerClassName: 'w-[520px]'
			}
		}
	)
