import {
	type ColumnFiltersState,
	createColumnHelper,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable
} from '@tanstack/react-table'
import * as React from 'react'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { VirtualTable } from '~/components/Table/Table'
import { useTableSearch } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { slug } from '~/utils'
import type { GovernanceOverviewItem } from './types'

export default function Governance({ data }: { data: GovernanceOverviewItem[] }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'successfulProposalsInLast30Days', desc: true }])

	const instance = useReactTable({
		data: data,
		columns: governanceColumns,
		state: {
			columnFilters,
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		onSortingChange: (updater) => React.startTransition(() => setSorting(updater)),
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	const [_projectName, setProjectName] = useTableSearch({ instance, columnToSearch: 'name' })

	return (
		<Panel padding="none">
			<PanelHeader className="justify-end">
				<PanelTitle as="h1">Governance Proposals by Project</PanelTitle>
				<label className={searchFieldInlineWrapperStyles}>
					<span className="sr-only">Search projects...</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						name="search"
						onInput={(e) => setProjectName(e.currentTarget.value)}
						placeholder="Search projects..."
						className={searchFieldInputStyles}
					/>
				</label>
			</PanelHeader>
			<VirtualTable instance={instance} />
		</Panel>
	)
}

const columnHelper = createColumnHelper<GovernanceOverviewItem>()

const governanceColumns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue }) => {
			const value = getValue()
			return (
				<span className="relative flex items-center gap-2">
					<span className="vf-row-index shrink-0" aria-hidden="true" />
					<TokenLogo name={value} kind="token" data-lgonly />
					<BasicLink
						href={`/governance/${slug(value)}`}
						className="overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap text-link hover:underline"
					>
						{value}
					</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	columnHelper.accessor('proposalsCount', {
		header: 'Proposals',
		meta: {
			headerClassName: 'w-[100px]',
			align: 'end'
		}
	}),
	columnHelper.accessor('successfulProposals', {
		header: 'Successful Proposals',
		meta: {
			headerClassName: 'w-[min(180px,40vw)]',
			align: 'end'
		}
	}),
	columnHelper.accessor('proposalsInLast30Days', {
		header: 'Proposals in last 30 days',
		meta: {
			headerClassName: 'w-[min(200px,40vw)]',
			align: 'end'
		}
	}),
	columnHelper.accessor('successfulProposalsInLast30Days', {
		header: 'Successful Proposals in last 30 days',
		meta: {
			headerClassName: 'w-[min(280px,40vw)]',
			align: 'end'
		}
	})
]
