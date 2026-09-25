import { beforeEach } from 'vitest'
import { SERVER_URL, VAULT_RISK_API } from '~/constants'
import type { YieldsSnapshot } from '~/containers/Yields/data/snapshot'
import { YIELDS_SNAPSHOT_FILES } from '~/containers/Yields/data/snapshot.contract'
import type {
	BorrowMarketRow,
	DepegRow,
	EarnRow,
	LoopRow,
	RouteRow,
	TokenKeys,
	Trend,
	VerifiedRow,
	YieldsMeta
} from '~/containers/Yields/data/types'
import { installFixtureFetch } from '~/utils/test/fixtureFetch'

export function installYieldsFixtures() {
	const http = installFixtureFetch()
	beforeEach(() => {
		http.serve({
			[VAULT_RISK_API]: { data: [] },
			[`${SERVER_URL}/raises`]: { raises: [] },
			[`${SERVER_URL}/lite/protocols2`]: { protocols: [], parentProtocols: [], chains: [], protocolCategories: [] }
		})
	})
	return http
}

export const yieldsMeta: YieldsMeta = {
	chains: [
		{ name: 'Ethereum', slug: 'ethereum', is_evm: true },
		{ name: 'Base', slug: 'base', is_evm: true }
	],
	protocols: [
		{ name: 'Aave', slug: 'aave', category: 'Lending', has_audit: false, potential_airdrop: false },
		{ name: 'Aave V3', slug: 'aave-v3', category: 'Lending', has_audit: false, potential_airdrop: false },
		...['test', 'aave-v3', 'uniswap-v2', 'lido', 'compound-v3'].map((name) => ({
			name,
			slug: name,
			category: 'Dexs',
			has_audit: false,
			potential_airdrop: false
		}))
	],
	categories: [],
	tokens: { families: [], assets: [] },
	halal: ['uniswap-v2', 'lido'],
	meme_pool_ids: []
}

let generation = 0
export function yieldsSnapshot(
	data: {
		earn?: Array<EarnRow>
		earnVerified?: Array<VerifiedRow>
		borrowMarkets?: Array<BorrowMarketRow>
		borrowRoutes?: Array<RouteRow>
		loops?: Array<LoopRow>
		tokenKeys?: Array<TokenKeys>
		trends?: Array<Trend>
		meta?: YieldsMeta
		depegs?: Array<DepegRow>
		exploits?: Array<string>
	},
	generationId = `fixture-${++generation}`
): YieldsSnapshot {
	const files: Record<string, unknown> = {}
	for (const key of Object.keys(YIELDS_SNAPSHOT_FILES) as Array<keyof typeof YIELDS_SNAPSHOT_FILES>) {
		files[YIELDS_SNAPSHOT_FILES[key]] = data[key] ?? (key === 'meta' ? yieldsMeta : [])
	}
	return {
		generationId,
		generatedAt: 1,
		async readJson<T>(path: string): Promise<T> {
			if (!(path in files)) throw new Error(`Missing Yields fixture ${path}`)
			return files[path] as T
		}
	}
}
