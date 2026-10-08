import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'
import { getRwaAssetsKpiHeadline, getRwaPlatformKpiRows, RWA_PLATFORM_KPI_LABEL } from './assetsKpiRows'
import { RWAKpiCard } from './KpiCard'
import { getRwaKpiCsvName } from './kpiRows'
import type { RWAPlatformKpi } from './platformKpi'

export type RWAPlatformKeyMetricsProps = {
	meta: RWAPlatformMeta
	/** The fold over the rows the table shows; the index's own AUM is not read. */
	kpi: RWAPlatformKpi
}

/** The platform page's Key Metrics card: the identity, one headline, four sections that open into their rows, the csv. */
export function RWAPlatformKeyMetrics({ meta, kpi }: RWAPlatformKeyMetricsProps) {
	return (
		<RWAKpiCard
			identity={
				<div className="flex flex-col gap-2">
					<h1 className="flex flex-wrap items-center gap-2 heading-sm">
						{meta.logo ? <TokenLogo src={meta.logo} size={24} alt={`${meta.name} logo`} /> : null}
						<span>{meta.name}</span>
						{meta.suspicious === true ? (
							<span className="flex items-center gap-1 rounded-full bg-surface-elevated-2 px-2 py-0.5 label-sm text-data-down">
								<Icon name="alert-triangle" className="size-3.5" />
								Suspicious
							</span>
						) : null}
					</h1>
					{meta.suspicious === true && meta.suspiciousReason ? (
						<p className="flex items-start gap-1.5 body-sm text-data-down">
							<Icon name="alert-triangle" className="mt-0.5 size-3.5 shrink-0" />
							{meta.suspiciousReason}
						</p>
					) : null}
				</div>
			}
			headline={getRwaAssetsKpiHeadline(kpi.metrics, RWA_PLATFORM_KPI_LABEL)}
			rows={getRwaPlatformKpiRows(kpi, meta)}
			csvName={getRwaKpiCsvName('platform', meta.slug)}
		/>
	)
}
