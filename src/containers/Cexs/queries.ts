import { getMetadataCache } from '~/server/routeRegistry/common'
import { fetchCexs } from './api'
import { resolveCexParamFromMetadata } from './server/routes'
import type { ICex } from './types'

interface CexsPageData {
	cexs: ICex[]
}

export async function getCexsPageData(): Promise<CexsPageData> {
	const [data, metadataCache] = await Promise.all([fetchCexs(), getMetadataCache()])
	const cexs: ICex[] = []

	for (const c of data.cexs) {
		const cexRoute = c.slug ? resolveCexParamFromMetadata(c.slug, metadataCache) : null
		const tokensToExclude: string[] = []
		if (c.coinSymbol) tokensToExclude.push(c.coinSymbol)
		if (c.ownTokens) {
			for (const token of c.ownTokens) {
				if (!tokensToExclude.includes(token)) tokensToExclude.push(token)
			}
		}
		const normalizedCex: ICex = {
			name: c.name,
			tokensToExclude,
			currentTvl: c.currentTvl ?? null,
			cleanAssetsTvl: c.cleanAssetsTvl ?? null,
			inflows_24h: c.inflows_24h ?? null,
			inflows_1w: c.inflows_1w ?? null,
			inflows_1m: c.inflows_1m ?? null,
			spotVolume: c.spotVolume ?? null,
			oi: c.oi ?? null,
			derivVolume: c.derivVolume ?? null,
			leverage: c.leverage ?? null,
			...(cexRoute ? { cexProtocolSlug: cexRoute.canonicalSlug } : {}),
			...(c.coin != null ? { coin: c.coin } : {}),
			...(c.coinSymbol != null ? { coinSymbol: c.coinSymbol } : {}),
			...(c.walletsLink != null ? { walletsLink: c.walletsLink } : {}),
			...(c.cgId != null ? { cgId: c.cgId } : {}),
			...(c.cgDeriv != null ? { cgDeriv: c.cgDeriv } : {}),
			...(c.lastAuditDate != null ? { lastAuditDate: c.lastAuditDate } : {}),
			...(c.auditor !== undefined ? { auditor: c.auditor } : {}),
			...(c.auditLink != null ? { auditLink: c.auditLink } : {})
		}

		cexs.push(normalizedCex)
	}

	return {
		cexs: cexs.sort((a, b) => (b.cleanAssetsTvl ?? 0) - (a.cleanAssetsTvl ?? 0))
	}
}
