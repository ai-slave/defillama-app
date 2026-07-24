import { formatDate } from '~/utils/dateFormat'
import { formatUsd } from '~/utils/numberFormat'
import type { GuardianRole, RiskLoss, RoleEntity } from './types'

const MIN = 60
const HOUR = 3600
const DAY = 86400

// "instant" | "6 hours" | "1 day" | "7 days" — compact, rounded to the most natural unit.
export function humanizeDuration(sec: number): string {
	if (!sec || sec <= 0) return 'instant'
	if (sec < HOUR) {
		const m = Math.round(sec / MIN)
		return `${m} ${m === 1 ? 'minute' : 'minutes'}`
	}
	if (sec < DAY) {
		const h = Math.round(sec / HOUR)
		return `${h} ${h === 1 ? 'hour' : 'hours'}`
	}
	const d = Math.round(sec / DAY)
	return `${d} ${d === 1 ? 'day' : 'days'}`
}

// Range formatter that respects loss.status — never shows a data_gap number as complete.
export function formatLossRange(loss: Pick<RiskLoss, 'status' | 'min_usd' | 'max_usd'>): string {
	if (loss.status === 'no_loss') return 'No direct fund loss'
	if (loss.status === 'data_gap') return 'Not fully measured'
	if (loss.status === 'not_attributable') return 'Not attributable to this vault'
	const { min_usd, max_usd } = loss
	if (min_usd === max_usd)
		return formatUsd(max_usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
	// A zero floor reads as noise ("$0 – $X"); the ceiling is the only number that matters.
	if (min_usd === 0)
		return `up to ${formatUsd(max_usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
	return `${formatUsd(min_usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })} – ${formatUsd(max_usd, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}`
}

// guardian_role may be a string, or a sourced attribution whose value is a string or
// {address, description}. Returns a short human label (or null).
export function guardianText(role: GuardianRole | null | undefined): string | null {
	if (!role) return null
	if (typeof role === 'string') return role
	const v = role.value
	if (typeof v === 'string') return v
	return v?.description ?? v?.address ?? null
}

// "aave-v3" → "Aave v3", "sky-staking-engine" → "Sky Staking Engine"
export function prettyProtocolSlug(slug: string): string {
	return slug
		.split('-')
		.map((w) => (/^v\d+$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
		.join(' ')
}

// Cross-protocol-trust scope copy, generated from aggregate_trust_scope so it tracks the
// llamarisks feed automatically — never hardcode the protocol list.
export function trustScopeTooltip(scope: string[] | undefined): string {
	const where = scope?.length
		? `the ${scope.length} lending protocols in the llamarisks feed: ${scope.map(prettyProtocolSlug).join(', ')}`
		: 'the lending protocols tracked by the llamarisks feed'
	return `How much value lends against this token across ${where}: a measure of how widely trusted it is, NOT this pool's loss. Your exposure here is a separate figure; when it exceeds this one, the vault is a large share of (or bigger than) the token's whole tracked lending footprint, a concentration signal.`
}

export function formatVerified(iso?: string): string {
	return (iso ? formatDate(iso) : null) ?? 'unknown'
}

// Coerce a role slot to a RoleEntity. Tolerates legacy fixtures carrying a bare address
// string — it becomes an `unknown`-kind entity rather than crashing the panel.
export function asRoleEntity(value: unknown): RoleEntity | null {
	if (!value) return null
	if (typeof value === 'string') return { address: value, kind: 'unknown' }
	if (typeof value === 'object') {
		const v = value as Partial<RoleEntity>
		if (typeof v.address === 'string') {
			return {
				address: v.address,
				kind: v.kind ?? 'unknown',
				threshold:
					v.threshold && typeof v.threshold.n === 'number' && typeof v.threshold.m === 'number'
						? v.threshold
						: undefined
			}
		}
	}
	return null
}

// `unknown` means the on-chain read failed this tick (neutral, not a flag).
export function roleEntityLabel(entity: RoleEntity): string {
	if (entity.kind === 'safe' && entity.threshold && entity.threshold.n > 0) {
		return `${entity.threshold.m}-of-${entity.threshold.n} multisig`
	}
	switch (entity.kind) {
		case 'safe':
			return 'multisig'
		case 'eoa':
			return 'single key (EOA)'
		case 'contract':
			return 'contract'
		default:
			return 'unverified'
	}
}
