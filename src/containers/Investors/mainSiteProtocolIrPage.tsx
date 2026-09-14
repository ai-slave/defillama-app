import { ProtocolOverviewLayout } from '~/containers/ProtocolOverview/Layout'
import type { IProtocolPageMetrics } from '~/containers/ProtocolOverview/types'
import type { getProtocolWarningBanners } from '~/containers/ProtocolOverview/utils'
import { slug } from '~/utils'
import { InvestorRelationsView } from './InvestorRelationsView'
import { LlamaOnlyGate } from './LlamaOnlyGate'

export interface ProtocolIrPageProps {
	name: string
	otherProtocols: Array<string>
	category: string | null
	metrics: IProtocolPageMetrics
	warningBanners: ReturnType<typeof getProtocolWarningBanners>
	dashboardId: string
	customOnly: boolean
	entityName: string
	irTab: string | null
	llamaOnly: boolean
	customServerData: Record<string, unknown>
	seoTitle: string
	seoDescription: string
}

export function ProtocolIrPage(props: ProtocolIrPageProps) {
	return (
		<ProtocolOverviewLayout
			name={props.name}
			category={props.category}
			otherProtocols={props.otherProtocols}
			metrics={props.metrics}
			tab="investorRelations"
			irTab={props.irTab ?? undefined}
			warningBanners={props.warningBanners}
			seoTitle={props.seoTitle}
			seoDescription={props.seoDescription}
		>
			<LlamaOnlyGate enabled={props.llamaOnly} redirectTo={`/protocol/${slug(props.name)}`}>
				<InvestorRelationsView
					dashboardId={props.dashboardId}
					customOnly={props.customOnly}
					entityName={props.entityName}
					customServerData={props.customServerData}
					activeTab={props.irTab ?? undefined}
				/>
			</LlamaOnlyGate>
		</ProtocolOverviewLayout>
	)
}
