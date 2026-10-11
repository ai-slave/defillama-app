import { useQuery } from '@tanstack/react-query'
import { createColumnHelper } from '@tanstack/react-table'
import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import type { SearchTableFeatures } from '~/components/Table/features/search'
import { TokenLogo } from '~/components/TokenLogo'
import { LiquidationsTableTabs } from '~/containers/LiquidationsV2/TableTabs'
import { Panel } from '~/ui/Panel'
import { PanelLoadingStatus, SurfaceBodyLoadingStatus } from '~/ui/Status'
import { TextLink } from '~/ui/TextLink'
import { formatUsd } from '~/utils/numberFormat'
import { fetchTokenLiquidationsClient } from '../LiquidationsV2/api'
import type { OverviewChainRow, OverviewProtocolRow } from '../LiquidationsV2/api.types'
import { DeferredTokenLiquidationsTable } from './deferred/DeferredTokenLiquidationsTable'
import { TokenPrivateSectionGate } from './TokenPrivateSectionGate'

const TOKEN_LIQUIDATIONS_SECTION_ID = 'token-liquidations'
const TABS = [
	{ id: 'protocols', label: 'Protocols' },
	{ id: 'chains', label: 'Chains' }
] as const

const DeferredLiquidationsSummaryStats = dynamic(
	() => import('~/containers/LiquidationsV2/Summary').then((mod) => mod.LiquidationsSummaryStats),
	{
		loading: () => <PanelLoadingStatus label="Loading liquidation summary" className="min-h-24" />
	}
)

const DeferredLiquidationsDistributionChart = dynamic(
	() =>
		import('~/containers/LiquidationsV2/LiquidationsDistributionChart').then(
			(mod) => mod.LiquidationsDistributionChart
		),
	{
		loading: () => <PanelLoadingStatus label="Loading liquidation distribution" className="min-h-[400px]" />
	}
)

const protocolColumnHelper = createColumnHelper<SearchTableFeatures, OverviewProtocolRow>()
const chainColumnHelper = createColumnHelper<SearchTableFeatures, OverviewChainRow>()

const protocolColumns = protocolColumnHelper.columns([
	protocolColumnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ row, getValue }) => {
			const protocol = getValue()

			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={protocol} kind="token" data-lgonly alt={`Logo of ${protocol}`} />
					<TextLink href={`/liquidations/${row.original.slug}`}>{protocol}</TextLink>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(220px,40vw)]'
		}
	}),
	protocolColumnHelper.accessor((row) => row.positionCount ?? undefined, {
		id: 'positionCount',
		header: 'Positions',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	protocolColumnHelper.accessor((row) => row.chainCount ?? undefined, {
		id: 'chainCount',
		header: 'Chains',
		meta: {
			headerClassName: 'w-[90px]',
			align: 'end'
		}
	}),
	protocolColumnHelper.accessor((row) => row.totalCollateralUsd ?? undefined, {
		id: 'totalCollateralUsd',
		header: 'Collateral USD',
		cell: ({ getValue }) =>
			formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
])

const chainColumns = chainColumnHelper.columns([
	chainColumnHelper.accessor('name', {
		id: 'name',
		header: 'Name',
		enableSorting: false,
		cell: ({ getValue }) => {
			const chain = getValue()

			return (
				<span className="flex items-center gap-2">
					<TokenLogo name={chain} kind="chain" data-lgonly alt={`Logo of ${chain}`} />
					<span>{chain}</span>
				</span>
			)
		},
		meta: {
			headerClassName: 'w-[min(180px,40vw)]'
		}
	}),
	chainColumnHelper.accessor((row) => row.positionCount ?? undefined, {
		id: 'positionCount',
		header: 'Positions',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	chainColumnHelper.accessor((row) => row.protocolCount ?? undefined, {
		id: 'protocolCount',
		header: 'Protocols',
		meta: {
			headerClassName: 'w-[110px]',
			align: 'end'
		}
	}),
	chainColumnHelper.accessor((row) => row.totalCollateralUsd ?? undefined, {
		id: 'totalCollateralUsd',
		header: 'Collateral USD',
		cell: ({ getValue }) =>
			formatUsd(getValue(), { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' }),
		meta: {
			headerClassName: 'w-[145px]',
			align: 'end'
		}
	})
])

export function TokenLiquidationsSection({ tokenSymbol }: { tokenSymbol: string }) {
	const { authorizedFetch, hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()
	const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('protocols')
	const handleSetActiveTab = (tab: (typeof TABS)[number]['id']) => setActiveTab(tab)
	const { data, error, isLoading, refetch, isFetching } = useQuery({
		queryKey: ['token-liquidations', tokenSymbol],
		queryFn: () => fetchTokenLiquidationsClient(tokenSymbol, authorizedFetch),
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: false,
		enabled: Boolean(tokenSymbol) && isAuthenticated && hasActiveSubscription && !loaders.userLoading
	})

	const canReadPrivateSection = isAuthenticated && hasActiveSubscription && !loaders.userLoading
	if (
		canReadPrivateSection &&
		!isLoading &&
		error == null &&
		(!data || (data.protocolRows.length === 0 && data.chainRows.length === 0))
	) {
		return null
	}

	return (
		<TokenPrivateSectionGate
			title="Liquidations"
			sectionId={TOKEN_LIQUIDATIONS_SECTION_ID}
			lockedTitle="Token liquidations need a subscription"
			isLoading={isLoading}
			error={error}
			retry={{ refetch, isFetching }}
			errorMessage="Couldn't load token liquidations."
			bodyClassName="flex flex-col gap-2 p-2"
		>
			{data ? (
				<>
					<DeferredLiquidationsSummaryStats
						items={[
							{ label: 'Collateral USD', value: data.totalCollateralUsd, isUsd: true },
							{ label: 'Positions', value: data.positionCount },
							{ label: 'Chains', value: data.chainCount },
							{ label: 'Protocols', value: data.protocolCount }
						]}
					/>

					<DeferredLiquidationsDistributionChart
						chart={data.distributionChart}
						scope={`token:${data.tokenSymbol}`}
						timestamp={data.timestamp}
						title={`${data.tokenSymbol} Liquidation Distribution`}
						defaultBreakdownMode="protocol"
						hideTokenSelector
						tokenStateMode="local"
					/>

					<Panel>
						<Suspense fallback={<SurfaceBodyLoadingStatus label="Loading liquidations table" />}>
							<LiquidationsTableTabs
								tabs={TABS}
								activeTab={activeTab}
								setActiveTab={handleSetActiveTab}
								resetTableOnChange={false}
							>
								{activeTab === 'protocols' ? (
									<DeferredTokenLiquidationsTable
										options={{
											data: data.protocolRows,
											columns: protocolColumns,
											initialState: { sorting: [{ id: 'totalCollateralUsd', desc: true }] }
										}}
										placeholder="Search protocols…"
										csvFileName={`token-liquidations-100k-protocols-${tokenSymbol}`}
									/>
								) : (
									<DeferredTokenLiquidationsTable
										options={{
											data: data.chainRows,
											columns: chainColumns,
											initialState: { sorting: [{ id: 'totalCollateralUsd', desc: true }] }
										}}
										placeholder="Search chains…"
										csvFileName={`token-liquidations-100k-chains-${tokenSymbol}`}
									/>
								)}
							</LiquidationsTableTabs>
						</Suspense>
					</Panel>
				</>
			) : null}
		</TokenPrivateSectionGate>
	)
}
