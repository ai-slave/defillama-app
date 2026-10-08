import { definitions } from '../../definitions'
import type { RWAPlatformKpi } from '../../kpi/platformKpi'
import type { RWAPlatformMeta } from '../api.types'
import { getRwaAccessSplit, getRwaProofGroups } from './panelData'
import { LinkPills, PanelCard, PanelRow, TallyRow } from './PanelParts'

/** How the assets are gated, summed over the rows the table shows: the access split, the six tallies, the attestation
    lines from the index. Always rendered: the assets carry the flags. The Compliance view is the per-asset detail. */
export function CompliancePanel({ meta, kpi }: { meta: RWAPlatformMeta; kpi: RWAPlatformKpi }) {
	const { flags, metrics } = kpi
	const split = getRwaAccessSplit({ permissionlessCount: kpi.permissionlessCount, assetCount: metrics.assetCount })
	const proofs = getRwaProofGroups(meta)

	return (
		<PanelCard title="Compliance">
			<div className="flex flex-col gap-1">
				<div className="flex items-baseline justify-between gap-2">
					<span className="body-md text-secondary">{definitions.accessModel.label}</span>
					<span className="label-sm">
						Permissionless {split.permissionless}{' '}
						<span className="text-tertiary">Permissioned {split.permissioned}</span>
					</span>
				</div>
				<span className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated-1">
					<span className="block h-full bg-brand" style={{ width: `${split.permissionlessPct ?? 0}%` }} />
				</span>
			</div>
			<div className="flex flex-col">
				<h3 className="mb-1 label-md text-secondary">Of {metrics.assetCount} assets</h3>
				<TallyRow label="Attested" yes={flags.attestations.yes} known={flags.attestations.known} tone="bg-success" />
				<TallyRow label="KYC to mint or redeem" yes={flags.kycForMintRedeem.yes} known={flags.kycForMintRedeem.known} />
				<TallyRow
					label="Allowlisted to hold"
					yes={flags.kycAllowlistedWhitelistedToTransferHold.yes}
					known={flags.kycAllowlistedWhitelistedToTransferHold.known}
				/>
				<TallyRow label="Transferable" yes={flags.transferable.yes} known={flags.transferable.known} />
				<TallyRow label="Self custody" yes={flags.selfCustody.yes} known={flags.selfCustody.known} />
				<TallyRow label="Redeemable" yes={flags.redeemable.yes} known={flags.redeemable.known} />
			</div>
			{meta.attestationFrequency || meta.dateOfLastAttestation || meta.oracleProvider ? (
				<div className="flex flex-col">
					{meta.attestationFrequency ? (
						<PanelRow label="Attestation frequency">{meta.attestationFrequency}</PanelRow>
					) : null}
					{meta.dateOfLastAttestation ? (
						<PanelRow label="Last attestation">{meta.dateOfLastAttestation}</PanelRow>
					) : null}
					{meta.oracleProvider ? <PanelRow label="Oracle">{meta.oracleProvider}</PanelRow> : null}
				</div>
			) : null}
			<LinkPills groups={proofs} />
		</PanelCard>
	)
}
