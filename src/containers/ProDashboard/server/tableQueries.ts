import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import { llamaDb } from '~/server/db/llama'
import { tokenIconUrl } from '~/utils/icons'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { buildTokenUsageSourcePlan, type TokenUsageStreamData } from '../tokenUsageSourcePlan'
import { formatDisplayName } from './unifiedTable/utils'

export async function fetchProTokenUsageData(
	tokenSymbols: string[],
	includeCex: boolean
): Promise<ProtocolTokenUsageData[]> {
	type TokenUsageRow = {
		protocol: string
		name: string
		category: string
		symbol: string
		amount_usd: number
	}
	const rows = await llamaDb.query<TokenUsageRow[]>(
		`
			SELECT
				t.sub_protocol AS protocol,
				p.name,
				p.category,
				requested.symbol,
				SUM(t.tvl)::double precision AS amount_usd
			FROM lens.token_tvl_current t
			JOIN dim.protocol p ON p.slug = t.sub_protocol
			JOIN unnest($1::text[]) requested(symbol)
				ON LOWER(t.symbol) LIKE '%' || LOWER(requested.symbol) || '%'
			WHERE t.tvl_component = 'base'
				AND t.tvl IS NOT NULL
				AND NOT p.has_misrepresented_tokens
				AND ($2 OR LOWER(p.category) <> 'cex')
			GROUP BY t.sub_protocol, p.name, p.category, requested.symbol
		`,
		[tokenSymbols, includeCex]
	)
	const protocols = new Map<string, ProtocolTokenUsageData>()
	for (const row of rows) {
		const current = protocols.get(row.protocol)
		if (current) {
			current.amountUsd += row.amount_usd
			current.tokens[row.symbol] = row.amount_usd
			continue
		}
		protocols.set(row.protocol, {
			name: row.name,
			category: formatDisplayName(row.category),
			amountUsd: row.amount_usd,
			logo: tokenIconUrl(row.protocol),
			tokens: { [row.symbol]: row.amount_usd }
		})
	}
	return Array.from(protocols.values())
}

export async function streamProTokenUsageData(
	items: DashboardItemConfig[],
	claimSource: (kind: string, key: readonly unknown[]) => boolean,
	schedule: (run: () => Promise<void>) => Promise<void>,
	onData: (data: TokenUsageStreamData) => Promise<void>
): Promise<void> {
	const requests: Promise<void>[] = []
	for (const source of buildTokenUsageSourcePlan(items)) {
		if (!claimSource('table-token-usage', [source.cacheKey])) continue
		requests.push(
			schedule(() =>
				fetchProTokenUsageData(source.tokenSymbols, source.includeCex).then((data) =>
					onData({ key: source.cacheKey, data })
				)
			)
		)
	}
	await Promise.allSettled(requests)
}
