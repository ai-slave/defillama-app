import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { startTransition, useDeferredValue, useState } from 'react'
import { useBlockExplorers } from '~/api/client'
import { displayTableFeatures } from '~/components/Table/features/display'
import { VirtualTable } from '~/components/Table/VirtualTable'
import Layout from '~/layout'
import { Change } from '~/ui/Change'
import { CopyHelper } from '~/ui/Copy'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { InlineStatus, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { truncateAddress } from '~/utils'
import { fetchJson } from '~/utils/async'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'

const valueToFilter = {
	'1d': 'day',
	'7d': 'week',
	'30d': 'month'
}

type Period = '1d' | '7d' | '30d'
type Chain = 'Ethereum' | 'Arbitrum' | 'Polygon' | 'Optimism' | 'Base'

const PERIOD_OPTIONS: Array<SegmentedControlOption<Period>> = [
	{ value: '1d', label: '1d' },
	{ value: '7d', label: '7d' },
	{ value: '30d', label: '30d' }
]
const CHAIN_OPTIONS: Array<SegmentedControlOption<Chain>> = [
	{ value: 'Ethereum', label: 'Ethereum' },
	{ value: 'Arbitrum', label: 'Arbitrum' },
	{ value: 'Polygon', label: 'Polygon' },
	{ value: 'Optimism', label: 'Optimism' },
	{ value: 'Base', label: 'Base' }
]

interface ITrendingContracts {
	accounts_percentage_growth: number
	active_accounts: number
	contract: string
	gas_spend: number
	gas_spend_percentage_growth: number
	txns: number
	txns_percentage_growth: number
	name?: string
}

const columnHelper = createColumnHelper<typeof displayTableFeatures, ITrendingContracts>()

async function getContracts(chain: string, time: string) {
	return await fetchJson(
		`https://trending-contracts-api.onrender.com/${chain}_tc/${valueToFilter[time] || valueToFilter['1d']}`
	).then(async (r) => {
		return {
			results: await Promise.all(
				r.map(async (contract) => {
					let name = contract.name ? { name: contract.name } : undefined
					if (!name) {
						try {
							name = await fetchJson(
								`https://raw.githubusercontent.com/verynifty/RolodETH/main/data/${contract.contract.toLowerCase()}`
							)
							if (name.name === undefined) {
								throw new Error('RolodETH: No name')
							}
						} catch {
							try {
								name = await fetchJson(`https://api.llama.fi/contractName2/${chain}/${contract.contract.toLowerCase()}`)
								if (name.name === '') {
									throw new Error('Etherescan: Contract not verified')
								}
							} catch {
								name = undefined
							}
						}
					}
					return {
						...contract,
						name: name?.name
					}
				})
			)
		}
	})
}

export default function TrendingContracts() {
	const [sorting, setSorting] = useState<SortingState>([{ desc: true, id: 'gas_spend' }])

	const [value, setValue] = useState<Period>('1d')
	const [chain, setChain] = useState<Chain>('Ethereum')

	const time = useDeferredValue(value)

	const activeChain = typeof chain === 'string' ? chain.toLowerCase() : 'ethereum'

	const query = useQuery({
		queryKey: ['trending-contracts', time, activeChain],
		queryFn: () => getContracts(activeChain, time),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})
	const { data } = query

	const { data: blockExplorers = [] } = useBlockExplorers()

	const results = data?.results ?? []

	const instance = useTable({
		features: displayTableFeatures,
		data: results,
		state: {
			sorting
		},
		defaultColumn: {
			sortUndefined: 'last'
		},
		enableSortingRemoval: false,
		columns: columns(activeChain, blockExplorers),
		onSortingChange: (updater) => startTransition(() => setSorting(updater))
	})

	return (
		<Layout
			title="Trending Smart Contracts by Chain - DefiLlama"
			description="Discover trending smart contracts across blockchains. See the most active contracts in real-time on DefiLlama."
			canonicalUrl="/trending-contracts"
		>
			<Panel className="flex-1">
				<PanelHeader>
					<PanelTitle as="h1">Trending Contracts</PanelTitle>
					<SegmentedControl
						variant="default"
						size="md"
						value={value}
						onValueChange={(next) => setValue(next)}
						options={PERIOD_OPTIONS}
						label="Period"
					/>
					<SegmentedControl
						variant="default"
						size="md"
						value={chain}
						onValueChange={(val) => startTransition(() => setChain(val))}
						options={CHAIN_OPTIONS}
						label="Chain"
					/>
				</PanelHeader>
				{queryReadFailed(query) ? (
					<div className="flex min-h-[360px] flex-1 items-center justify-center p-2">
						<InlineStatus variant="error" retry={query}>
							Couldn't load trending contracts.
						</InlineStatus>
					</div>
				) : query.isLoading ? (
					<SurfaceBodyLoadingStatus label="Loading trending contracts" className="p-2" />
				) : results.length === 0 ? (
					<SurfaceBodyStatus variant="empty" className="p-2">
						No trending contracts found for this chain and time range.
					</SurfaceBodyStatus>
				) : (
					<VirtualTable table={instance} />
				)}
			</Panel>
		</Layout>
	)
}

const columns = (chain: string, blockExplorers: ReturnType<typeof useBlockExplorers>['data'] = []) =>
	columnHelper.columns([
		columnHelper.accessor('contract', {
			header: 'Contract',
			cell: (info) => {
				const value = info.getValue()
				const name = info.row.original.name
				const explorer = getBlockExplorerNew({
					apiResponse: blockExplorers,
					address: value,
					chainId: chain,
					urlType: 'address'
				})
				const label = name ?? truncateAddress(value)
				return (
					<span className="flex items-center gap-1.5">
						{explorer ? (
							<a href={explorer.url} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
								{label}
							</a>
						) : (
							<span>{label}</span>
						)}
						<CopyHelper toCopy={value} />
					</span>
				)
			},
			enableSorting: false,
			meta: {
				headerClassName: 'w-[min(280px,40vw)]'
			}
		}),
		columnHelper.accessor((row) => row.txns ?? undefined, {
			id: 'txns',
			header: 'Transactions',
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.txns_percentage_growth ?? undefined, {
			id: 'txns_percentage_growth',
			header: 'Tx Growth',
			cell: (info) => <Change value={info.getValue()} />,
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.active_accounts ?? undefined, {
			id: 'active_accounts',
			header: 'Active Accounts',
			meta: {
				headerClassName: 'w-[150px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.accounts_percentage_growth ?? undefined, {
			id: 'accounts_percentage_growth',
			header: 'Account Growth',
			cell: (info) => <Change value={info.getValue()} />,
			meta: {
				headerClassName: 'w-[150px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.gas_spend ?? undefined, {
			id: 'gas_spend',
			header: 'Gas Spent',
			cell: (info) => <>{formatNumber(info.getValue())} ETH</>,
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		}),
		columnHelper.accessor((row) => row.gas_spend_percentage_growth ?? undefined, {
			id: 'gas_spend_percentage_growth',
			header: 'Gas Growth',
			cell: (info) => <Change value={info.getValue()} />,
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		})
	])
