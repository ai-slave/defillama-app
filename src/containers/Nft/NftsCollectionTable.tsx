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
import { BasicLink } from '~/components/Link'
import { VirtualTable } from '~/components/Table/Table'
import { useTableSearch } from '~/components/Table/utils'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInlineWrapperStyles, searchFieldInputStyles } from '~/ui/Input'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { PercentChange } from '~/ui/PercentChange'
import { slug } from '~/utils'

interface INftCollection {
	name: string
	collectionId: string
	floorPrice: number
	floorPrice1Day: number
	floorPrice7Day: number
	floorPricePctChange1Day: number
	floorPricePctChange7Day: number
	image: string
	onSaleCount: number
	totalSupply: number
	volume1d: number
	volume7d: number
	sales1d: number
}

const EthIcon = () => (
	<svg fill="#777E91" height={12} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 9">
		<path d="M5.56641 4.55935L2.76099 0L0 4.56239L2.78244 6.22185L5.56641 4.55935Z" />
		<path d="M5.56641 5.11627L2.77631 6.74082L0 5.11627L2.78244 8.99999L5.56641 5.11627Z" />
	</svg>
)

const EthValueCell = ({ value }: { value: unknown }) =>
	value != null ? (
		<span className="flex flex-nowrap items-center justify-end gap-1">
			<span>{String(value)}</span>
			<EthIcon />
		</span>
	) : null

const columnHelper = createColumnHelper<INftCollection>()

const columns = [
	columnHelper.accessor('name', {
		header: 'Name',
		enableSorting: false,
		cell: ({ row }) => {
			const item = row.original

			return (
				<span className="flex min-w-0 items-center gap-2">
					<TokenLogo src={item.image} alt={`Logo of ${item.name}`} />
					<BasicLink
						href={`/nfts/collection/${slug(item.collectionId)}`}
						className="min-w-0 truncate text-sm font-medium text-link hover:underline"
					>{`${item.name}`}</BasicLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(200px,40vw)]'
		}
	}),
	columnHelper.accessor((row) => row.floorPrice ?? undefined, {
		id: 'floorPrice',
		header: 'Floor Price',
		cell: (info) => <EthValueCell value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.floorPricePctChange1Day ?? undefined, {
		id: 'floorPricePctChange1Day',
		header: '1d Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.floorPricePctChange7Day ?? undefined, {
		id: 'floorPricePctChange7Day',
		header: '7d Change',
		cell: (info) => <PercentChange percent={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.volume1d ?? undefined, {
		id: 'volume1d',
		header: 'Volume 1d',
		cell: (info) => <EthValueCell value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.volume7d ?? undefined, {
		id: 'volume7d',
		header: 'Volume 7d',
		cell: (info) => <EthValueCell value={info.getValue()} />,
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.sales1d ?? undefined, {
		id: 'sales1d',
		header: 'Sales 1d',
		cell: (info) => (info.getValue() != null ? info.getValue() : null),
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.totalSupply ?? undefined, {
		id: 'totalSupply',
		header: 'Total Supply',
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	}),
	columnHelper.accessor((row) => row.onSaleCount ?? undefined, {
		id: 'onSaleCount',
		header: 'On Sale',
		meta: {
			headerClassName: 'w-[120px]',
			align: 'end'
		}
	})
]

export function NftsCollectionTable({ data }: { data: Array<INftCollection> }) {
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [sorting, setSorting] = React.useState<SortingState>([{ id: 'volume1d', desc: true }])

	const instance = useReactTable({
		data,
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
		onColumnFiltersChange: (updater) => React.startTransition(() => setColumnFilters(updater)),
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	})

	const [_collectionName, setCollectionName] = useTableSearch({ instance, columnToSearch: 'name' })

	return (
		<Panel padding="none">
			<PanelHeader className="justify-end gap-2">
				<PanelTitle as="h1">NFT Collection Metrics</PanelTitle>
				<label className={searchFieldInlineWrapperStyles}>
					<span className="sr-only">Search collections...</span>
					<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
					<input
						name="search"
						onInput={(e) => setCollectionName(e.currentTarget.value)}
						placeholder="Search collections..."
						className={searchFieldInputStyles}
					/>
				</label>
			</PanelHeader>
			<VirtualTable instance={instance} />
		</Panel>
	)
}
