import { type ColumnDef, createColumnHelper, type SortingState, type VisibilityState } from '@tanstack/react-table'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { TableWithSearch } from '~/components/Table/TableWithSearch'
import { TokenLogo } from '~/components/TokenLogo'
import { Tooltip } from '~/ui/Tooltip'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { geckoTokenIconUrl, letterLogoDataUri } from '~/utils/icons'
import { formatUsd, formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { exchangeDefinitions } from './definitions'
import { sumNullable } from './modelHelpers'
import type { ExchangePairModel, ExchangeSegment } from './models'

/** Venue fields only exist on surfaces that mix venues in one table, such as token markets. */
export type PairTableRow = ExchangePairModel & {
	venue?: string | null
	venueSlug?: string | null
	venueUrl?: string | null
}

const columnHelper = createColumnHelper<PairTableRow>()

function money(value: number | null | undefined) {
	return value == null
		? '–'
		: formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
}

export function formatPairPrice(price: number | null | undefined, quote: string) {
	return price == null
		? '–'
		: `${formatCompactNumber(price, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} ${quote.toUpperCase()}`
}

function percentage(value: number | null | undefined, digits = 2) {
	return value == null
		? '–'
		: `${formatPercent(value, { input: 'fraction', minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false })}`
}

function Change({ value }: { value: number | undefined }) {
	return value == null ? (
		<span className="text-tertiary">–</span>
	) : (
		<span className={value >= 0 ? 'text-data-up' : 'text-data-down'}>
			{value >= 0 ? '+' : ''}
			{percentage(value)}
		</span>
	)
}

function UnsupportedMetric() {
	return <span className="text-tertiary">N/A</span>
}

export function pairDepthTotal(bid: number | null, ask: number | null) {
	return sumNullable([bid, ask])
}

// Perp-only and fee/listing columns stay defined but off by default — reachable via the column selector.
function pairColumnVisibility(): VisibilityState {
	return {
		openInterestUsd: false,
		openInterestChange24h: false,
		fundingRate8h: false,
		markPrice: false,
		indexPrice: false,
		basis: false,
		nextFundingAt: false,
		volumeFreshness: false,
		maxLeverage: false,
		makerFee: false,
		takerFee: false,
		listedAt: false
	}
}

function buildColumns(
	segment: ExchangeSegment,
	capabilities: { openInterest: boolean; funding: boolean; depth: boolean },
	showVenue: boolean
): ColumnDef<PairTableRow, any>[] {
	const isPerp = segment !== 'spot'
	const definitions = exchangeDefinitions.markets
	const columns: ColumnDef<PairTableRow, any>[] = [
		columnHelper.accessor('base', {
			id: 'token',
			header: definitions.token.label,
			enableSorting: false,
			cell: ({ getValue, row }) => {
				const base = getValue()
				const ticker = base.toUpperCase()
				return (
					<span className="flex min-w-0 items-center gap-2">
						<TokenLogo
							src={row.original.baseGeckoId ? geckoTokenIconUrl(row.original.baseGeckoId, 20) : null}
							size={20}
							fallbackSrc={letterLogoDataUri(base)}
							alt=""
						/>
						{ticker ? (
							<BasicLink
								href={`/token/${encodeURIComponent(ticker)}`}
								className="truncate label-md text-link hover:underline"
							>
								{ticker}
							</BasicLink>
						) : (
							<span className="text-tertiary">–</span>
						)}
					</span>
				)
			},
			meta: { headerClassName: 'w-[105px]', headerHelperText: definitions.token.description }
		}),
		columnHelper.accessor('symbol', {
			id: 'pair',
			header: definitions.pair.label,
			enableSorting: false,
			cell: ({ row, getValue }) => (
				<BasicLink
					href={row.original.pairUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="truncate label-md text-link uppercase hover:underline"
				>
					{getValue()}
				</BasicLink>
			),
			meta: { headerClassName: 'w-[135px]', headerHelperText: definitions.pair.description }
		}),
		columnHelper.accessor((row) => row.price ?? undefined, {
			id: 'price',
			header: definitions.price.label,
			cell: ({ row, getValue }) => formatPairPrice(getValue(), row.original.quote),
			meta: { headerClassName: 'w-[150px]', align: 'end', headerHelperText: definitions.price.description }
		}),
		columnHelper.accessor((row) => row.priceChange24h ?? undefined, {
			id: 'priceChange24h',
			header: definitions.priceChange24h.label,
			cell: ({ getValue }) => <Change value={getValue()} />,
			meta: {
				headerClassName: 'w-[95px]',
				align: 'end',
				headerHelperText: definitions.priceChange24h.description
			}
		}),
		columnHelper.accessor((row) => row.volume24h ?? undefined, {
			id: 'volume24h',
			header: definitions.volume24h.label,
			cell: ({ getValue }) => money(getValue()),
			meta: { headerClassName: 'w-[120px]', align: 'end', headerHelperText: definitions.volume24h.description }
		}),
		columnHelper.accessor((row) => row.volumeChange24h ?? undefined, {
			id: 'volumeChange24h',
			header: definitions.volumeChange24h.label,
			cell: ({ getValue }) => <Change value={getValue()} />,
			meta: {
				headerClassName: 'w-[100px]',
				align: 'end',
				headerHelperText: definitions.volumeChange24h.description
			}
		}),
		columnHelper.accessor((row) => row.normalizedVolume?.normalized ?? undefined, {
			id: 'normalizedVolume',
			header: definitions.normalizedVolume.label,
			cell: ({ row, getValue }) => {
				if (segment === 'inverse_perp') return <UnsupportedMetric />
				const nvol = row.original.normalizedVolume
				return nvol ? (
					<Tooltip
						content={`${percentage(nvol.discountFraction)} below ${money(nvol.reported)} reported · ${nvol.status}`}
						className="ms-auto w-fit"
					>
						<span className="underline decoration-dotted">{money(getValue())}</span>
					</Tooltip>
				) : (
					'–'
				)
			},
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end',
				headerHelperText: definitions.normalizedVolume.description
			}
		}),
		columnHelper.accessor((row) => pairDepthTotal(row.depthBid2Usd, row.depthAsk2Usd) ?? undefined, {
			id: 'depth2Usd',
			header: definitions.depth2Usd.label,
			cell: ({ row, getValue }) =>
				capabilities.depth ? (
					<Tooltip
						content={`Bid ${money(row.original.depthBid2Usd)} · Ask ${money(row.original.depthAsk2Usd)}${
							row.original.depthBidMaxDistance != null || row.original.depthAskMaxDistance != null
								? ` · fetched to ${percentage(
										Math.min(
											row.original.depthBidMaxDistance ?? Number.POSITIVE_INFINITY,
											row.original.depthAskMaxDistance ?? Number.POSITIVE_INFINITY
										)
									)}`
								: ''
						}`}
						className="ms-auto w-fit"
					>
						<span className="underline decoration-dotted">{money(getValue())}</span>
					</Tooltip>
				) : (
					<UnsupportedMetric />
				),
			meta: { headerClassName: 'w-[115px]', align: 'end', headerHelperText: definitions.depth2Usd.description }
		}),
		columnHelper.accessor((row) => row.spreadFraction ?? undefined, {
			id: 'spreadFraction',
			header: definitions.spreadFraction.label,
			cell: ({ getValue }) => percentage(getValue(), 3),
			meta: {
				headerClassName: 'w-[90px]',
				align: 'end',
				headerHelperText: definitions.spreadFraction.description
			}
		})
	]

	if (isPerp) {
		columns.push(
			columnHelper.accessor((row) => row.markPrice ?? undefined, {
				id: 'markPrice',
				header: definitions.markPrice.label,
				cell: ({ row, getValue }) => formatPairPrice(getValue(), row.original.quote),
				meta: { headerClassName: 'w-[115px]', align: 'end', headerHelperText: definitions.markPrice.description }
			}),
			columnHelper.accessor((row) => row.indexPrice ?? undefined, {
				id: 'indexPrice',
				header: definitions.indexPrice.label,
				cell: ({ row, getValue }) => formatPairPrice(getValue(), row.original.quote),
				meta: { headerClassName: 'w-[115px]', align: 'end', headerHelperText: definitions.indexPrice.description }
			}),
			columnHelper.accessor((row) => row.basis ?? undefined, {
				id: 'basis',
				header: definitions.basis.label,
				cell: ({ getValue }) => percentage(getValue(), 3),
				meta: { headerClassName: 'w-[90px]', align: 'end', headerHelperText: definitions.basis.description }
			}),
			columnHelper.accessor((row) => row.openInterestUsd ?? undefined, {
				id: 'openInterestUsd',
				header: definitions.openInterestUsd.label,
				cell: ({ getValue }) => (capabilities.openInterest ? money(getValue()) : <UnsupportedMetric />),
				meta: {
					headerClassName: 'w-[125px]',
					align: 'end',
					headerHelperText: definitions.openInterestUsd.description
				}
			}),
			columnHelper.accessor((row) => row.openInterestChange24h ?? undefined, {
				id: 'openInterestChange24h',
				header: definitions.openInterestChange24h.label,
				cell: ({ getValue }) => (capabilities.openInterest ? <Change value={getValue()} /> : <UnsupportedMetric />),
				meta: {
					headerClassName: 'w-[90px]',
					align: 'end',
					headerHelperText: definitions.openInterestChange24h.description
				}
			}),
			columnHelper.accessor((row) => row.fundingRate8h ?? undefined, {
				id: 'fundingRate8h',
				header: definitions.fundingRate8h.label,
				cell: ({ row, getValue }) => {
					if (!capabilities.funding) return <UnsupportedMetric />
					if (getValue() == null) return <span className="text-tertiary">–</span>
					return (
						<Tooltip
							content={`Raw venue period: ${row.original.fundingPeriodHours ?? 'unknown'}h; normalized to 8h`}
							className="ms-auto w-fit"
						>
							<span className="underline decoration-dotted">{percentage(getValue(), 4)}</span>
						</Tooltip>
					)
				},
				meta: { headerClassName: 'w-[105px]', align: 'end', headerHelperText: definitions.fundingRate8h.description }
			}),
			columnHelper.accessor((row) => row.nextFundingAt ?? undefined, {
				id: 'nextFundingAt',
				header: definitions.nextFundingAt.label,
				cell: ({ getValue }) =>
					capabilities.funding ? (
						getValue() == null ? (
							'–'
						) : (
							<span className="whitespace-nowrap">
								{formatDateTime(getValue(), { input: 'seconds', timeZone: 'UTC' }) ?? '–'}
							</span>
						)
					) : (
						<UnsupportedMetric />
					),
				meta: { headerClassName: 'w-[220px]', align: 'end', headerHelperText: definitions.nextFundingAt.description }
			}),
			columnHelper.accessor((row) => row.maxLeverage ?? undefined, {
				id: 'maxLeverage',
				header: definitions.maxLeverage.label,
				cell: ({ getValue }) => (getValue() == null ? '–' : `${getValue()}×`),
				meta: { headerClassName: 'w-[105px]', align: 'end', headerHelperText: definitions.maxLeverage.description }
			})
		)
	}

	columns.push(
		columnHelper.accessor('volumeUpdatedAt', {
			id: 'volumeFreshness',
			header: definitions.volumeFreshness.label,
			cell: ({ getValue }) => getValue()?.slice(0, 10) ?? '–',
			meta: { headerClassName: 'w-[115px]', align: 'end', headerHelperText: definitions.volumeFreshness.description }
		}),
		columnHelper.accessor((row) => row.makerFee ?? undefined, {
			id: 'makerFee',
			header: definitions.makerFee.label,
			cell: ({ getValue }) => percentage(getValue(), 3),
			meta: { headerClassName: 'w-[100px]', align: 'end', headerHelperText: definitions.makerFee.description }
		}),
		columnHelper.accessor((row) => row.takerFee ?? undefined, {
			id: 'takerFee',
			header: definitions.takerFee.label,
			cell: ({ getValue }) => percentage(getValue(), 3),
			meta: { headerClassName: 'w-[100px]', align: 'end', headerHelperText: definitions.takerFee.description }
		}),
		columnHelper.accessor((row) => row.listedAt ?? undefined, {
			id: 'listedAt',
			header: definitions.listedAt.label,
			cell: ({ getValue }) => (getValue() == null ? '–' : (formatDate(getValue(), { input: 'seconds' }) ?? '–')),
			meta: { headerClassName: 'w-[110px]', align: 'end', headerHelperText: definitions.listedAt.description }
		})
	)

	if (showVenue) {
		columns.unshift(
			columnHelper.accessor((row) => row.venue ?? '', {
				id: 'venue',
				header: definitions.venue.label,
				enableSorting: false,
				cell: ({ getValue, row }) => {
					const venue = getValue()
					if (!venue) return <span className="text-tertiary">–</span>
					const venueSlug = row.original.venueSlug ?? venue

					const content = (
						<>
							<TokenLogo name={venueSlug} kind="exchange" size={20} fallbackSrc={letterLogoDataUri(venueSlug)} alt="" />
							<span className="truncate label-md">{venue}</span>
						</>
					)

					return row.original.venueUrl ? (
						<BasicLink
							href={row.original.venueUrl}
							className="flex min-w-0 items-center gap-2 text-link hover:underline"
						>
							{content}
						</BasicLink>
					) : (
						<span className="flex min-w-0 items-center gap-2">{content}</span>
					)
				},
				meta: { headerClassName: 'w-[160px]', headerHelperText: definitions.venue.description }
			})
		)
	}

	return columns
}

const DEFAULT_PAIR_SORTING: SortingState = [{ id: 'volume24h', desc: true }]

export function PairTable({
	pairs,
	segment,
	capabilities,
	csvFileName,
	showVenue = false,
	omitColumns,
	columnOrder,
	initialVisibleColumns,
	sorting,
	columnToSearch = 'pair',
	placeholder = 'Search pairs...',
	header = 'Markets',
	embedded = false,
	leadingControls = null
}: {
	pairs: PairTableRow[]
	segment: ExchangeSegment
	capabilities: { openInterest: boolean; funding: boolean; depth: boolean }
	csvFileName: string
	/** Prepend a Venue column — for surfaces whose rows mix venues (token page markets). */
	showVenue?: boolean
	/** Column ids that do not apply on this surface; dropped entirely (column selector + CSV included). */
	omitColumns?: readonly string[]
	/** Preferred column order; unlisted columns follow in their definition order. */
	columnOrder?: readonly string[]
	/** Columns visible on first render; other applicable columns remain available in the selector. */
	initialVisibleColumns?: readonly string[]
	/** Initial sorting. Pass [] to preserve the caller's pre-ranked row order (e.g. bybit-first). */
	sorting?: SortingState
	columnToSearch?: string
	placeholder?: string
	header?: string | null
	embedded?: boolean
	leadingControls?: React.ReactNode
}) {
	const { openInterest, funding, depth: supportsDepth } = capabilities
	const columns = React.useMemo(() => {
		const omit = new Set(omitColumns ?? [])
		const filtered = buildColumns(segment, { openInterest, funding, depth: supportsDepth }, showVenue).filter(
			(column) => !omit.has(column.id as string)
		)
		if (!columnOrder) return filtered
		const position = new Map(columnOrder.map((id, index) => [id, index]))
		return filtered.sort(
			(a, b) => (position.get(a.id as string) ?? position.size) - (position.get(b.id as string) ?? position.size)
		)
	}, [segment, openInterest, funding, supportsDepth, showVenue, omitColumns, columnOrder])
	const columnVisibility = React.useMemo(() => {
		if (!initialVisibleColumns) return pairColumnVisibility()
		const visible = new Set(initialVisibleColumns)
		return Object.fromEntries(columns.map((column) => [column.id as string, visible.has(column.id as string)]))
	}, [columns, initialVisibleColumns])
	return (
		<TableWithSearch
			key={segment}
			data={pairs}
			columns={columns}
			columnToSearch={columnToSearch}
			placeholder={placeholder}
			header={header}
			leadingControls={leadingControls}
			columnVisibility={columnVisibility}
			showColumnSelect
			csvExportAllColumns
			csvFileName={csvFileName}
			sortingState={sorting ?? DEFAULT_PAIR_SORTING}
			embedded={embedded}
			tableLayout="fixed"
		/>
	)
}
