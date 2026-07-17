import { Card } from '~/ui/Card'
import { MetadataFieldValue, MetadataSource } from './MetadataGroups'
import type { ExchangeMetadataKpiModel } from './models'

export function MetadataKpis({ kpis }: { kpis: ExchangeMetadataKpiModel[] }) {
	if (kpis.length === 0) return null
	return (
		<Card as="dl" padding="none" className="grid grid-cols-2 overflow-hidden lg:grid-cols-4">
			{kpis.map((kpi) => (
				<div key={kpi.key} className="flex min-w-0 flex-col gap-0.5 border-r border-b border-subtle p-2">
					<dt className="flex items-center gap-2 body-sm text-secondary">
						{kpi.label}
						<MetadataSource source={kpi.source} />
					</dt>
					<dd className="min-w-0 mono-md-bold">
						<MetadataFieldValue field={kpi} />
					</dd>
				</div>
			))}
		</Card>
	)
}
