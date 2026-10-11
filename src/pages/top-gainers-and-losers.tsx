import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import type { InferGetStaticPropsType } from 'next'
import { startTransition, useMemo, useState } from 'react'
import { Bookmark } from '~/components/Bookmark'
import { DeprecatedProtocolMarker } from '~/components/DeprecatedProtocolMarker'
import { IconsRow } from '~/components/IconsRow'
import { chainHref, toChainIconItems } from '~/components/IconsRow/utils'
import { displayTableFeatures } from '~/components/Table/features/display'
import { splitArrayByFalsyValues } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { TVL_SETTINGS_KEYS_SET, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import Layout from '~/layout'
import { Change } from '~/ui/Change'
import { Logo } from '~/ui/Logo'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { TextLink } from '~/ui/TextLink'
import { getPercentChange, slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'

const GAINERS_SORTING_STATE: SortingState = [{ id: 'change_1d', desc: true }]
const LOSERS_SORTING_STATE: SortingState = [{ id: 'change_1d', desc: false }]

type RawProtocol = ProtocolsResponse['protocols'][number]
type ExtraTvlEntry = {
	tvl: number | null
	tvlPrevDay: number | null
	tvlPrevWeek: number | null
	tvlPrevMonth: number | null
}
type ProtocolBaseRow = RawProtocol & {
	extraTvl: Record<string, ExtraTvlEntry>
}
type ProtocolRow = ProtocolBaseRow & {
	change_1d: number | null
	change_7d: number | null
	change_1m: number | null
	mcaptvl: number | null
}

const columnHelper = createColumnHelper<typeof displayTableFeatures, ProtocolRow>()

const topGainersAndLosersColumns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue, row }) => {
			const value = getValue()

			return (
				<span
					className="relative flex items-center gap-2"
					style={{ paddingLeft: row.depth ? row.depth * 48 : row.depth === 0 ? 24 : 0 }}
				>
					<Bookmark size="sm" readableName={value} className="absolute -left-1.5 hidden lg:flex" />
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<Logo size={24} src={row.original.logo} data-lgonly alt={`Logo of ${value}`} />
					<span className="flex items-center gap-1 overflow-hidden">
						<TextLink href={`/protocol/${slug(value)}`} truncate>{`${value}`}</TextLink>
						{row.original.deprecated ? <DeprecatedProtocolMarker /> : null}
					</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(260px,40vw)]'
		}
	}),
	columnHelper.accessor('chains', {
		header: 'Chains',
		enableSorting: false,
		cell: ({ getValue }) => <IconsRow items={toChainIconItems(getValue(), (chain) => chainHref('/chain', chain))} />,
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
			align: 'end',
			headerHelperText: "Chains are ordered by protocol's highest TVL on each chain"
		}
	}),
	columnHelper.accessor((row) => row.tvl ?? undefined, {
		id: 'tvl',
		header: 'TVL',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.change_1d ?? undefined, {
		id: 'change_1d',
		header: '1d TVL Change',
		cell: ({ getValue }) => <Change value={getValue()} />,
		meta: {
			headerClassName: 'w-[140px]',
			align: 'end',
			headerHelperText: 'Change in TVL in the last 24 hours'
		}
	}),
	columnHelper.accessor((row) => row.mcaptvl ?? undefined, {
		id: 'mcaptvl',
		header: 'Mcap/TVL',
		cell: (info) => formatRatio(info.getValue()),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end',
			headerHelperText: 'Market cap / TVL ratio'
		}
	})
])

function TopGainersAndLosersTable({ data, sortingState }: { data: Array<ProtocolRow>; sortingState: SortingState }) {
	const [sorting, setSorting] = useState<SortingState>(sortingState)

	const instance = useTable({
		features: displayTableFeatures,
		data,
		columns: topGainersAndLosersColumns,
		state: {
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => startTransition(() => setSorting(updater))
	})

	return <VirtualTable table={instance} />
}

export const getStaticProps = withPerformanceLogging('top-gainers-and-losers', async () => {
	const { protocols } = await fetchProtocols()

	const rows: Array<ProtocolBaseRow> = protocols.map((protocol) => {
		const extraTvl: Record<string, ExtraTvlEntry> = {}
		for (const key in protocol.chainTvls) {
			if (TVL_SETTINGS_KEYS_SET.has(key)) {
				extraTvl[key] = protocol.chainTvls[key]
			}
		}

		return {
			...protocol,
			extraTvl
		}
	})

	return {
		props: {
			protocols: rows
		},
		revalidate: maxAgeForNext([22])
	}
})

export default function TopGainersLosers({ protocols }: InferGetStaticPropsType<typeof getStaticProps>) {
	const [tvlSettings] = useLocalStorageSettingsManager('tvl')
	const data = useMemo<Array<ProtocolRow>>(() => {
		return protocols.map((protocol) => {
			let finalTvl: number | null = protocol.tvl
			let finalTvlPrevDay: number | null = protocol.tvlPrevDay
			let finalTvlPrevWeek: number | null = protocol.tvlPrevWeek
			let finalTvlPrevMonth: number | null = protocol.tvlPrevMonth

			for (const extraTvlType in protocol.extraTvl ?? {}) {
				const key = extraTvlType.toLowerCase()
				const entry = protocol.extraTvl?.[extraTvlType]
				if (!entry || !tvlSettings[key] || key === 'doublecounted' || key === 'liquidstaking') continue

				const { tvl, tvlPrevDay, tvlPrevWeek, tvlPrevMonth } = entry
				if (tvl != null) finalTvl = (finalTvl ?? 0) + tvl
				if (tvlPrevDay != null) finalTvlPrevDay = (finalTvlPrevDay ?? 0) + tvlPrevDay
				if (tvlPrevWeek != null) finalTvlPrevWeek = (finalTvlPrevWeek ?? 0) + tvlPrevWeek
				if (tvlPrevMonth != null) finalTvlPrevMonth = (finalTvlPrevMonth ?? 0) + tvlPrevMonth
			}

			const tvl = finalTvl != null && finalTvl < 0 ? 0 : (finalTvl ?? 0)
			const tvlPrevDay = finalTvlPrevDay != null && finalTvlPrevDay < 0 ? 0 : (finalTvlPrevDay ?? 0)
			const tvlPrevWeek = finalTvlPrevWeek != null && finalTvlPrevWeek < 0 ? 0 : (finalTvlPrevWeek ?? 0)
			const tvlPrevMonth = finalTvlPrevMonth != null && finalTvlPrevMonth < 0 ? 0 : (finalTvlPrevMonth ?? 0)
			const mcaptvl = protocol.mcap != null && tvl !== 0 ? protocol.mcap / tvl : null

			return {
				...protocol,
				tvl,
				tvlPrevDay,
				tvlPrevWeek,
				tvlPrevMonth,
				change_1d: getPercentChange(tvl, tvlPrevDay),
				change_7d: getPercentChange(tvl, tvlPrevWeek),
				change_1m: getPercentChange(tvl, tvlPrevMonth),
				mcaptvl
			}
		})
	}, [protocols, tvlSettings])

	const { topGainers, topLosers } = useMemo(() => {
		const values = splitArrayByFalsyValues(data, 'change_1d')
		const sortedData = values[0].sort((a, b) => b['change_1d'] - a['change_1d'])
		const n = sortedData.length
		const topCount = Math.min(5, n)
		const bottomCount = Math.min(5, n - topCount)

		return {
			topGainers: sortedData.slice(0, topCount),
			topLosers: bottomCount > 0 ? sortedData.slice(-bottomCount).reverse() : []
		}
	}, [data])

	return (
		<Layout
			title="Top Gainers and Losers - DefiLlama"
			description="Track the top DeFi TVL gainers and losers by 24h change. Compare protocol TVL, 1d TVL change, chains, and Mcap/TVL."
			canonicalUrl="/top-gainers-and-losers"
		>
			<h1 className="heading-sm">Top gainers and losers</h1>
			<Panel>
				<PanelHeader>
					<PanelTitle>Top gainers</PanelTitle>
				</PanelHeader>
				<TopGainersAndLosersTable key="gainers-change_1d" data={topGainers} sortingState={GAINERS_SORTING_STATE} />
			</Panel>

			<Panel>
				<PanelHeader>
					<PanelTitle>Top losers</PanelTitle>
				</PanelHeader>
				<TopGainersAndLosersTable key="losers-change_1d" data={topLosers} sortingState={LOSERS_SORTING_STATE} />
			</Panel>
		</Layout>
	)
}
