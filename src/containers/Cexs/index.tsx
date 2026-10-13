import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { SearchTableProvider } from '~/components/Table/search/SearchTableProvider'
import { TableCsvExport } from '~/components/Table/search/TableCsvExport'
import { TableSearchInput } from '~/components/Table/search/TableSearchInput'
import { VirtualSearchTableView } from '~/components/Table/search/VirtualSearchTableView'
import { TokenLogo } from '~/components/TokenLogo'
import { exchangeDefinitions } from '~/containers/Exchanges/definitions'
import { QualityHover, TierBadge } from '~/containers/Exchanges/directoryColumns'
import { MiniSparkline } from '~/containers/Exchanges/MiniSparkline'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Skeleton } from '~/ui/Skeleton'
import { TextLink } from '~/ui/TextLink'
import { TableToolbar } from '~/ui/Toolbar'
import { Definition, Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { formatDate } from '~/utils/dateFormat'
import { letterLogoDataUri } from '~/utils/icons'
import { formatUsd, roundNumber } from '~/utils/numberFormat'
import { fetchCexInflowsBatchProxy } from './api'
import type { RawCexInflowsResponse } from './api.types'
import { DateFilter, getCexDateRangeState } from './DateFilter'
import type { CexInflowsRequest, ICex } from './types'

type CustomRangeState = 'disabled' | 'loading' | 'failed' | 'missing' | 'measured'
type CexRow = ICex & { customRange: number | null; customRangeState: CustomRangeState }

const DEFAULT_SORTING_STATE = [{ id: 'cleanAssetsTvl', desc: true }]

const getDateTimestamp = (dateString: string | Array<string> | undefined): number | null => {
	if (!dateString || typeof dateString !== 'string') return null
	const timestamp = Number(dateString)
	return Number.isFinite(timestamp) ? timestamp : null
}

export function getCexCustomRangeState({
	enabled,
	hasMeasuredAssets,
	isLoading,
	isError,
	measurement
}: {
	enabled: boolean
	hasMeasuredAssets: boolean
	isLoading: boolean
	isError: boolean
	measurement: RawCexInflowsResponse | undefined
}): CustomRangeState {
	if (!enabled) return 'disabled'
	if (isLoading) return 'loading'
	if (isError) return hasMeasuredAssets ? 'failed' : 'disabled'
	return measurement ? 'measured' : 'missing'
}

function CustomRangeCell({ state, value }: { state: CustomRangeState; value: number | null }) {
	switch (state) {
		case 'disabled':
			return null
		case 'loading':
			return <Skeleton className="ml-auto h-4 w-16" />
		case 'failed': {
			const message = "Couldn't load inflows for this date range."
			return (
				<Tooltip content={message} className="ml-auto">
					<Icon name="alert-triangle" className="size-3.5 text-error" aria-hidden="true" />
					<span className="sr-only">{message}</span>
				</Tooltip>
			)
		}
		case 'missing':
			return (
				<Definition className="text-tertiary" content="No inflow data available for this date range">
					N/A
				</Definition>
			)
		case 'measured':
			return <Change value={value} unit="usd" />
		default: {
			const exhaustiveState: never = state
			return exhaustiveState
		}
	}
}

export function Cexs({ cexs }: { cexs: Array<ICex> }) {
	const router = useRouter()
	const { authorizedFetch, hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()

	const startDate = getDateTimestamp(router.query.startDate)
	const endDate = getDateTimestamp(router.query.endDate)
	const customRangeCexs = useMemo(() => {
		const requests: Array<CexInflowsRequest> = []
		for (const cex of cexs) {
			if (!cex.cexProtocolSlug) continue
			requests.push({ cexProtocolSlug: cex.cexProtocolSlug, tokensToExclude: cex.tokensToExclude })
		}
		return requests
	}, [cexs])

	const isSubscribed = !loaders.userLoading && isAuthenticated && hasActiveSubscription
	const customRangeEnabled =
		isSubscribed && getCexDateRangeState(startDate, endDate) === 'valid' && customRangeCexs.length > 0
	const {
		data: customRangeData,
		isLoading: customRangeLoading,
		isError: customRangeError
	} = useQuery({
		queryKey: ['cex-inflows-batch', customRangeCexs, startDate, endDate],
		queryFn: () => fetchCexInflowsBatchProxy(customRangeCexs, startDate! / 1e3, endDate! / 1e3, authorizedFetch),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		enabled: customRangeEnabled,
		retry: false
	})

	const enrichedData = useMemo<Array<CexRow>>(() => {
		const rows: Array<CexRow> = []
		for (const cex of cexs) {
			const measurement = cex.cexProtocolSlug ? customRangeData?.[cex.cexProtocolSlug] : undefined
			rows.push({
				...cex,
				customRange: measurement?.outflows ?? null,
				customRangeState: getCexCustomRangeState({
					enabled: customRangeEnabled && cex.cexProtocolSlug != null,
					hasMeasuredAssets: cex.currentTvl != null,
					isLoading: customRangeLoading,
					isError: customRangeError,
					measurement
				})
			})
		}
		return rows
	}, [cexs, customRangeData, customRangeEnabled, customRangeError, customRangeLoading])

	return (
		<SearchTableProvider<CexRow>
			options={{ data: enrichedData, columns, initialState: { sorting: DEFAULT_SORTING_STATE } }}
		>
			<Card padding="none">
				<TableToolbar>
					<TableSearchInput columnId="name" placeholder="Search exchange…" />
					<DateFilter
						startDate={startDate}
						endDate={endDate}
						isLoading={customRangeLoading}
						key={`cexs-date-filter-${startDate}-${endDate}`}
					/>
					<TableCsvExport filename="cex-transparency" />
				</TableToolbar>
				<VirtualSearchTableView />
			</Card>
		</SearchTableProvider>
	)
}

const columnHelper = createColumnHelper<SearchTableFeatures, CexRow>()

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const name = getValue()
			const cexProtocolSlug = row.original.cexProtocolSlug
			const rank = row.original.exchange?.rank
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					{/* Fixed slot, as on /exchanges: untiered rows keep the badge's width so every logo and name lines up. */}
					<span className="flex w-[22px] shrink-0 justify-center">
						{rank ? (
							// data-fullwidth lifts the tooltip surface's max-w-56 cap for the ~280px REAL card.
							<Tooltip content={<QualityHover quality={rank} kind="cex" />} className="shrink-0" data-fullwidth>
								<TierBadge tier={rank.tier} />
							</Tooltip>
						) : null}
					</span>
					<TokenLogo
						name={row.original.exchange?.exchange ?? slug(name)}
						kind="exchange"
						fallbackSrc={letterLogoDataUri(name)}
						alt={`${name} logo`}
					/>
					{cexProtocolSlug == null ? (
						name
					) : (
						<TextLink href={`/cex/${cexProtocolSlug}`} truncate>
							{name}
						</TextLink>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'min-w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.currentTvl ?? undefined, {
		id: 'currentTvl',
		header: 'Assets',
		cell: (info) => {
			if (info.row.original.cexProtocolSlug == null) {
				return (
					<QuestionHelper text="This CEX has not published a list of all hot and cold wallets" className="ml-auto" />
				)
			}
			const value = info.getValue()
			return (
				<>
					{value != null
						? formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
						: null}
				</>
			)
		},
		meta: {
			headerClassName: 'min-w-[120px]',
			align: 'end',
			headerHelperText:
				'This excludes IOU assets issued by the CEX that are already counted on another chain, such as Binance-pegged BTC in BSC, which is already counted in Bitcoin chain'
		}
	}),
	columnHelper.accessor((row) => row.cleanAssetsTvl ?? undefined, {
		id: 'cleanAssetsTvl',
		header: 'Clean Assets',
		cell: (info) => {
			const coinSymbol = info.row.original.coinSymbol
			if (info.row.original.cexProtocolSlug == null) {
				return (
					<QuestionHelper text="This CEX has not published a list of all hot and cold wallets" className="ml-auto" />
				)
			}
			const value = info.getValue()
			if (value == null) return null

			const helperText =
				coinSymbol == null
					? `Original TVL doesn't contain any coin issued by this CEX`
					: `This excludes all TVL from ${coinSymbol}, which is a token issued by this CEX`

			return (
				<span className="flex items-center justify-end gap-1">
					<QuestionHelper text={helperText} />
					<span>{formatUsd(value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'min-w-[145px]',
			align: 'end',
			headerHelperText: 'TVL of the CEX excluding all assets issued by itself, such as their own token'
		}
	}),
	columnHelper.accessor((row) => row.inflows_24h ?? undefined, {
		id: 'inflows_24h',
		header: '24h Inflows',
		cell: (info) => <Change value={info.getValue()} unit="usd" />,
		meta: {
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.inflows_1w ?? undefined, {
		id: 'inflows_1w',
		header: '7d Inflows',
		cell: (info) => <Change value={info.getValue()} unit="usd" />,
		meta: {
			headerClassName: 'min-w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.inflows_1m ?? undefined, {
		id: 'inflows_1m',
		header: '30d Inflows',
		cell: (info) => <Change value={info.getValue()} unit="usd" />,
		meta: {
			headerClassName: 'min-w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.exchange?.spot_volume_24h ?? undefined, {
		id: 'spotVolume',
		header: 'Spot Volume',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			align: 'end',
			headerHelperText: exchangeDefinitions.summary.spot.description
		}
	}),
	columnHelper.accessor((row) => row.exchange?.usd_perp_volume_24h ?? undefined, {
		id: 'perpVolume',
		header: 'USD Perp Volume',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			align: 'end',
			headerHelperText: exchangeDefinitions.summary.linearPerp.description
		}
	}),
	columnHelper.accessor((row) => row.exchange?.usd_perp_oi_usd ?? undefined, {
		id: 'oi',
		header: exchangeDefinitions.directory.perpOpenInterest.label,
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			align: 'end',
			headerHelperText: exchangeDefinitions.directory.perpOpenInterest.description
		}
	}),
	columnHelper.accessor((row) => row.leverage ?? undefined, {
		id: 'leverage',
		header: 'Avg Leverage',
		cell: (info) => {
			const value = info.getValue()
			return value != null ? `${roundNumber(Number(value), 2)}x` : null
		},
		meta: {
			align: 'end',
			headerHelperText: 'USD perp open interest / Clean Assets'
		}
	}),
	columnHelper.accessor((row) => row.exchange?.volume_7d, {
		id: 'volume7d',
		header: '7d Volume',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const values = getValue()
			return values ? (
				<MiniSparkline values={values} label={`${row.original.name} spot and USD perp volume, last 7 days`} />
			) : null
		},
		meta: {
			align: 'end',
			headerHelperText: 'Daily spot plus USD perp volume over the last 7 days.',
			csvValue: (row) => row.exchange?.volume_7d.join(' ') ?? ''
		}
	}),
	columnHelper.accessor((row) => row.exchange?.exchange, {
		id: 'exchangeStats',
		header: 'Exchange',
		enableSorting: false,
		cell: ({ getValue }) => {
			const exchange = getValue()
			return exchange ? (
				<Button as={BasicLink} href={`/exchange/${exchange}`} variant="link">
					Stats
				</Button>
			) : null
		},
		meta: {
			align: 'end',
			headerHelperText: 'Volume, liquidity, execution and fees on the exchange page.'
		}
	}),
	columnHelper.accessor((row) => row.customRange ?? undefined, {
		id: 'customRange',
		header: 'Custom Range Inflows',
		cell: ({ row }) => <CustomRangeCell state={row.original.customRangeState} value={row.original.customRange} />,
		meta: {
			align: 'end'
		}
	}),
	columnHelper.accessor('auditor', {
		header: 'Auditor',
		meta: {
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.lastAuditDate ?? undefined, {
		id: 'lastAuditDate',
		header: 'Last audit date',
		cell: ({ getValue }) => {
			const value = getValue()
			return <>{value == null ? null : formatDate(value, { input: 'seconds' })}</>
		},
		meta: {
			align: 'end'
		}
	})
])
