import { createColumnHelper, type ColumnVisibilityState, type SortingState } from '@tanstack/react-table'
import * as React from 'react'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableColumnSelect } from '~/components/Table/search/TableColumnSelect'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { Logo } from '~/ui/Logo'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { geckoTokenIconUrl, letterLogoDataUri } from '~/utils/icons'
import {
	formatCompactNumber,
	formatPercent,
	formatUsd,
	NUMBER_LOWERCASE_MILLIONS_OPTIONS,
	USD_LOWERCASE_MILLIONS_OPTIONS
} from '~/utils/numberFormat'
import { exchangeDefinitions } from './definitions'
import { sumNullable } from './modelHelpers'
import type { ExchangePairModel, ExchangeSegment } from './models'
import { insideShown, IntraSpread, Markout, FractionChange, NA, pctOfBps, SlippagePair } from './ProfileExecution'

const PERCENT_OPTIONS = {
	input: 'fraction',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	useGrouping: false
} as const

const PERCENT_THREE_DECIMALS_OPTIONS = {
	input: 'fraction',
	minimumFractionDigits: 3,
	maximumFractionDigits: 3,
	useGrouping: false
} as const

/** Venue fields only exist on surfaces that mix venues in one table, such as token markets. */
export type PairTableRow = ExchangePairModel & {
	venue?: string | null
	venueSlug?: string | null
	venueUrl?: string | null
}

const columnHelper = createColumnHelper<SearchTableFeatures, PairTableRow>()

export function formatPairPrice(price: number | null | undefined, quote: string) {
	return price == null ? '–' : `${formatCompactNumber(price, NUMBER_LOWERCASE_MILLIONS_OPTIONS)} ${quote.toUpperCase()}`
}

function UnsupportedMetric() {
	return <span className="text-tertiary">N/A</span>
}

export function pairDepthTotal(bid: number | null, ask: number | null) {
	return sumNullable([bid, ask])
}

// OI, funding and fees are core to reading a market, so they ship visible; the perp-only
// ones are simply not built for spot. The rest stay defined but off — reachable via the
// column selector. maxLeverage is CSV-only because it renders beside the pair name.
function pairColumnVisibility(): ColumnVisibilityState {
	return {
		markPrice: false,
		indexPrice: false,
		basis: false,
		nextFundingAt: false,
		volumeFreshness: false,
		listedAt: false
	}
}

const isOiColumn = (column: { id?: string }) => column.id === 'openInterestUsd' || column.id === 'openInterestChange24h'

export function buildPairColumns(
	segment: ExchangeSegment,
	capabilities: { openInterest: boolean; funding: boolean; depth: boolean },
	showVenue: boolean
) {
	const isPerp = segment !== 'spot'
	const definitions = exchangeDefinitions.markets
	const baseColumns = columnHelper.columns([
		columnHelper.accessor('base', {
			id: 'token',
			header: definitions.token.label,
			enableSorting: false,
			cell: ({ getValue, row }) => {
				const base = getValue()
				const ticker = base.toUpperCase()
				return (
					<span className="flex min-w-0 items-center gap-2">
						<Logo
							src={row.original.baseGeckoId ? geckoTokenIconUrl(row.original.baseGeckoId, 20) : null}
							size={20}
							fallbackSrc={letterLogoDataUri(base)}
							alt=""
						/>
						{ticker ? (
							<TextLink href={`/token/${encodeURIComponent(ticker)}`} truncate>
								{ticker}
							</TextLink>
						) : (
							<span className="text-tertiary">–</span>
						)}
					</span>
				)
			},
			meta: { headerClassName: 'min-w-[105px]', headerHelperText: definitions.token.description }
		}),
		columnHelper.accessor('symbol', {
			id: 'pair',
			enableHiding: false,
			header: definitions.pair.label,
			enableSorting: false,
			cell: ({ row, getValue }) => (
				<span className="flex min-w-0 items-center gap-1.5">
					<TextLink href={row.original.pairUrl} target="_blank" rel="noopener noreferrer" truncate>
						{getValue().toUpperCase()}
					</TextLink>
					{/* Sibling of the link, not a child: leverage must never end up inside the link text. */}
					{isPerp && row.original.maxLeverage != null ? (
						<Tooltip content={`${definitions.maxLeverage.label}: ${row.original.maxLeverage}×`}>
							<span className="shrink-0 label-sm text-tertiary">{row.original.maxLeverage}×</span>
						</Tooltip>
					) : null}
				</span>
			),
			meta: {
				headerClassName: isPerp ? 'min-w-[165px]' : 'min-w-[135px]',
				headerHelperText: definitions.pair.description
			}
		}),
		columnHelper.accessor((row) => row.price ?? undefined, {
			id: 'price',
			header: definitions.price.label,
			cell: ({ row, getValue }) => formatPairPrice(getValue(), row.original.quote),
			meta: { headerClassName: 'min-w-[150px]', align: 'end', headerHelperText: definitions.price.description }
		}),
		columnHelper.accessor((row) => row.priceChange24h ?? undefined, {
			id: 'priceChange24h',
			header: definitions.priceChange24h.label,
			cell: ({ getValue }) => <FractionChange value={getValue()} />,
			meta: {
				headerClassName: 'min-w-[95px]',
				align: 'end',
				headerHelperText: definitions.priceChange24h.description
			}
		}),
		// What trading here costs, measured on this market's own fills (trailing 30 days,
		// 72 hours of coverage at least); n/a where it is not measured.
		columnHelper.accessor((row) => row.execution?.costToTradeBps ?? undefined, {
			id: 'execCostToTrade',
			header: definitions.execCostToTrade.label,
			sortDescFirst: false,
			cell: ({ getValue }) =>
				getValue() == null
					? NA
					: (formatUsd(getValue(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? 'n/a'),
			meta: {
				align: 'end',
				headerHelperText: definitions.execCostToTrade.description
			}
		}),
		columnHelper.accessor((row) => row.execution?.realizedSlippage10kBps ?? undefined, {
			id: 'execSlippage10k',
			header: definitions.execSlippage10k.label,
			sortDescFirst: false,
			cell: ({ row }) => (
				<SlippagePair
					predicted={row.original.execution?.predictedSlippage10kBps ?? null}
					actual={row.original.execution?.realizedSlippage10kBps ?? null}
				/>
			),
			meta: {
				headerClassName: 'min-w-[140px]',
				align: 'end',
				headerHelperText: definitions.execSlippage10k.description
			}
		}),
		columnHelper.accessor((row) => insideShown(row.execution?.insideSpreadPct) ?? undefined, {
			id: 'intraSpread',
			header: definitions.intraSpread.label,
			sortDescFirst: true,
			cell: ({ row }) => (
				<IntraSpread pct={row.original.execution?.insideSpreadPct} rfq={row.original.execution?.rfq} />
			),
			meta: { align: 'end', headerHelperText: definitions.intraSpread.description }
		}),
		columnHelper.accessor((row) => row.execution?.effectiveSpreadBps ?? undefined, {
			id: 'execEffectiveSpread',
			header: definitions.execEffectiveSpread.label,
			sortDescFirst: false,
			cell: ({ getValue }) => (getValue() == null ? NA : pctOfBps(getValue() ?? null)),
			meta: {
				align: 'end',
				headerHelperText: definitions.execEffectiveSpread.description
			}
		}),
		columnHelper.accessor((row) => row.execution?.markout1mBps ?? undefined, {
			id: 'execMarkout1m',
			header: definitions.execMarkout1m.label,
			sortDescFirst: false,
			cell: ({ getValue }) => <Markout value={getValue() ?? null} />,
			meta: { align: 'end', headerHelperText: definitions.execMarkout1m.description }
		}),
		// Active liquidity leads the liquidity metrics, matching the exchanges directory.
		columnHelper.accessor((row) => row.normalizedVolume?.activeLiquidity ?? undefined, {
			id: 'activeLiquidity',
			header: definitions.activeLiquidity.label,
			cell: ({ row, getValue }) => {
				if (segment === 'inverse_perp') return <UnsupportedMetric />
				const nvol = row.original.normalizedVolume
				if (!nvol) return '–'
				// Observed depth only, so the share never exceeds the whole captured book.
				// 100% means the band reached at least as far as our snapshot did.
				const share =
					nvol.activeLiquidityShare == null
						? null
						: `${formatPercent(nvol.activeLiquidityShare, PERCENT_OPTIONS) ?? '–'} of the visible book`
				return (
					<Definition
						content={[`Band ±${formatPercent(nvol.band, PERCENT_OPTIONS) ?? '–'} of mid`, share]
							.filter(Boolean)
							.join(' · ')}
						className="ms-auto w-fit"
					>
						{formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
					</Definition>
				)
			},
			meta: {
				align: 'end',
				headerHelperText: definitions.activeLiquidity.description
			}
		}),
		columnHelper.accessor((row) => pairDepthTotal(row.depthBid2Usd, row.depthAsk2Usd) ?? undefined, {
			id: 'depth2Usd',
			header: definitions.depth2Usd.label,
			cell: ({ row, getValue }) =>
				capabilities.depth ? (
					<Definition
						content={`Bid ${formatUsd(row.original.depthBid2Usd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'} · Ask ${formatUsd(row.original.depthAsk2Usd, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}${
							row.original.depthBidMaxDistance != null || row.original.depthAskMaxDistance != null
								? ` · fetched to ${
										formatPercent(
											Math.min(
												row.original.depthBidMaxDistance ?? Number.POSITIVE_INFINITY,
												row.original.depthAskMaxDistance ?? Number.POSITIVE_INFINITY
											),
											PERCENT_OPTIONS
										) ?? '–'
									}`
								: ''
						}`}
						className="ms-auto w-fit"
					>
						{formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
					</Definition>
				) : (
					<UnsupportedMetric />
				),
			meta: { align: 'end', headerHelperText: definitions.depth2Usd.description }
		}),
		columnHelper.accessor((row) => row.volume24h ?? undefined, {
			id: 'volume24h',
			header: definitions.volume24h.label,
			cell: ({ getValue }) => formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–',
			meta: { headerClassName: 'min-w-[120px]', align: 'end', headerHelperText: definitions.volume24h.description }
		}),
		columnHelper.accessor((row) => row.volumeChange24h ?? undefined, {
			id: 'volumeChange24h',
			header: definitions.volumeChange24h.label,
			cell: ({ getValue }) => <FractionChange value={getValue()} />,
			meta: {
				headerClassName: 'min-w-[100px]',
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
					<span className="ms-auto flex w-fit items-center">
						<Definition
							content={`${formatPercent(nvol.discountFraction, PERCENT_OPTIONS) ?? '–'} below ${formatUsd(nvol.reported, USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'} reported · ${nvol.status}${
								nvol.cap === 'oi' ? ' · capped by open interest' : nvol.cap === 'depth' ? ' · capped by book depth' : ''
							}`}
						>
							{formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–'}
						</Definition>
						{/* Unsigned gap to reported, beside the definition: normalized is never above it, the tooltip says "below". */}
						{nvol.discountFraction > 0 ? (
							<span className="ms-1 label-xs text-tertiary">
								{formatPercent(nvol.discountFraction, PERCENT_OPTIONS)}
							</span>
						) : null}
					</span>
				) : (
					'–'
				)
			},
			meta: {
				headerClassName: 'min-w-[120px]',
				align: 'end',
				headerHelperText: definitions.normalizedVolume.description
			}
		}),
		columnHelper.accessor((row) => row.spreadFraction ?? undefined, {
			id: 'spreadFraction',
			header: definitions.spreadFraction.label,
			cell: ({ getValue }) => formatPercent(getValue(), PERCENT_THREE_DECIMALS_OPTIONS) ?? '–',
			meta: {
				headerClassName: 'min-w-[90px]',
				align: 'end',
				headerHelperText: definitions.spreadFraction.description
			}
		})
	])

	const perpColumns = isPerp
		? columnHelper.columns([
				columnHelper.accessor((row) => row.markPrice ?? undefined, {
					id: 'markPrice',
					header: definitions.markPrice.label,
					cell: ({ row, getValue }) => formatPairPrice(getValue(), row.original.quote),
					meta: { headerClassName: 'min-w-[115px]', align: 'end', headerHelperText: definitions.markPrice.description }
				}),
				columnHelper.accessor((row) => row.indexPrice ?? undefined, {
					id: 'indexPrice',
					header: definitions.indexPrice.label,
					cell: ({ row, getValue }) => formatPairPrice(getValue(), row.original.quote),
					meta: { headerClassName: 'min-w-[115px]', align: 'end', headerHelperText: definitions.indexPrice.description }
				}),
				columnHelper.accessor((row) => row.basis ?? undefined, {
					id: 'basis',
					header: definitions.basis.label,
					cell: ({ getValue }) => formatPercent(getValue(), PERCENT_THREE_DECIMALS_OPTIONS) ?? '–',
					meta: { headerClassName: 'min-w-[90px]', align: 'end', headerHelperText: definitions.basis.description }
				}),
				columnHelper.accessor((row) => row.openInterestUsd ?? undefined, {
					id: 'openInterestUsd',
					header: definitions.openInterestUsd.label,
					cell: ({ getValue }) =>
						capabilities.openInterest ? (
							(formatUsd(getValue(), USD_LOWERCASE_MILLIONS_OPTIONS) ?? '–')
						) : (
							<UnsupportedMetric />
						),
					meta: {
						headerClassName: 'min-w-[125px]',
						align: 'end',
						headerHelperText: definitions.openInterestUsd.description
					}
				}),
				columnHelper.accessor((row) => row.openInterestChange24h ?? undefined, {
					id: 'openInterestChange24h',
					header: definitions.openInterestChange24h.label,
					cell: ({ getValue }) => {
						if (!capabilities.openInterest) return <UnsupportedMetric />
						return <FractionChange value={getValue()} />
					},
					meta: {
						headerClassName: 'min-w-[90px]',
						align: 'end',
						headerHelperText: definitions.openInterestChange24h.description
					}
				}),
				columnHelper.accessor((row) => row.fundingRate8h ?? undefined, {
					id: 'fundingRate8h',
					header: definitions.fundingRate8h.label,
					cell: ({ row, getValue }) => {
						if (!capabilities.funding) return <UnsupportedMetric />
						const value = getValue()
						if (value == null) return <span className="text-tertiary">–</span>
						return (
							<Definition
								content={`${value > 0 ? 'Longs pay shorts. ' : value < 0 ? 'Shorts pay longs. ' : ''}Raw venue period: ${row.original.fundingPeriodHours ?? 'unknown'}h; normalized to 8h`}
								className="ms-auto w-fit"
							>
								{formatPercent(value, {
									input: 'fraction',
									minimumFractionDigits: 4,
									maximumFractionDigits: 4,
									useGrouping: false,
									signDisplay: 'exceptZero'
								})}
							</Definition>
						)
					},
					meta: {
						headerClassName: 'min-w-[105px]',
						align: 'end',
						headerHelperText: definitions.fundingRate8h.description
					}
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
					meta: {
						headerClassName: 'min-w-[220px]',
						align: 'end',
						headerHelperText: definitions.nextFundingAt.description
					}
				}),
				columnHelper.accessor((row) => row.maxLeverage ?? undefined, {
					id: 'maxLeverage',
					header: definitions.maxLeverage.label,
					cell: ({ getValue }) => (getValue() == null ? '–' : `${getValue()}×`),
					meta: {
						hidden: true,
						csvOnly: true,
						align: 'end',
						headerHelperText: definitions.maxLeverage.description
					}
				})
			])
		: []

	const trailingColumns = columnHelper.columns([
		columnHelper.accessor('volumeUpdatedAt', {
			id: 'volumeFreshness',
			header: definitions.volumeFreshness.label,
			cell: ({ getValue }) => getValue()?.slice(0, 10) ?? '–',
			meta: {
				align: 'end',
				headerHelperText: definitions.volumeFreshness.description
			}
		}),
		columnHelper.accessor((row) => row.makerFee ?? undefined, {
			id: 'makerFee',
			header: definitions.makerFee.label,
			cell: ({ getValue }) => formatPercent(getValue(), PERCENT_THREE_DECIMALS_OPTIONS) ?? '–',
			meta: { align: 'end', headerHelperText: definitions.makerFee.description }
		}),
		columnHelper.accessor((row) => row.takerFee ?? undefined, {
			id: 'takerFee',
			header: definitions.takerFee.label,
			cell: ({ getValue }) => formatPercent(getValue(), PERCENT_THREE_DECIMALS_OPTIONS) ?? '–',
			meta: { align: 'end', headerHelperText: definitions.takerFee.description }
		}),
		columnHelper.accessor((row) => row.listedAt ?? undefined, {
			id: 'listedAt',
			header: definitions.listedAt.label,
			cell: ({ getValue }) => (getValue() == null ? '–' : (formatDate(getValue(), { input: 'seconds' }) ?? '–')),
			meta: { headerClassName: 'min-w-[110px]', align: 'end', headerHelperText: definitions.listedAt.description }
		})
	])

	const venueColumns = showVenue
		? columnHelper.columns([
				columnHelper.accessor((row) => row.venue ?? '', {
					id: 'venue',
					header: definitions.venue.label,
					enableSorting: false,
					cell: ({ getValue, row }) => {
						const venue = getValue()
						if (!venue) return <span className="text-tertiary">–</span>
						const venueSlug = row.original.venueSlug ?? venue

						return (
							<span className="flex min-w-0 items-center gap-2">
								<TokenLogo
									name={venueSlug}
									kind="exchange"
									size={20}
									fallbackSrc={letterLogoDataUri(venueSlug)}
									alt=""
								/>
								{row.original.venueUrl ? (
									<TextLink href={row.original.venueUrl} truncate>
										{venue}
									</TextLink>
								) : (
									<span className="truncate label-md">{venue}</span>
								)}
							</span>
						)
					},
					meta: { headerClassName: 'min-w-[160px]', headerHelperText: definitions.venue.description }
				})
			])
		: []

	// Open interest is the first thing to read on a perp market, so it sits right before
	// volume; the other perp columns keep their place after the base set. Callers passing
	// `columnOrder` (the token page) re-sort anyway.
	const oiColumns = perpColumns.filter(isOiColumn)
	const otherPerpColumns = perpColumns.filter((column) => !isOiColumn(column))
	const volumeAt = baseColumns.findIndex((column) => column.id === 'volume24h')
	const orderedBase =
		volumeAt < 0
			? [...baseColumns, ...oiColumns]
			: [...baseColumns.slice(0, volumeAt), ...oiColumns, ...baseColumns.slice(volumeAt)]
	return [...venueColumns, ...orderedBase, ...otherPerpColumns, ...trailingColumns]
}

export function resolvePairColumns({
	segment,
	capabilities,
	showVenue,
	omitColumns,
	columnOrder
}: {
	segment: ExchangeSegment
	capabilities: { openInterest: boolean; funding: boolean; depth: boolean }
	showVenue: boolean
	omitColumns?: ReadonlyArray<string>
	columnOrder?: ReadonlyArray<string>
}) {
	const omit = new Set(omitColumns ?? [])
	const columns = buildPairColumns(segment, capabilities, showVenue).filter(
		(column) => column.id === undefined || !omit.has(column.id)
	)
	if (!columnOrder) return columns

	const position = new Map(columnOrder.map((id, index) => [id, index]))
	return columns.sort(
		(a, b) => (position.get(a.id ?? '') ?? position.size) - (position.get(b.id ?? '') ?? position.size)
	)
}

export function resolvePairColumnVisibility(
	columns: ReturnType<typeof buildPairColumns>,
	initialVisibleColumns?: ReadonlyArray<string>
): ColumnVisibilityState {
	if (!initialVisibleColumns) return pairColumnVisibility()
	const visible = new Set(initialVisibleColumns)
	const visibility: ColumnVisibilityState = {}
	for (const column of columns) {
		if (column.id !== undefined) visibility[column.id] = visible.has(column.id)
	}
	return visibility
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
	placeholder = 'Search pairs…',
	header = 'Markets',
	leadingControls = null,
	children
}: {
	pairs: Array<PairTableRow>
	segment: ExchangeSegment
	capabilities: { openInterest: boolean; funding: boolean; depth: boolean }
	csvFileName: string
	/** Prepend a Venue column — for surfaces whose rows mix venues (token page markets). */
	showVenue?: boolean
	/** Column ids that do not apply on this surface; dropped entirely (column selector + CSV included). */
	omitColumns?: ReadonlyArray<string>
	/** Preferred column order; unlisted columns follow in their definition order. */
	columnOrder?: ReadonlyArray<string>
	/** Columns visible on first render; other applicable columns remain available in the selector. */
	initialVisibleColumns?: ReadonlyArray<string>
	/** Initial sorting. Pass [] to preserve the caller's pre-ranked row order (e.g. bybit-first). */
	sorting?: SortingState
} & (
	| {
			children: NonNullable<React.ReactNode>
			columnToSearch?: never
			placeholder?: never
			header?: never
			leadingControls?: never
	  }
	| {
			children?: never
			columnToSearch?: string
			placeholder?: string
			header?: string | null
			leadingControls?: React.ReactNode
	  }
)) {
	const { openInterest, funding, depth: supportsDepth } = capabilities
	const columns = React.useMemo(() => {
		const options: Parameters<typeof resolvePairColumns>[0] = {
			segment,
			capabilities: { openInterest, funding, depth: supportsDepth },
			showVenue
		}
		if (omitColumns !== undefined) options.omitColumns = omitColumns
		if (columnOrder !== undefined) options.columnOrder = columnOrder
		return resolvePairColumns(options)
	}, [segment, openInterest, funding, supportsDepth, showVenue, omitColumns, columnOrder])
	const columnVisibility = React.useMemo(
		() => resolvePairColumnVisibility(columns, initialVisibleColumns),
		[columns, initialVisibleColumns]
	)
	return (
		<SearchTableProvider
			key={segment}
			options={{ data: pairs, columns, initialState: { columnVisibility, sorting: sorting ?? DEFAULT_PAIR_SORTING } }}
		>
			{children ?? (
				<Card padding="none">
					<TableToolbar>
						{leadingControls || header ? (
							<div className="mr-auto flex items-center gap-2 overflow-x-auto">
								{leadingControls}
								{header ? <h2 className="label-md whitespace-nowrap">{header}</h2> : null}
							</div>
						) : null}
						<TableSearchInput
							columnId={columnToSearch}
							placeholder={placeholder}
							width={leadingControls || header ? 'inline' : 'standalone'}
						/>
						<TableColumnSelect />
						<TableCsvExport filename={csvFileName} includeHiddenColumns />
					</TableToolbar>
					<VirtualSearchTableView />
				</Card>
			)}
		</SearchTableProvider>
	)
}
