import { type ColumnFiltersState, createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { useRouter } from 'next/router'
import * as React from 'react'
import { IconsRow } from '~/components/IconsRow'
import { toChainIconItems } from '~/components/IconsRow/utils'
import { filteredTableFeatures } from '~/components/Table/features/filtering'
import { useTableSearch } from '~/components/Table/utils'
import { VirtualTable } from '~/components/Table/VirtualTable'
import { getInvestorsPageData } from '~/containers/Raises/queries'
import type { IInvestorsPageData, IInvestorTimespan } from '~/containers/Raises/types'
import Layout from '~/layout'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SearchField } from '~/ui/SearchField'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { TextLink } from '~/ui/TextLink'
import { Tooltip } from '~/ui/Tooltip'
import { slug } from '~/utils'
import { maxAgeForNext } from '~/utils/maxAgeForNext'
import { formatUsd } from '~/utils/numberFormat'
import { withPerformanceLogging } from '~/utils/perf'
import { pushShallowQuery } from '~/utils/routerQuery'

interface INormalizedInvestor extends IInvestorTimespan {
	name: string
}

const columnHelper = createColumnHelper<typeof filteredTableFeatures, INormalizedInvestor>()

export const getStaticProps = withPerformanceLogging('raises/active-investors', async () => {
	const data = await getInvestorsPageData()

	return {
		props: data,
		revalidate: maxAgeForNext([22])
	}
})

const pageName = ['Investors']

const columns = columnHelper.columns([
	columnHelper.accessor('name', {
		header: 'Investor',
		enableSorting: false,
		cell: ({ getValue }) => {
			return (
				<TextLink href={`/raises/${slug(getValue())}`} truncate>
					{getValue()}
				</TextLink>
			)
		},
		meta: {
			headerClassName: 'min-w-[min(200px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.deals ?? undefined, {
		id: 'deals',
		header: 'Deals',
		meta: {
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.medianAmountUsd ?? undefined, {
		id: 'medianAmount',
		header: 'Median Amount',
		cell: (info) =>
			info.getValue() != null
				? formatUsd(info.getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
				: null,
		meta: {
			align: 'end'
		}
	}),
	columnHelper.accessor('chains', {
		header: 'Chains',
		enableSorting: false,
		cell: ({ getValue }) => <IconsRow items={toChainIconItems(getValue())} />,
		meta: {
			headerClassName: 'min-w-[100px]',
			align: 'end'
		}
	}),

	columnHelper.accessor('topCategory', {
		header: 'Top Project Category',
		enableSorting: false,
		meta: {
			headerClassName: 'min-w-[min(180px,40vw)]'
		}
	}),
	columnHelper.accessor('topRound', {
		header: 'Top Round Type',
		enableSorting: false,
		meta: {
			headerClassName: 'min-w-[140px]'
		}
	}),
	columnHelper.accessor('projects', {
		header: 'Projects',
		enableSorting: false,
		cell: ({ getValue }) => {
			return (
				<Tooltip content={getValue()}>
					<span className="line-clamp-1 min-w-0 overflow-x-hidden text-ellipsis whitespace-normal">{getValue()}</span>
				</Tooltip>
			)
		},
		meta: {
			headerClassName: 'min-w-[min(240px,40vw)]'
		}
	})
])

const allPeriods = [
	{ value: 'allTime', label: 'All Time' },
	{ value: '30d', label: '30d' },
	{ value: '180d', label: '180d' },
	{ value: '1y', label: '1y' }
]
const validPeriods = new Set(allPeriods.map((p) => p.value))

function ActiveInvestors({ investors }: IInvestorsPageData) {
	const router = useRouter()
	const { period } = router.query
	const selectedPeriod = typeof period === 'string' && validPeriods.has(period) ? period : 'allTime'

	const [sorting, setSorting] = React.useState<SortingState>([{ desc: true, id: 'deals' }])

	const normalizedData: Array<INormalizedInvestor> = React.useMemo(() => {
		return investors
			.map((d) => {
				const dataInInterval =
					selectedPeriod === 'allTime'
						? d.allTime
						: selectedPeriod === '30d'
							? d.last30d
							: selectedPeriod === '180d'
								? d.last180d
								: d.last1y
				return {
					name: d.name,
					...dataInInterval
				}
			})
			.sort((a, b) => b.deals - a.deals)
	}, [investors, selectedPeriod])

	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

	const instance = useTable({
		features: filteredTableFeatures,
		data: normalizedData,
		columns,
		state: {
			columnFilters,
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater))
	})

	const [investorName, setInvestorName] = useTableSearch({ instance, columnToSearch: 'name' })

	return (
		<Layout
			title="Crypto & DeFi Investors Directory - DefiLlama"
			description="Browse crypto and DeFi investors by deal count, total funding, and portfolio. Explore VC activity and investment trends on DefiLlama."
			canonicalUrl="/raises/investors"
			pageName={pageName}
		>
			<Panel>
				<PanelHeader>
					<PanelTitle as="h1">Deals by investors</PanelTitle>
					<SearchField
						label="Search investors"
						name="search"
						value={investorName}
						onChange={setInvestorName}
						placeholder="Search investors…"
						width="inline"
					/>
					<SegmentedControl
						value={selectedPeriod}
						onValueChange={(value) => {
							void pushShallowQuery(router, { period: value })
						}}
						options={allPeriods}
						label="Period"
						variant="default"
						size="md"
					/>
				</PanelHeader>
				<VirtualTable table={instance} />
			</Panel>
		</Layout>
	)
}

export default ActiveInvestors
