import type { RWAPlatformMeta } from '../api.types'
import { PanelCard, Prose } from './PanelParts'

/** Under whose rules the platform operates: the regulatory status prose, its own panel so the grid fills six. */
export function RegulationPanel({ meta }: { meta: RWAPlatformMeta }) {
	const status = meta.regulatoryStatus
	if (status == null) return null
	return (
		<PanelCard title="Regulation">
			<Prose>{status}</Prose>
		</PanelCard>
	)
}
