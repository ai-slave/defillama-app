import * as React from 'react'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { Panel } from '~/ui/Panel'
import { tokenIconUrl } from '~/utils/icons'
import type { LiquidationsChainPageProps } from './api.types'
import { LiquidationsDistributionChart } from './LiquidationsDistributionChart'
import { LiquidationsPageHeader, LiquidationsSummaryStats } from './Summary'
import { LiquidationsPositionsTable, LiquidationsProtocolChainsTable } from './Table'
import { LiquidationsTableTabs } from './TableTabs'

const CHAIN_TABS = [
	{ id: 'positions', label: 'Positions' },
	{ id: 'chains', label: 'Chains' }
] as const

export function LiquidationsChainPage(props: LiquidationsChainPageProps) {
	const [activeTab, setActiveTab] = React.useState<(typeof CHAIN_TABS)[number]['id']>('positions')
	const handleSetActiveTab = React.useCallback((id: (typeof CHAIN_TABS)[number]['id']) => setActiveTab(id), [])

	return (
		<>
			<RowLinksWithDropdown heading="Protocols" links={props.protocolLinks} activeLink={props.protocolName} />
			{props.chainLinks.length > 2 ? (
				<RowLinksWithDropdown heading="Chains" links={props.chainLinks} activeLink={props.chainName} />
			) : null}

			<div className="relative isolate flex flex-col gap-2">
				<LiquidationsPageHeader
					title={`${props.protocolName} on ${props.chainName}`}
					rightText={new Date(props.timestamp * 1000).toUTCString()}
					logo={{ name: props.protocolName, kind: 'token' }}
				/>
				<LiquidationsSummaryStats
					items={[
						{ label: 'Positions', value: props.positionCount },
						{ label: 'Tokens', value: props.collateralCount },
						{ label: 'Collateral USD', value: props.totalCollateralUsd, isUsd: true }
					]}
				/>
				<LiquidationsDistributionChart
					chart={props.distributionChart}
					scope={`${props.protocolName}:${props.chainName}`}
					timestamp={props.timestamp}
					title={`${props.protocolName} on ${props.chainName}`}
					iconUrl={tokenIconUrl(props.protocolName)}
					allowedBreakdownModes={['total']}
				/>
			</div>

			<Panel padding="none" className="mt-2">
				<LiquidationsTableTabs
					tabs={CHAIN_TABS}
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
