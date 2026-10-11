import * as React from 'react'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Panel } from '~/ui/Panel'
import { tokenIconUrl } from '~/utils/icons'
import type { LiquidationsProtocolPageProps } from './api.types'
import { LiquidationsDistributionChart } from './LiquidationsDistributionChart'
import { LiquidationsSummaryStats } from './Summary'
import { LiquidationsPositionsTable, LiquidationsProtocolChainsTable } from './Table'
import { LiquidationsTableTabs } from './TableTabs'

const PROTOCOL_TABS = [
	{ id: 'chains', label: 'Chains' },
	{ id: 'positions', label: 'Positions' }
] as const

export function LiquidationsProtocolPage(props: LiquidationsProtocolPageProps) {
	const [activeTab, setActiveTab] = React.useState<(typeof PROTOCOL_TABS)[number]['id']>('chains')
	const handleSetActiveTab = React.useCallback((id: (typeof PROTOCOL_TABS)[number]['id']) => setActiveTab(id), [])

	return (
		<>
			<RowLinksWithDropdown heading="Protocols" links={props.protocolLinks} activeLink={props.protocolName} />
			{props.chainLinks.length > 2 ? (
				<RowLinksWithDropdown heading="Chains" links={props.chainLinks} activeLink="All Chains" />
			) : null}

			<div className="relative isolate flex flex-col gap-2">
				<LiquidationsSummaryStats
					items={[
						{ label: 'Collateral USD', value: props.totalCollateralUsd, isUsd: true },
						{ label: 'Positions', value: props.positionCount },
						{ label: 'Tokens', value: props.collateralCount }
					]}
				/>
				<LiquidationsDistributionChart
					chart={props.distributionChart}
					scope={props.protocolName}
					timestamp={props.timestamp}
					title={`${props.protocolName} Liquidation Distribution`}
					iconUrl={tokenIconUrl(props.protocolName)}
					allowedBreakdownModes={['total', 'chain']}
					defaultBreakdownMode="chain"
				/>
			</div>

			<Panel className="mt-2">
				<LiquidationsTableTabs
					tabs={PROTOCOL_TABS}
					activeTab={activeTab}
					setActiveTab={handleSetActiveTab}
					resetTableOnChange
				>
					{activeTab === 'chains' ? (
						<LiquidationsProtocolChainsTable rows={props.chainRows} />
					) : (
						<LiquidationsPositionsTable rows={props.positions} ownerBlockExplorers={props.ownerBlockExplorers} />
					)}
				</LiquidationsTableTabs>
			</Panel>
		</>
	)
}
