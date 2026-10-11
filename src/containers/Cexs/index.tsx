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
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { Icon } from '~/ui/Icon'
import { QuestionHelper } from '~/ui/QuestionHelper'
import { Skeleton } from '~/ui/Skeleton'
import { TableToolbar } from '~/ui/Toolbar'
import { Tooltip } from '~/ui/Tooltip'
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
				<Tooltip content={message} className="ml-auto text-error">
					<Icon name="alert-triangle" className="size-3.5" aria-hidden="true" />
					<span className="sr-only">{message}</span>
				</Tooltip>
			)
		}
		case 'missing':
			return (
				<Tooltip className="text-tertiary" content="No inflow data available for this date range">
					N/A
				</Tooltip>
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
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo
						name={row.original.exchangeProfileSlug ?? slug(name)}
						kind="exchange"
						fallbackSrc={letterLogoDataUri(name)}
						alt={`${name} logo`}
					/>
					{cexProtocolSlug == null ? (
						name
					) : (
						<BasicLink href={`/cex/${cexProtocolSlug}`} className="truncate label-md text-link hover:underline">
							{name}
						</BasicLink>
					)}
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
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
			headerClassName: 'w-[120px]',
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
			headerClassName: 'w-[145px]',
			align: 'end',
			headerHelperText: 'TVL of the CEX excluding all assets issued by itself, such as their own token'
		}
	}),
	columnHelper.accessor((row) => row.inflows_24h ?? undefined, {
		id: 'inflows_24h',
		header: '24h Inflows',
		cell: (info) => <Change value={info.getValue()} unit="usd" />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.inflows_1w ?? undefined, {
		id: 'inflows_1w',
		header: '7d Inflows',
		cell: (info) => <Change value={info.getValue()} unit="usd" />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.inflows_1m ?? undefined, {
		id: 'inflows_1m',
		header: '30d Inflows',
		cell: (info) => <Change value={info.getValue()} unit="usd" />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.spotVolume ?? undefined, {
		id: 'spotVolume',
		header: 'Spot Volume',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[125px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.oi ?? undefined, {
		id: 'oi',
		header: '24h Open Interest',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[160px]',
			align: 'end'
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
			headerClassName: 'w-[130px]',
			align: 'end',
			headerHelperText: 'Open Interest / Clean Assets'
		}
	}),
	columnHelper.accessor((row) => row.customRange ?? undefined, {
		id: 'customRange',
		header: 'Custom range Inflows',
		cell: ({ row }) => <CustomRangeCell state={row.original.customRangeState} value={row.original.customRange} />,
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
			align: 'end'
		}
	}),
	columnHelper.accessor('auditor', {
		header: 'Auditor',
		meta: {
			headerClassName: 'w-[100px]',
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
			headerClassName: 'w-[130px]',
			align: 'end'
		}
	})
])
