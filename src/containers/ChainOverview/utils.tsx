import type { RawChainAsset } from '~/containers/BridgedTVL/api.types'
import type { IFormattedChainAsset } from './types'
import type { IChainOverviewData } from './types'

export function formatChainAssets(chainAsset: RawChainAsset | null) {
	if (!chainAsset) return null

	const acc = {} as IFormattedChainAsset
	for (const type in chainAsset) {
		const asset = chainAsset[type]
		const formatted = {} as any
		formatted.total = Number(asset.total.split('.')[0])
		const breakdown = {}
		for (const b in asset.breakdown) {
			breakdown[b] = Number(asset.breakdown[b].split('.')[0])
		}
		formatted.breakdown = breakdown
		acc[type] = formatted
	}
	return acc
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
