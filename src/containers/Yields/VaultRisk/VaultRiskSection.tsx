import { useMemo } from 'react'
import type { BlockExplorersResponse } from '~/api/types'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { CollateralView } from './components/CollateralView'
import { FreshnessFooter } from './components/FreshnessFooter'
import { PositionProvider } from './components/PositionControl'
import { RiskTabs, type RiskTab } from './components/RiskTabs'
import { RiskVerdict } from './components/RiskVerdict'
import { ScenarioByExit } from './components/ScenarioByExit'
import { isDisplayedScenario } from './components/scenarioShared'
import { TrustPanel } from './components/TrustPanel'
import { explorerUrl } from './components/trustShared'
import { buildVaultRiskVM, isDustCollateral } from './derive'
import { prettyProtocolSlug } from './format'
import { AddressActions } from './primitives/AddressActions'
import type { VaultRiskData, VaultRiskVM } from './types'

const SECTION_ID = 'vault-risk'

// Public anchors: ConditionsTree links ref=oracle_config leaves to #vault-risk-collateral.
const ID_SCENARIOS = 'vault-risk-scenarios'
const ID_COLLATERAL = 'vault-risk-collateral'
const ID_TRUST = 'vault-risk-trust'

interface VaultRiskSectionProps {
	data: VaultRiskData | null
	poolName: string
	chain: string
	explorers?: BlockExplorersResponse
	standalone?: boolean // true = under the /risk page header, which already names chain + contract
}

function Chip({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-medium bg-surface px-2 py-0.5 body-sm text-secondary">
			{children}
		</span>
	)
}

function ChainChip({ chain }: { chain: string }) {
	return (
		<Chip>
			<TokenLogo name={chain.toLowerCase()} kind="chain" size={14} />
			{chain}
		</Chip>
	)
}

// Shared shell so the populated and empty states read as the same section.
function Shell({
	poolName,
	chips,
	children
}: {
	poolName: string
	chips?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<section aria-labelledby={SECTION_ID}>
			<Panel>
				<PanelHeader className="items-start gap-x-3 gap-y-3">
					<div className="mr-auto min-w-0">
						<PanelTitle className="group relative flex min-w-0 scroll-mt-24 items-center gap-1" id={SECTION_ID}>
							Risk
							<a
								aria-hidden="true"
								tabIndex={-1}
								href={`#${SECTION_ID}`}
								className="absolute top-0 right-0 z-10 flex size-full items-center"
							/>
							<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
						</PanelTitle>
						<p className="mt-1 max-w-3xl body-md text-secondary">
							{`Depositing into ${poolName || 'this pool'} means underwriting risks you usually can't see: how much you could lose, whether you'd get out in time, and what would cover it.`}
						</p>
					</div>
					{chips ? <div className="flex flex-wrap items-center gap-1.5">{chips}</div> : null}
				</PanelHeader>
				<div className="flex flex-1 flex-col divide-y divide-(--border-subtle)">{children}</div>
			</Panel>
		</section>
	)
}

// One flat zone per chapter, separated by hairlines instead of nested boxes.
function Zone({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
	return (
		<div id={id} className={`scroll-mt-24 p-4 ${className ?? ''}`}>
			{children}
		</div>
	)
}

// Coverage is being compiled, not absent. Static under reduced motion.
function ScanningRadar() {
	return (
		<div aria-hidden className="relative size-24">
			{[0, 16, 32].map((inset) => (
				<div key={inset} className="absolute rounded-full border border-subtle" style={{ inset }} />
			))}
			<div
				className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full motion-reduce:animate-none"
				style={{
					background: 'conic-gradient(from 0deg, color-mix(in srgb, var(--bg-brand) 22%, transparent), transparent 30%)'
				}}
			/>
			<span className="absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full bg-brand" />
		</div>
	)
}

// The "coverage is compiling" state, shared by the embedded section and the standalone
// /risk page — an uncovered pool shows "scanning", never a bare "no data" line.
export function VaultRiskUnmapped({
	poolName,
	protocolId,
	chain,
	standalone = false
}: {
	poolName: string
	protocolId?: string | null
	chain?: string | null
	standalone?: boolean // true = under the /risk page header, which already names the chain
}) {
	const showChain = !standalone && chain
	return (
		<Shell
			poolName={poolName}
			chips={
				protocolId || showChain ? (
					<>
						{protocolId ? <Chip>{protocolId}</Chip> : null}
						{showChain ? <ChainChip chain={chain} /> : null}
					</>
				) : undefined
			}
		>
			{/* Not EmptyState: the scanning radar is this section's own illustration, and EmptyState only takes an icon. */}
			<div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
				<ScanningRadar />
				<p className="label-md text-primary">Risk scenarios for this pool aren&apos;t mapped yet</p>
				<p className="max-w-md body-sm text-secondary">
					Coverage is rolling out across protocols. This pool will populate as its scenarios are compiled and verified
					on-chain.
				</p>
			</div>
		</Shell>
	)
}

export function VaultRiskSection({ data, poolName, chain, explorers, standalone = false }: VaultRiskSectionProps) {
	// This is an optional panel fed by a separate service. Keep an incomplete 200 response
	// from taking down the pool page while still trusting the typed contract on the happy path.
	const vm = useMemo<VaultRiskVM | null>(() => {
		if (!data) return null
		try {
			return buildVaultRiskVM(data, explorers)
		} catch {
			return null
		}
	}, [data, explorers])

	// Memoized so RiskTabs' hashchange effect doesn't re-subscribe on unrelated re-renders;
	// above the early returns to keep hook order stable.
	const tabs = useMemo<Array<RiskTab>>(() => {
		if (!vm) return []
		return [
			{
				id: ID_COLLATERAL,
				icon: 'layers',
				label: 'Collateral',
				count: vm.collateral.filter((c) => !isDustCollateral(c)).length,
				content: (
					<CollateralView
						collateral={vm.collateral}
						{...(explorers ? { explorers } : {})}
						protocolId={vm.protocolId}
						poolType={vm.poolType}
						supplyUsd={vm.supplyUsd}
						allocatedUsd={vm.allocatedUsd}
						idleUsd={vm.idleUsd}
						{...(vm.protocol ? { trustScope: vm.protocol.aggregate_trust_scope } : {})}
						marketOracles={vm.marketOracles}
						oracleDependencies={vm.oracleDependencies}
						oracleExposure={vm.oracleExposure}
						chain={vm.chain}
					/>
				)
			},
			{
				id: ID_SCENARIOS,
				icon: 'trending-up',
				iconFlipY: true,
				label: 'Scenarios',
				count: vm.scenarios.filter(isDisplayedScenario).length,
				content: <ScenarioByExit scenarios={vm.scenarios} protocol={vm.protocol} supplyUsd={vm.supplyUsd} />
			},
			{
				id: ID_TRUST,
				icon: 'users',
				label: 'Trust',
				content: (
					<TrustPanel
						protocol={vm.protocol}
						{...(explorers ? { explorers } : {})}
						chain={vm.chain}
						poolType={vm.poolType}
						scenarios={vm.scenarios}
						vaultRoles={vm.vaultRoles}
						vaultDependencies={vm.vaultExternalDependencies}
						nowIso={vm.freshness.last_run}
						incidents={vm.realizedIncidents}
					/>
				)
			}
		]
	}, [vm, explorers])

	// No risk record at all → stay silent rather than advertise on every uncovered pool.
	if (!data) return null

	// Has a record but nothing usable → say so honestly instead of a blank gap. Chain chip
	// only when a protocol resolved.
	if (!vm || vm.scenarios.length === 0) {
		const protocolId = vm?.protocolId ?? data.vault?.protocol_id
		const chainName = vm?.chain ?? data.vault?.chain ?? chain
		return (
			<VaultRiskUnmapped
				poolName={poolName}
				protocolId={protocolId}
				chain={protocolId ? chainName : null}
				standalone={standalone}
			/>
		)
	}

	const poolTypeLabel = vm.poolType === 'vault' ? 'Vault (aggregates across markets)' : 'Market'

	// One source for the verdict's track-record fact and the trust panel's history strip;
	// from the VM's history list so a suppressed scenario never drops a real loss.
	const incidents = vm.realizedIncidents

	return (
		<PositionProvider>
			<Shell
				poolName={vm.vaultName ?? poolName}
				chips={
					<>
						<Chip>
							<TokenLogo name={vm.protocolId} kind="token" size={14} />
							{prettyProtocolSlug(vm.protocolId)}
						</Chip>
						{/* the standalone /risk page header already carries chain + contract — repeat
						    them only on the embedded pool-page view, where this row is the sole identity */}
						{standalone ? null : <ChainChip chain={vm.chain} />}
						<Chip>{poolTypeLabel}</Chip>
						{/* the same brand can run two vaults with one name+chain — the contract disambiguates */}
						{!standalone && vm.vaultAddress ? (
							<Chip>
								<AddressActions
									address={vm.vaultAddress}
									url={explorerUrl(vm.vaultAddress, vm.chain, explorers)}
									label="vault contract address"
								/>
							</Chip>
						) : null}
					</>
				}
			>
				<Zone className="overflow-hidden">
					<RiskVerdict
						headline={vm.headline}
						scenarios={vm.scenarios}
						stress={vm.stress}
						supplyUsd={vm.supplyUsd}
						exit={vm.exitReadiness}
						audits={vm.protocol?.audits ?? []}
						incidents={incidents}
					/>
				</Zone>

				<RiskTabs tabs={tabs} defaultId={ID_COLLATERAL} />

				<Zone>
					<FreshnessFooter
						freshness={vm.freshness}
						protocolFreshness={vm.protocolFreshness}
						protocolId={vm.protocolId}
						lastUpdatedTs={vm.lastUpdatedTs}
						stale={vm.stale}
					/>
				</Zone>
			</Shell>
		</PositionProvider>
	)
}
