import * as React from 'react'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Panel } from '~/ui/Panel'
import type { LiquidationsOverviewPageProps } from './api.types'
import { LiquidationsDistributionChart } from './LiquidationsDistributionChart'
import { LiquidationsSummaryStats } from './Summary'
import { LiquidationsOverviewChainsTable, LiquidationsProtocolsTable } from './Table'
import { LiquidationsTableTabs } from './TableTabs'

const OVERVIEW_TABS = [
	{ id: 'protocols', label: 'Protocols' },
	{ id: 'chains', label: 'Chains' }
] as const

export function LiquidationsOverview(props: LiquidationsOverviewPageProps) {
	const [activeTab, setActiveTab] = React.useState<(typeof OVERVIEW_TABS)[number]['id']>('protocols')
	const handleSetActiveTab = React.useCallback((id: (typeof OVERVIEW_TABS)[number]['id']) => setActiveTab(id), [])

	return (
		<>
			<RowLinksWithDropdown links={props.protocolLinks} activeLink="Overview" />

			<div className="relative isolate flex flex-col gap-2">
				<LiquidationsSummaryStats
					items={[
						{ label: 'Collateral USD', value: props.totalCollateralUsd, isUsd: true },
						{ label: 'Positions', value: props.positionCount },
						{ label: 'Chains', value: props.chainCount },
						{ label: 'Protocols', value: props.protocolCount }
					]}
				/>
				<LiquidationsDistributionChart
					chart={props.distributionChart}
					timestamp={props.timestamp}
					title="Liquidation Distribution"
					defaultBreakdownMode="protocol"
				/>
			</div>

			<Panel padding="none" className="mt-2">
				<LiquidationsTableTabs
					tabs={OVERVIEW_TABS}
					activeTab={activeTab}
					setActiveTab={handleSetActiveTab}
					resetTableOnChange
				>
					{activeTab === 'protocols' ? (
						<LiquidationsProtocolsTable rows={props.protocolRows} />
					) : (
						<LiquidationsOverviewChainsTable rows={props.chainRows} />
					)}
				</LiquidationsTableTabs>
			</Panel>
		</>
	)
}
