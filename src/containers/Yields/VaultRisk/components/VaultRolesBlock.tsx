import type { BlockExplorersResponse } from '~/api/types'
import { Icon } from '~/components/Icon'
import { asRoleEntity, humanizeDuration, roleEntityLabel } from '../format'
import { toneClasses } from '../kindMeta'
import { AddressActions } from '../primitives/AddressActions'
import { MofNPips } from '../primitives/MofNPips'
import type { RoleCapability, RoleEntity, VaultRoles } from '../types'
import { ExpandableLine, explorerUrl, MICRO_LABEL, operatorMarker, ReachLegend, ReachDot } from './trustShared'

const ENTITY_ICON: Record<string, React.ComponentProps<typeof Icon>['name']> = {
	safe: 'key',
	eoa: 'key',
	contract: 'file-text',
	unknown: 'help-circle'
}

// What a role IS, classified on-chain. `unknown` is neutral (the read failed this tick), never a flag.
function EntityBadge({ entity }: { entity: RoleEntity }) {
	if (entity.kind === 'safe' && entity.threshold && entity.threshold.n > 0) {
		return (
			<span className="inline-flex items-center gap-1.5 text-xs text-(--legacy-text-secondary)">
				<MofNPips m={entity.threshold.m} n={entity.threshold.n} />
				<span>{roleEntityLabel(entity)}</span>
			</span>
		)
	}
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-(--legacy-cards-border) bg-(--legacy-bg-main) px-1.5 py-0.5 text-[11px] text-(--legacy-text-secondary)">
			<Icon name={ENTITY_ICON[entity.kind] ?? 'help-circle'} className="size-3" aria-hidden />
			{roleEntityLabel(entity)}
		</span>
	)
}

// Queued timelocked role actions, grouped by what the change does and whether the timelock
// has elapsed, so a burst of cap raises collapses to one counted line.
function groupPending(roles: VaultRoles, nowSec: number) {
	const map = new Map<string, { label: string; count: number; live: boolean; soonestValidAt: number }>()
	for (const p of roles.pending_changes ?? []) {
		const label = p.label ?? p.function_name
		const live = p.valid_at > nowSec
		const key = `${label}:${live ? 'live' : 'now'}`
		const ex = map.get(key)
		if (ex) {
			ex.count++
			ex.soonestValidAt = Math.min(ex.soonestValidAt, p.valid_at)
		} else {
			map.set(key, { label, count: 1, live, soonestValidAt: p.valid_at })
		}
	}
	// executable-now (no exit window) is the more urgent signal → first, then by soonest window
	return [...map.values()].sort((a, b) => Number(a.live) - Number(b.live) || a.soonestValidAt - b.soonestValidAt)
}

function capabilityByRole(caps: RoleCapability[] | undefined): Map<string, RoleCapability> {
	const map = new Map<string, RoleCapability>()
	for (const c of caps ?? []) map.set(c.role, c)
	return map
}

// Static fallbacks when a protocol ships no role_capabilities (older feeds).
const ROLE_FALLBACK: Record<string, string> = {
	owner: 'Appoints and replaces every other role and sets the timelock — the root of trust for this vault.',
	curator:
		'Sets supply caps and picks which markets the vault lends into — the role that shapes what you are exposed to.',
	guardian: 'Can veto a curator’s timelocked change before it executes. The danger is its absence.',
	sentinel:
		'Can cancel pending curator changes, cut caps, and pull funds back to idle — a veto-only safety role that cannot introduce new risk.',
	allocator: 'Moves liquidity between the markets the curator has already approved.'
}

function OperatorLine({
	roleName,
	roleKey,
	entity,
	capability,
	linkChain,
	explorers
}: {
	roleName: string
	roleKey: string
	entity: RoleEntity | null
	capability?: RoleCapability
	linkChain: string
	explorers?: BlockExplorersResponse
}) {
	const guardianAbsent = roleKey === 'guardian' && !entity
	const marker = operatorMarker(capability, guardianAbsent)
	const summary = capability?.summary ?? ROLE_FALLBACK[roleKey]
	return (
		<ExpandableLine
			marker={marker}
			detail={summary}
			trailing={
				entity ? (
					<AddressActions
						address={entity.address}
						url={explorerUrl(entity.address, linkChain, explorers)}
						label={`vault ${roleName.toLowerCase()} address`}
					/>
				) : undefined
			}
		>
			<span className="w-20 shrink-0 text-sm font-medium text-(--legacy-text-primary)">{roleName}</span>
			{entity ? (
				<EntityBadge entity={entity} />
			) : (
				<span className={`text-xs font-medium ${toneClasses('danger').text}`}>none appointed</span>
			)}
		</ExpandableLine>
	)
}

// "1 multisig · 2 contracts · 1 EOA" — the collapsed line's make-up summary.
function entityBreakdown(entities: RoleEntity[]): string {
	const counts: Record<string, number> = {}
	for (const e of entities) counts[e.kind] = (counts[e.kind] ?? 0) + 1
	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
	const parts: string[] = []
	if (counts.safe) parts.push(plural(counts.safe, 'multisig'))
	if (counts.contract) parts.push(plural(counts.contract, 'contract'))
	if (counts.eoa) parts.push(plural(counts.eoa, 'EOA'))
	if (counts.unknown) parts.push(`${counts.unknown} unverified`)
	return parts.join(' · ')
}

// A many-holder role (allocators, sentinels) collapsed to one counted line.
function RoleListDisclosure({
	roleName,
	roleKey,
	entities,
	capability,
	linkChain,
	explorers
}: {
	roleName: string
	roleKey: string
	entities: RoleEntity[]
	capability?: RoleCapability
	linkChain: string
	explorers?: BlockExplorersResponse
}) {
	const marker = operatorMarker(capability, false)
	const summary = capability?.summary ?? ROLE_FALLBACK[roleKey]
	return (
		<details className="group py-1">
			<summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-1">
				<span className="w-20 shrink-0 text-sm font-medium text-(--legacy-text-primary)">{roleName}</span>
				<span className="text-xs text-(--legacy-text-secondary)">
					{entities.length} · {entityBreakdown(entities)}
				</span>
				<span className="ml-auto flex items-center gap-2.5">
					{/* same quiet grammar as the legend: tone dot + muted text, never alarm ink */}
					{marker ? (
						<span className="flex items-center gap-1.5 text-[11px] text-(--legacy-text-secondary)">
							<span className={`size-2 shrink-0 rounded-full ${toneClasses(marker.tone).bar}`} aria-hidden />
							{marker.label}
						</span>
					) : null}
					<Icon
						name="chevron-down"
						className="size-3.5 text-(--legacy-text-secondary) transition-transform group-open:rotate-180"
					/>
				</span>
			</summary>
			<div className="mt-1 border-t border-(--legacy-cards-border) pt-1.5">
				{summary ? (
					<p className="mb-1.5 max-w-prose text-xs leading-relaxed text-(--legacy-text-secondary)">{summary}</p>
				) : null}
				<ul className="flex flex-col divide-y divide-(--legacy-cards-border)">
					{entities.map((a) => (
						<li key={a.address} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
							<EntityBadge entity={a} />
							<span className="flex items-center gap-2.5">
								<ReachDot marker={marker} />
								<AddressActions
									address={a.address}
									url={explorerUrl(a.address, linkChain, explorers)}
									label={`${roleKey} address`}
								/>
							</span>
						</li>
					))}
				</ul>
			</div>
		</details>
	)
}

// Who operates THIS vault — distinct from protocol governance; the trust layer closest to
// your deposit, rendered principal-first.
export function VaultRolesBlock({
	roles,
	capabilities,
	chain,
	explorers,
	nowIso
}: {
	roles: VaultRoles
	capabilities?: RoleCapability[]
	chain?: string
	explorers?: BlockExplorersResponse
	nowIso?: string
}) {
	const linkChain = chain ?? 'ethereum'
	const caps = capabilityByRole(capabilities)
	const owner = asRoleEntity(roles.owner)
	const curator = asRoleEntity(roles.curator)
	const guardian = asRoleEntity(roles.guardian)
	const sentinels = (roles.sentinels ?? []).map(asRoleEntity).filter((s): s is RoleEntity => s != null)
	const pendingOwner = asRoleEntity(roles.pending_owner)
	const allocators = (roles.allocators ?? []).map(asRoleEntity).filter((a): a is RoleEntity => a != null)
	// reference the data snapshot, not the render clock — deterministic across SSR/hydration
	const parsedNow = nowIso ? Date.parse(nowIso) : NaN
	const nowSec = Number.isNaN(parsedNow) ? Math.floor(Date.now() / 1000) : Math.floor(parsedNow / 1000)
	const pending = groupPending(roles, nowSec)
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
				<div className="flex flex-col gap-1">
					<span className={MICRO_LABEL}>Vault operators</span>
					<p className="text-xs text-(--legacy-text-secondary)">
						The roles that can actually move your deposit — the real principal-loss path.
					</p>
				</div>
				<ReachLegend />
			</div>

			{roles.timelock_sec != null ? (
				<p className="text-xs">
					<span className="font-medium text-(--legacy-text-primary)">Role timelock</span>{' '}
					{roles.timelock_sec > 0 ? (
						<span className={toneClasses('good').text}>
							{humanizeDuration(roles.timelock_sec)} to exit before owner/curator actions land
						</span>
					) : (
						<span className={toneClasses('danger').text}>none — owner/curator actions execute immediately</span>
					)}
				</p>
			) : null}

			{pending.length ? (
				<div className="rounded-md border border-amber-500/25 bg-amber-500/6 p-2.5">
					<p className="flex items-center gap-1.5 text-xs font-semibold text-(--warning)">
						<Icon name="clock" className="size-3.5" />
						{pending.length === 1 ? 'Curator change queued' : 'Curator changes queued'}
					</p>
					<p className="mt-0.5 text-[11px] text-(--legacy-text-secondary)">
						The timelock is your window to exit before each one takes effect.
					</p>
					<ul className="mt-1 flex flex-col gap-1 text-xs text-(--legacy-text-secondary)">
						{pending.map((g) => (
							<li key={`${g.label}:${g.live ? 'live' : 'now'}`} className="flex flex-wrap items-baseline gap-x-1.5">
								<span className="text-(--legacy-text-primary)">
									{g.label}
									{g.count > 1 ? ` ×${g.count}` : ''}
								</span>
								{g.live ? (
									<span>— applies in {humanizeDuration(g.soonestValidAt - nowSec)}; time to exit first</span>
								) : (
									<span className={toneClasses('danger').text}>— applies now; no time to exit first</span>
								)}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{pendingOwner ? (
				<div className="rounded-md border border-amber-500/25 bg-amber-500/6 p-2.5">
					<p className="flex items-center gap-1.5 text-xs font-semibold text-(--warning)">
						<Icon name="alert-triangle" className="size-3.5" />
						Ownership transfer in flight
					</p>
					<p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-(--legacy-text-secondary)">
						<span>Once accepted, this address controls every role below:</span>
						<AddressActions
							address={pendingOwner.address}
							url={explorerUrl(pendingOwner.address, linkChain, explorers)}
							label="pending owner address"
						/>
					</p>
				</div>
			) : null}

			<div className="grid gap-x-10 sm:grid-cols-2">
				<div className="flex flex-col divide-y divide-(--legacy-cards-border)">
					{owner ? (
						<OperatorLine
							roleName={caps.get('owner')?.role_label ?? 'Owner'}
							roleKey="owner"
							entity={owner}
							capability={caps.get('owner')}
							linkChain={linkChain}
							explorers={explorers}
						/>
					) : null}
					{curator ? (
						<OperatorLine
							roleName={caps.get('curator')?.role_label ?? 'Curator'}
							roleKey="curator"
							entity={curator}
							capability={caps.get('curator')}
							linkChain={linkChain}
							explorers={explorers}
						/>
					) : null}
				</div>
				<div className="flex flex-col divide-y divide-(--legacy-cards-border)">
					{/* the veto slot: guardian OR sentinels (never both); neither = unguarded, the danger state */}
					{guardian || !sentinels.length ? (
						<OperatorLine
							roleName={caps.get('guardian')?.role_label ?? 'Guardian'}
							roleKey="guardian"
							entity={guardian}
							capability={caps.get('guardian')}
							linkChain={linkChain}
							explorers={explorers}
						/>
					) : null}
					{sentinels.length ? (
						<RoleListDisclosure
							roleName="Sentinels"
							roleKey="sentinel"
							entities={sentinels}
							capability={caps.get('sentinel')}
							linkChain={linkChain}
							explorers={explorers}
						/>
					) : null}
					{allocators.length ? (
						<RoleListDisclosure
							roleName="Allocators"
							roleKey="allocator"
							entities={allocators}
							capability={caps.get('allocator')}
							linkChain={linkChain}
							explorers={explorers}
						/>
					) : null}
				</div>
			</div>
		</div>
	)
}
