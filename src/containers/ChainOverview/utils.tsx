import type { ChainAssetTotals } from '~/containers/BridgedTVL/api.types'
import { CHAIN_ASSET_OPTIONAL_CATEGORIES } from '~/containers/BridgedTVL/api.types'
import type { IChainOverviewData, IFormattedChainAsset } from './types'

export function formatChainAssets(chainAsset: ChainAssetTotals | null): IFormattedChainAsset | null {
	if (!chainAsset) return null

	const formatted: IFormattedChainAsset = {
		canonical: { total: Math.trunc(chainAsset.canonical.total) },
		thirdParty: { total: Math.trunc(chainAsset.thirdParty.total) },
		total: { total: Math.trunc(chainAsset.total.total) }
	}
	// driven off the category list so a section the producer adds reaches the page instead of being projected away
	for (const category of CHAIN_ASSET_OPTIONAL_CATEGORIES) {
		const section = chainAsset[category]
		if (section !== undefined) formatted[category] = { total: Math.trunc(section.total) }
	}
	return formatted
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
