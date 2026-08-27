import { SERVER_URL } from '~/constants'
import { fetchAdapterChainMetrics } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import { formatDate, formatMonthYear } from '~/utils/dateFormat'
import { tokenIconUrl } from '~/utils/icons'
import type { IProtocolMetadata } from '~/utils/metadata/types'
import { recordDomainEvent } from '~/utils/telemetry'
import type { RewardsApiRecord } from './api.types'
import { buildRewardsRankings } from './rankings.server'
import type { RewardProgram, RewardSource, RewardsPageProps } from './types'

// Editors supply these links. Never turn a javascript: or data: value into an
// action, and require a real host so a source can always name its publisher.
const PUBLIC_HTTP_URL = /^https?:\/\/(?:www\.)?([^/?#\s]+)/i

function publicHttpUrl(value: string): RewardSource | null {
	const trimmed = value.trim()
	const host = PUBLIC_HTTP_URL.exec(trimmed)?.[1]
	return host ? { url: trimmed, label: host } : null
}

// Editors record month granularity — 88 of the 89 dates the API serves fall on
// the 1st — so a day-precise label would be invented precision.
function dateRangeLabel(start: string | undefined, end: string | undefined) {
	const from = formatMonthYear(start)
	const until = formatMonthYear(end)
	if (from && until) return `${from} – ${until}`
	if (from) return `From ${from}`
	if (until) return `Until ${until}`
	return null
}

export function buildRewardsPageData(
	entries: RewardsApiRecord[],
	metadata: Record<string, IProtocolMetadata>,
	rankings: ReturnType<typeof buildRewardsRankings>
): RewardsPageProps {
	const programs: RewardProgram[] = []
	const missingMetadata = new Set<string>()
	for (const entry of entries) {
		// Publication is independent of lifecycle: public ended programs remain searchable.
		if (entry.publish_status !== 'Published' || entry.visibility !== 'Public') continue
		const protocol = metadata[entry.defillama_id]
		if (!protocol) missingMetadata.add(entry.defillama_id)
		const name = protocol?.displayName ?? protocol?.name ?? entry.protocol
		const rankingId = rankings.parentById.get(entry.defillama_id) ?? entry.defillama_id
		const sources: RewardSource[] = []
		for (const value of entry.source_url.split('|')) {
			const source = publicHttpUrl(value)
			if (source && !sources.some((existing) => existing.url === source.url)) sources.push(source)
		}
		programs.push({
			programId: entry.program_id,
			defillamaId: entry.defillama_id,
			fees30d: rankings.feesById.get(rankingId) ?? null,
			tvl: rankings.tvlById.get(rankingId) ?? null,
			protocol: name,
			programName: entry.program_name ?? null,
			category: protocol?.category ?? null,
			protocolHref: protocol?.name && !protocol.cex ? `/protocol/${slug(name)}` : null,
			logo: protocol ? tokenIconUrl(name) : null,
			rewardTypes: entry.reward_types ?? [],
			lifecycle: entry.lifecycle,
			verification: entry.verification,
			sortDate: entry.start_date ?? entry.end_date ?? null,
			dateRangeLabel: dateRangeLabel(entry.start_date, entry.end_date),
			summary: entry.summary,
			visitorBenefit: entry.visitor_benefit,
			// Published for every program: reward_types describes what a program pays
			// out, never whether inviting others earns anything, so it cannot gate this.
			// Entries with no referral payout say so in their own copy.
			referrerBenefit: entry.referrer_benefit,
			referralUrl: publicHttpUrl(entry.referral_url)?.url ?? null,
			sources,
			lastVerified: formatDate(entry.last_verified)
		})
	}
	// Stable alphabetical input breaks metric ties without displaying a second
	// active sort arrow on the protocol column. The table applies the URL sort.
	programs.sort(
		(a, b) =>
			a.protocol.localeCompare(b.protocol) ||
			(a.programName ?? '').localeCompare(b.programName ?? '') ||
			a.programId.localeCompare(b.programId)
	)
	if (missingMetadata.size) {
		recordDomainEvent('rewards.missing_metadata', 'warn', 'rewards', 'Rewards programs missing protocol metadata', {
			defillama_ids: [...missingMetadata]
		})
	}
	return { programs }
}

export async function getRewardsPageData(): Promise<RewardsPageProps> {
	const [entries, { default: metadata }, { protocols }, fees] = await Promise.all([
		fetchJson<RewardsApiRecord[]>(`${SERVER_URL}/rewards`),
		import('~/utils/metadata'),
		fetchProtocols(),
		fetchAdapterChainMetrics({ adapterType: ADAPTER_TYPES.FEES, chain: 'All', dataType: ADAPTER_DATA_TYPES.DAILY_FEES })
	])
	return buildRewardsPageData(entries, metadata.protocolMetadata, buildRewardsRankings(protocols, fees.protocols))
}
