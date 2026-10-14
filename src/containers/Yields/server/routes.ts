import { isPoolId } from '../poolDetail/fetch'
import { acquireYieldsSnapshot, readEarn } from './dataset.server'

// Pool pages 404 unless the id is a UUID. Largest TVL first so a split sitemap
// file still leads with the pools a crawler should find.
export function yieldPoolSitemapPaths(rows: ReadonlyArray<{ id: string; tvl_usd: number | null }>): Array<string> {
	const ranked: Array<{ id: string; tvl: number }> = []
	const seen = new Set<string>()
	for (const row of rows) {
		if (!isPoolId(row.id) || seen.has(row.id)) continue
		seen.add(row.id)
		ranked.push({ id: row.id, tvl: row.tvl_usd ?? 0 })
	}
	ranked.sort((left, right) => right.tvl - left.tvl || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
	const paths: Array<string> = []
	for (const row of ranked) paths.push(`yields/pool/${row.id}`)
	return paths
}

export async function getYieldsSitemapRoutes(): Promise<Array<string>> {
	const snapshot = await acquireYieldsSnapshot('background')
	return yieldPoolSitemapPaths(await readEarn(snapshot))
}
