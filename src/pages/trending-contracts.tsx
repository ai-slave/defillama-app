import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table'
import { startTransition, useDeferredValue, useState } from 'react'
import { useBlockExplorers } from '~/api/client'
import { displayTableFeatures } from '~/components/Table/features/display'
import { VirtualTable } from '~/components/Table/VirtualTable'
import Layout from '~/layout'
import { CopyHelper } from '~/ui/Copy'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { PercentChange } from '~/ui/PercentChange'
import { TagGroup } from '~/ui/SegmentedControl'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { truncateAddress } from '~/utils'
import { fetchJson } from '~/utils/async'
import { getBlockExplorerNew } from '~/utils/blockExplorers'
import { formatNumber } from '~/utils/numberFormat'

const tableFeaturesConfig = displayTableFeatures

const valueToFilter = {
	'1d': 'day',
	'7d': 'week',
	'30d': 'month'
}

const TIME_VALUES = ['1d', '7d', '30d'] as const
const CHAIN_VALUES = ['Ethereum', 'Arbitrum', 'Polygon', 'Optimism', 'Base'] as const

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

const columnHelper = createColumnHelper<typeof tableFeaturesConfig, ITrendingContracts>()

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

	const [value, setValue] = useState<(typeof TIME_VALUES)[number]>('1d')
	const [chain, setChain] = useState<(typeof CHAIN_VALUES)[number]>('Ethereum')

	const time = useDeferredValue(value)

	const activeChain = typeof chain === 'string' ? chain.toLowerCase() : 'ethereum'

	const { data, isLoading, error } = useQuery({
		queryKey: ['trending-contracts', time, activeChain],
		queryFn: () => getContracts(activeChain, time),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	const { data: blockExplorers = [] } = useBlockExplorers()

	const results = data?.results ?? []

	const instance = useTable({
		features: tableFeaturesConfig,
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
			<Panel padding="none" className="flex-1">
				<PanelHeader>
					<PanelTitle as="h1">Trending Contracts</PanelTitle>
					<TagGroup variant="default" size="md" selectedValue={value} setValue={setValue} values={TIME_VALUES} />
					<TagGroup
						variant="default"
						size="md"
						selectedValue={chain}
						setValue={(val) => startTransition(() => setChain(val))}
						values={CHAIN_VALUES}
					/>
				</PanelHeader>
				{isLoading ? (
					<SurfaceBodyLoadingStatus className="p-2" />
				) : error ? (
					<SurfaceBodyStatus variant="error" className="p-2">
						Sorry, couldn't fetch trending contracts.
					</SurfaceBodyStatus>
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
			cell: (info) => <PercentChange percent={info.getValue()} />,
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
			cell: (info) => <PercentChange percent={info.getValue()} />,
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
			cell: (info) => <PercentChange percent={info.getValue()} />,
			meta: {
				headerClassName: 'w-[120px]',
				align: 'end'
			}
		})
	])
