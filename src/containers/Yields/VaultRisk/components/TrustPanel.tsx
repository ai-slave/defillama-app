import type { BlockExplorersResponse } from '~/api/types'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { toneClasses } from '../kindMeta'
import { ChapterHead } from '../primitives/ChapterHead'
import type { ExternalDependency, PoolType, ProtocolRiskFixture, ScenarioVM, VaultRoles } from '../types'
import { DependencyMap } from './DependencyMap'
import { AuditsBlock, GovernanceBlock } from './GovernanceBlock'
import { HistoryStrip, type HistoryIncident, type ProtocolIncidentInput } from './HistoryStrip'
import { VaultRolesBlock } from './VaultRolesBlock'

export function TrustPanel({
	protocol,
	explorers,
	incidents = [],
	nowIso,
	chain,
	poolType = 'vault',
	scenarios = [],
	vaultRoles = null,
	vaultDependencies = []
}: {
	protocol: ProtocolRiskFixture | null
	explorers?: BlockExplorersResponse
	incidents?: Array<HistoryIncident>
	nowIso?: string
	chain?: string
	poolType?: PoolType
	scenarios?: Array<ScenarioVM>
	vaultRoles?: VaultRoles | null
	vaultDependencies?: Array<ExternalDependency>
}) {
	if (!protocol) return null
	const audits = protocol.audits ?? []
	const isMarket = poolType === 'market'
	// Only an immutable market (Morpho-style) provably keeps governance away from live
	// deposits; a governed market (Aave/Compound) must not be called immutable.
	const immutableMarket =
		isMarket && protocol.governance?.depositor_blast_radius?.value?.reaches_existing_deposits === false

	// Protocol-wide incident history — a separate lane from this vault's own realized
	// incidents; never summed with it.
	const protocolIncidents: Array<ProtocolIncidentInput> = (protocol.incidents ?? []).map((i) => ({
		date: i.date,
		kind: i.kind,
		classification: i.classification,
		chain: i.chain,
		technique: i.technique,
		usdLost: i.usd_lost,
		usdRecovered: i.usd_recovered,
		fullyRecovered: i.fully_recovered,
		postMortemUrl: i.post_mortem_url,
		...(i.notes ? { notes: i.notes } : {})
	}))

	// Prefer the vault-scoped, relevance-tagged list; only principal dependencies surface —
	// governance/rewards/ui ones are context, not a deposit-loss path.
	const deps = vaultDependencies.length > 0 ? vaultDependencies : (protocol.external_dependencies ?? [])
	const hasRelevance = deps.some((d) => d.relevance)
	const principalDeps = hasRelevance ? deps.filter((d) => (d.relevance ?? 'principal') === 'principal') : deps

	return (
		<div className="flex flex-col gap-6">
			<ChapterHead
				title="Trust and control"
				hint={
					immutableMarket
						? 'An immutable market: no operator can change its parameters. The live risk is the price oracle that values your collateral (above).'
						: isMarket
							? 'Who can change this market under you: its parameters are set by protocol governance (below); the oracle that prices your collateral is shown above.'
							: 'The people and processes that can change this protocol under you.'
				}
			/>

			<HistoryStrip
				audits={audits}
				incidents={incidents}
				protocolIncidents={protocolIncidents}
				{...(nowIso ? { nowIso } : {})}
			/>

			{/* markets correctly have no vault operators — say so, so empty reads as intentional */}
			{isMarket ? (
				<Card padding="sm" className="flex items-start gap-2">
					<Icon
						name={immutableMarket ? 'check-circle' : 'help-circle'}
						className={`mt-0.5 size-4 shrink-0 ${immutableMarket ? toneClasses('good').text : 'text-secondary'}`}
					/>
					{/* trailing copy is a single string expression so SSR and client normalize leading
					    whitespace identically — avoids a hydration mismatch */}
					<p className="body-sm text-secondary">
						{immutableMarket ? (
							<>
								<span className="label-sm text-primary">Immutable market</span>
								{
									' — no curator, owner, or guardian can change its parameters. Your live risk is the price oracle that values the collateral (see Collateral & oracles); protocol governance is bounded context below.'
								}
							</>
						) : (
							<>
								<span className="label-sm text-primary">No vault operators</span>
								{" — this market's parameters are set by protocol governance, shown below."}
							</>
						)}
					</p>
				</Card>
			) : null}

			{/* operators are the real principal-loss path, so they lead full-width; audits and
			    governance are the bounded, secondary tier */}
			{vaultRoles ? (
				<>
					<div className="border-t border-subtle pt-4">
						<VaultRolesBlock
							roles={vaultRoles}
							capabilities={protocol.role_capabilities}
							{...(chain ? { chain } : {})}
							{...(explorers ? { explorers } : {})}
							{...(nowIso ? { nowIso } : {})}
						/>
					</div>
					<div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-subtle pt-4 lg:grid-cols-2">
						<AuditsBlock audits={audits} />
						<GovernanceBlock
							protocol={protocol}
							{...(chain ? { chain } : {})}
							{...(explorers ? { explorers } : {})}
							vaultScoped
						/>
					</div>
				</>
			) : (
				<div className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-subtle pt-4 lg:grid-cols-2">
					<AuditsBlock audits={audits} />
					<GovernanceBlock
						protocol={protocol}
						{...(chain ? { chain } : {})}
						{...(explorers ? { explorers } : {})}
						vaultScoped={false}
					/>
				</div>
			)}

			{principalDeps.length > 0 ? (
				<DependencyMap deps={principalDeps} scenarios={scenarios} protocolId={protocol.protocol_id} />
			) : null}
		</div>
	)
}
