import { useQuery } from '@tanstack/react-query'
import { useContext, useMemo, useState } from 'react'
import { IncomeStatement } from '~/containers/ProtocolOverview/IncomeStatement'
import { getProtocolIncomeStatement } from '~/containers/ProtocolOverview/queries'
import { MetaLine } from '~/ui/MetaLine'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'
import { useAppMetadata } from '../AppMetadataContext'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import { StreamDoneContext } from '../queries'
import type { IncomeStatementConfig } from '../types'
import { getItemIconUrl } from '../utils'
import { BoundParameterBadge } from './BoundParameterBadge'
import { EntityIcon } from './EntityIcon'
import { ProCardHeader } from './ProCardHeader'
import { ProCardEmpty, ProCardError, ProCardLoading, ProCardRefreshFailed } from './ProCardStatus'

type ViewMode = 'table' | 'sankey'

const INCOME_STATEMENT_VIEWS = [
	{ value: 'table' as const, label: 'Table' },
	{ value: 'sankey' as const, label: 'Sankey' }
]

interface IncomeStatementCardProps {
	config: IncomeStatementConfig
}

export function IncomeStatementCard({ config }: IncomeStatementCardProps) {
	const { getProtocolInfo } = useProDashboardCatalog()
	const { loading: metadataLoading, protocolsBySlug } = useAppMetadata()
	const [view, setView] = useState<ViewMode>('sankey')

	const protocolInfo = getProtocolInfo(config.protocol)
	const record = protocolsBySlug.get(config.protocol) ?? protocolsBySlug.get(config.protocol.toLowerCase()) ?? null
	const displayName = record?.displayName || config.protocolName || protocolInfo?.name || config.protocol

	const metadata = {
		displayName,
		fees: Boolean(record?.flags?.fees),
		revenue: Boolean(record?.flags?.revenue),
		incentives: Boolean(record?.flags?.incentives),
		emissions: Boolean(record?.flags?.emissions)
	}

	const streamDone = useContext(StreamDoneContext)
	const incomeStatementQuery = useQuery({
		queryKey: ['pro-dashboard', 'income-statement', config.protocol],
		queryFn: () => getProtocolIncomeStatement({ metadata }),
		enabled: streamDone && Boolean(config.protocol && displayName && metadata.fees && metadata.revenue),
		staleTime: 60 * 60 * 1000
	})
	const { data: incomeStatement, isLoading } = incomeStatementQuery

	const hasData = useMemo(() => {
		if (!incomeStatement?.data) return false
		return (['monthly', 'quarterly', 'yearly'] as const).some(
			(key) => Object.keys(incomeStatement.data[key] ?? {}).length > 0
		)
	}, [incomeStatement])

	const hasIncentives = Boolean(record?.flags?.incentives || record?.flags?.emissions)
	const iconUrl = getItemIconUrl('protocol', protocolInfo, config.protocol)
	const queryRequired = Boolean(config.protocol && displayName && metadata.fees && metadata.revenue)
	const showLoader = metadataLoading || isLoading || (queryRequired && !streamDone && incomeStatement === undefined)

	return (
		<div className="flex min-h-[calc(360px*var(--card-scale,1))] flex-col p-0">
			{queryRefreshFailed(incomeStatementQuery) ? <ProCardRefreshFailed retry={incomeStatementQuery} /> : null}
			<ProCardHeader
				titleAs="h3"
				title={`${displayName} Income statement`}
				icon={<EntityIcon src={iconUrl} name={displayName} />}
				badge={<BoundParameterBadge {...(config.bindings === undefined ? {} : { bindings: config.bindings })} />}
				subtitle={<MetaLine>{view === 'table' ? 'Table' : 'Sankey'}</MetaLine>}
				viewerControls={
					<SegmentedControl<ViewMode>
						variant="default"
						size="sm"
						label="Income statement view"
						options={INCOME_STATEMENT_VIEWS}
						value={view}
						onValueChange={setView}
					/>
				}
			/>
			<div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
				{queryReadFailed(incomeStatementQuery) ? (
					<ProCardError retry={incomeStatementQuery} />
				) : showLoader ? (
					<ProCardLoading />
				) : !incomeStatement || !hasData ? (
					<ProCardEmpty message="No income statement data available" />
				) : (
					<div className="min-h-0 flex-1 overflow-auto">
						<IncomeStatement
							name={displayName}
							incomeStatement={incomeStatement}
							hasIncentives={hasIncentives}
							view={view}
							anchorId={`income-statement-${config.protocol}`}
							className="border-none bg-transparent p-0"
							showTitles={false}
						/>
					</div>
				)}
			</div>
		</div>
	)
}
