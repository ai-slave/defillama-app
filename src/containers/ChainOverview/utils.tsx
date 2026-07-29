import type { ChainAssetTotals } from '~/containers/BridgedTVL/api.types'
import type { IChainOverviewData, IFormattedChainAsset } from './types'

export function formatChainAssets(chainAsset: ChainAssetTotals | null): IFormattedChainAsset | null {
	if (!chainAsset) return null

	return {
		canonical: { total: Math.trunc(chainAsset.canonical.total) },
		thirdParty: { total: Math.trunc(chainAsset.thirdParty.total) },
		...(chainAsset.ownTokens ? { ownTokens: { total: Math.trunc(chainAsset.ownTokens.total) } } : {}),
		...(chainAsset.native ? { native: { total: Math.trunc(chainAsset.native.total) } } : {}),
		total: { total: Math.trunc(chainAsset.total.total) }
	}
}

export function getChainWarningBanners(warningBanners: IChainOverviewData['warningBanners']) {
	if (!warningBanners?.length) return []

	const banners: NonNullable<IChainOverviewData['warningBanners']> = []
	for (const banner of warningBanners) {
		if (!banner.until || banner.until === 'forever') {
			banners.push(banner)
			continue
		}

		const until = new Date(typeof banner.until === 'number' ? banner.until * 1000 : banner.until)
		if (!Number.isNaN(until.getTime()) && until > new Date()) {
			banners.push(banner)
		}
	}
	return banners
}
