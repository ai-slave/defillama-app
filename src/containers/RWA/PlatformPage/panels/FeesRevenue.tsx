import { Icon } from '~/ui/Icon'
import type { RWAPlatformMeta } from '../api.types'
import {
	getRwaConfidenceTone,
	getRwaDocumentGroups,
	getRwaFeeRows,
	getRwaRevenueDetails,
	hasRwaFeesContent
} from './panelData'
import { LinkPills, PanelCard, PanelRow, PanelRows, Pill, Prose } from './PanelParts'

/** How the platform earns: the model and its confidence, the fee rows the index has, the notes, the estimate's inputs
    under a toggle, the documents. Rendered when one of them is set. */
export function FeesRevenuePanel({ meta }: { meta: RWAPlatformMeta }) {
	if (!hasRwaFeesContent(meta)) return null
	const rows = getRwaFeeRows(meta)
	const details = getRwaRevenueDetails(meta)
	const documents = getRwaDocumentGroups(meta)

	return (
		<PanelCard title="Fees & revenue">
			<div className="flex flex-col">
				{meta.revenueModel ? <PanelRow label="Revenue model">{meta.revenueModel}</PanelRow> : null}
				{meta.revenueConfidence ? (
					<PanelRow label="Confidence">
						<Pill tone={getRwaConfidenceTone(meta.revenueConfidence)}>{meta.revenueConfidence}</Pill>
					</PanelRow>
				) : null}
				<PanelRows rows={rows} />
			</div>
			{meta.revenueNotes ? <Prose>{meta.revenueNotes}</Prose> : null}
			{details.length > 0 ? (
				<details className="group/disclosure flex flex-col">
					<summary className="flex cursor-pointer items-center gap-1 label-sm text-link">
						How the estimate is built
						<Icon name="chevron-down" className="size-4 text-tertiary group-open/disclosure:rotate-180" />
					</summary>
					<div className="flex flex-col gap-2 pt-2">
						{details.map((detail) => (
							<p key={detail.label} className="max-w-[70ch] body-md">
								<span className="font-medium text-secondary">{detail.label}:</span> {detail.text}
							</p>
						))}
					</div>
				</details>
			) : null}
			<LinkPills groups={documents} />
		</PanelCard>
	)
}
