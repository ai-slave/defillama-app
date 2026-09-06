import * as Ariakit from '@ariakit/react'
import type { BlockExplorersResponse } from '~/api/types'
import { TokenLogo } from '~/components/TokenLogo'
import { Button } from '~/ui/Button'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber, formatPercent } from '~/utils/numberFormat'
import { formatVerified, guardianText } from '../format'
import { toneClasses } from '../kindMeta'
import { AddressActions } from '../primitives/AddressActions'
import { ExternalLink } from '../primitives/ExternalLink'
import { MofNPips } from '../primitives/MofNPips'
import { tokenIconByAddress } from '../tokenIcon'
import type { Audit, Multisig, ProtocolRiskFixture } from '../types'
import { ExpandableLine, explorerUrl, governanceMarker, LabelValueRow, ReachLegend } from './trustShared'

// Some protocols publish quorum in raw 1e18 token units (Compound) — normalize so the row
// reads in whole tokens, matching voting_power_top10_tokens.
function wholeTokens(q: number): number {
	return q >= 1e15 ? q / 1e18 : q
}

// A real m-of-n Safe has a non-zero threshold; other `multisigs[]` entries are single control
// contracts and must not render as a "0-of-0 multisig".
function isRealMultisig(ms: Multisig): boolean {
	return (ms.threshold?.n ?? 0) > 0
}

// The pips double as the disclosure for the full signer set.
function SignersPopover({
	m,
	n,
	signers,
	chain,
	explorers
}: {
	m: number
	n: number
	signers: Array<{ address: string }>
	chain: string
	explorers?: BlockExplorersResponse
}) {
	if (signers.length === 0) return <MofNPips m={m} n={n} />
	return (
		<Ariakit.PopoverProvider>
			<Ariakit.PopoverDisclosure
				render={<Button type="button" variant="ghost" size="sm" />}
				aria-label={`Show the ${signers.length} signers of this ${m}-of-${n} multisig`}
			>
				<MofNPips m={m} n={n} />
			</Ariakit.PopoverDisclosure>
			<Ariakit.Popover
				unmountOnHide
				hideOnInteractOutside
				gutter={6}
				className={`${popoverHovercardSurfaceStyles} flex max-h-72 flex-col p-3 body-sm`}
			>
				<span className="label-sm text-primary">{`Signers (${signers.length})`}</span>
				<span className="mt-0.5 text-secondary">{`any ${m} of them can execute`}</span>
				<ul className="mt-1.5 flex flex-col divide-y divide-(--border-subtle)">
					{signers.map((s) => (
						<li key={s.address} className="flex items-center py-1.5">
							<AddressActions
								address={s.address}
								url={explorerUrl(s.address, chain, explorers)}
								label="signer address"
							/>
						</li>
					))}
				</ul>
			</Ariakit.Popover>
		</Ariakit.PopoverProvider>
	)
}

// A role's per-chain rows collapsed into one entry; `rep` carries the threshold/powers/impact.
interface GovGroup {
	role: string
	rep: Multisig
	chains: Array<string>
}

function groupMultisigsByRole(multisigs: Array<Multisig> | undefined, poolChain?: string): Array<GovGroup> {
	const byRole = new Map<string, Array<Multisig>>()
	for (const ms of multisigs ?? []) {
		const key = ms.role || ms.address
		const arr = byRole.get(key)
		if (arr) arr.push(ms)
		else byRole.set(key, [ms])
	}
	return [...byRole.entries()]
		.map(([role, entries]) => {
			// prefer the pool's chain with a real signer set, then any real Safe, then the pool chain
			const rep =
				entries.find((e) => e.chain === poolChain && isRealMultisig(e)) ??
				entries.find((e) => isRealMultisig(e)) ??
				entries.find((e) => e.chain === poolChain) ??
				entries[0]!
			return { role, rep, chains: [...new Set(entries.map((e) => e.chain))] }
		})
		.sort(
			// reaches-principal first (loudest), then real Safes, then most-deployed
			(a, b) =>
				Number(b.rep.depositor_impact?.reaches_principal ?? false) -
					Number(a.rep.depositor_impact?.reaches_principal ?? false) ||
				Number(isRealMultisig(b.rep)) - Number(isRealMultisig(a.rep)) ||
				b.chains.length - a.chains.length
		)
		.slice(0, 6)
}

function ChainsBadge({ chains }: { chains: Array<string> }) {
	if (chains.length < 2) return null
	return (
		<Tooltip
			content={`Same role replicated across ${chains.length} chains: ${chains.join(', ')}`}
			className="rounded-full border border-medium bg-surface px-1.5 py-0.5 body-xs text-secondary"
		>
			{chains.length} chains
		</Tooltip>
	)
}

function MultisigGroupRow({ group, explorers }: { group: GovGroup; explorers?: BlockExplorersResponse }) {
	const { rep, chains } = group
	const realMultisig = isRealMultisig(rep)
	const roleLabel = rep.role_label ?? rep.role ?? (realMultisig ? 'Multisig' : 'Control contract')
	const powers = rep.powers?.value
	const impact = rep.depositor_impact
	const marker = governanceMarker(impact?.reaches_principal)
	const detail = impact?.summary?.value ?? powers
	return (
		<ExpandableLine
			marker={marker}
			detail={detail}
			trailing={
				<AddressActions
					address={rep.address}
					url={explorerUrl(rep.address, rep.chain, explorers)}
					label={`${roleLabel} address`}
				/>
			}
		>
			<span className="label-md text-primary">{roleLabel}</span>
			{realMultisig ? (
				<span className="inline-flex items-center gap-1.5 body-sm text-secondary">
					<SignersPopover
						m={rep.threshold.m}
						n={rep.threshold.n}
						signers={rep.signers ?? []}
						chain={rep.chain}
						{...(explorers ? { explorers } : {})}
					/>
					<span>
						{rep.threshold.m}-of-{rep.threshold.n}
					</span>
				</span>
			) : null}
			<ChainsBadge chains={chains} />
		</ExpandableLine>
	)
}

export function AuditsBlock({ audits }: { audits: Array<Audit> }) {
	const critical = audits.reduce((a, x) => a + (x.findings?.critical ?? 0), 0)
	const high = audits.reduce((a, x) => a + (x.findings?.high ?? 0), 0)
	const resolved = audits.reduce((a, x) => a + (x.findings?.resolved ?? 0), 0)
	const recent = [...audits].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 4)
	return (
		<div className="flex flex-col">
			<h4 className="label-lg text-primary">Audits</h4>
			<div className="mt-1 flex items-baseline gap-2">
				<span className="mono-xl text-primary">{audits.length}</span>
				<Tooltip
					content={`Totals logged across all ${audits.length} audits. Audits surface issues so they get fixed — ${resolved} findings recorded resolved. Open each report for current status.`}
					className="body-sm text-secondary underline decoration-dotted"
				>
					{critical} critical, {high} high findings logged
				</Tooltip>
			</div>
			<ul className="mt-2 flex flex-col divide-y divide-(--border-subtle)">
				{recent.map((a, i) => {
					const meta = [
						a.scope,
						a.version ? `version ${a.version}` : null,
						a.commit_hash ? `commit ${a.commit_hash.slice(0, 7)}` : null
					]
						.filter(Boolean)
						.join(' · ')
					const formal = a.findings_status === 'not_applicable_formal_verification'
					return (
						<li key={i} className="flex items-center justify-between gap-2 py-1.5 body-sm">
							<span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-secondary">
								{meta ? (
									<Tooltip content={meta} className="underline decoration-dotted">
										<span className="text-primary">{a.firm}</span>
									</Tooltip>
								) : (
									<span className="text-primary">{a.firm}</span>
								)}
								<span>· {formatVerified(a.date)}</span>
								{formal ? (
									<span className="rounded-full border border-data-up/30 bg-data-up/10 px-1.5 py-px label-xs text-primary">
										formal verification
									</span>
								) : null}
							</span>
							{a.report?.value ? <ExternalLink href={a.report.value}>report</ExternalLink> : null}
						</li>
					)
				})}
			</ul>
			{audits.length > recent.length ? (
				<span className="mt-1 body-sm text-secondary">+{audits.length - recent.length} more audits</span>
			) : null}
		</div>
	)
}

export function GovernanceBlock({
	protocol,
	chain,
	explorers,
	vaultScoped
}: {
	protocol: ProtocolRiskFixture
	chain?: string
	explorers?: BlockExplorersResponse
	vaultScoped: boolean
}) {
	const g = protocol.governance
	const govGroups = groupMultisigsByRole(protocol.multisigs, chain)
	const day = (s: number) => Math.round(s / 86_400)
	const timelock =
		g && (g.execution_delay_max_sec ?? 0) > 0
			? g.execution_delay_min_sec === g.execution_delay_max_sec
				? `${day(g.execution_delay_min_sec)}-day timelock`
				: `${day(g.execution_delay_min_sec)}–${day(g.execution_delay_max_sec)}-day timelock`
			: null
	const guardian = guardianText(g?.guardian_role)
	const guardianAddress =
		g?.guardian_role && typeof g.guardian_role === 'object' && typeof g.guardian_role.value === 'object'
			? g.guardian_role.value?.address
			: undefined
	const concentration = g?.voting_power_concentration_top10_pct
	const concentrationHigh = concentration != null && concentration >= 0.5
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex flex-col gap-1">
					<h4 className="label-lg text-primary">Governance &amp; control</h4>
					<p className="body-md text-secondary">
						{vaultScoped
							? 'Protocol-wide governance: bounded context, not the path to your deposit.'
							: 'The people and processes that can change this protocol under you.'}
					</p>
				</div>
				{!vaultScoped && govGroups.length > 0 ? <ReachLegend /> : null}
			</div>

			{govGroups.length > 0 ? (
				<div className="flex flex-col divide-y divide-(--border-subtle)">
					{govGroups.map((group) => (
						<MultisigGroupRow key={group.role} group={group} {...(explorers ? { explorers } : {})} />
					))}
				</div>
			) : null}

			<div className="flex flex-col divide-y divide-(--border-subtle) border-t border-subtle pt-1">
				{g?.contract ? (
					<LabelValueRow label="Governance contract">
						<AddressActions
							address={g.contract}
							url={explorerUrl(g.contract, g.chain, explorers)}
							label="governance contract address"
						/>
					</LabelValueRow>
				) : null}
				{concentration != null ? (
					<LabelValueRow label="Top-10 voter concentration">
						<span className="inline-flex items-center gap-2">
							<span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface" aria-hidden>
								<span
									className={`block h-full rounded-full ${concentrationHigh ? toneClasses('danger').bar : toneClasses('warning').bar}`}
									style={{
										width: `${Math.min(100, concentration * 100)}%`
									}}
								/>
							</span>
							<Tooltip
								content={
									concentration >= 0.99
										? 'Top-10 holders control effectively all voting power — they decide every vote.'
										: concentrationHigh
											? 'A small set of holders can pass proposals on their own.'
											: 'Voting power is relatively distributed.'
								}
								{...(concentrationHigh ? { className: toneClasses('danger').text } : {})}
							>
								{formatPercent(concentration, {
									input: 'fraction',
									minimumFractionDigits: 1,
									maximumFractionDigits: 1,
									useGrouping: false
								})}
							</Tooltip>
						</span>
					</LabelValueRow>
				) : null}
				{g?.quorum_min != null && g.quorum_min > 0 ? (
					<LabelValueRow label="Quorum to pass">
						<span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
							<Tooltip
								content="Voting power a proposal needs before it can execute — the bar a captured or concentrated voter base would have to clear."
								className="justify-end underline decoration-dotted"
							>
								<span>
									{g.quorum_max != null && g.quorum_max !== g.quorum_min
										? `${formatCompactNumber(wholeTokens(g.quorum_min), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}–${formatCompactNumber(wholeTokens(g.quorum_max), { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
										: formatCompactNumber(wholeTokens(g.quorum_min), {
												minimumCompactValue: 1_000_000,
												compactSuffix: 'lowercase'
											})}
									{g.voting_token?.symbol ? ` ${g.voting_token.symbol}` : ''}
								</span>
							</Tooltip>
							{g.top10_clears_quorum != null && g.voting_power_top10_tokens != null ? (
								<Tooltip
									content={
										g.top10_clears_quorum
											? 'More voting power than quorum sits with the top 10 holders — they could pass a proposal with nobody else voting.'
											: "Quorum sits above the top 10 holders' combined voting power — passing a proposal needs broader support."
									}
									className={g.top10_clears_quorum ? toneClasses('danger').text : 'text-secondary'}
								>
									{`· top 10 hold ${formatCompactNumber(g.voting_power_top10_tokens, { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`}
								</Tooltip>
							) : null}
						</span>
					</LabelValueRow>
				) : null}
				{timelock ? (
					<LabelValueRow label="Governance timelock">
						<span className={toneClasses('good').text}>{timelock} to exit</span>
					</LabelValueRow>
				) : null}
				{guardian ? (
					<LabelValueRow label="Guardian">
						<span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
							<Tooltip content={guardian} className="underline decoration-dotted">
								can veto proposals
							</Tooltip>
							{guardianAddress ? (
								<AddressActions
									address={guardianAddress}
									url={explorerUrl(guardianAddress, g?.chain ?? 'ethereum', explorers)}
									label="guardian address"
								/>
							) : null}
						</span>
					</LabelValueRow>
				) : null}
				{g?.voting_token?.symbol ? (
					<LabelValueRow label="Voting token">
						<span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
							<span className="inline-flex items-center gap-1.5">
								{g.voting_token.address ? (
									<TokenLogo
										src={tokenIconByAddress(explorers, g.voting_token.chain, g.voting_token.address)}
										size={16}
										alt=""
									/>
								) : null}
								{g.voting_token.symbol}
							</span>
							{g.voting_token.address ? (
								<AddressActions
									address={g.voting_token.address}
									url={explorerUrl(g.voting_token.address, g.voting_token.chain, explorers, 'token')}
									label={`${g.voting_token.symbol} token address`}
								/>
							) : null}
						</span>
					</LabelValueRow>
				) : null}
			</div>
		</div>
	)
}
