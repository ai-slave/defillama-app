import type { IProtocolMetricsV2 } from '~/containers/ProtocolOverview/api.types'
import type { IProtocolWarningBanner } from './api.types'

export const getProtocolWarningBanners = (
	protocolData: Pick<IProtocolMetricsV2, 'warningBanners' | 'rugged' | 'deadUrl'>
) => {
	const banners: IProtocolWarningBanner[] = []
	const now = Date.now()
	if (protocolData.warningBanners) {
		for (const banner of protocolData.warningBanners) {
			if (banner.until == null || banner.until === 'forever') {
				banners.push(banner)
				continue
			}

			const expiry = typeof banner.until === 'number' ? banner.until * 1000 : Date.parse(banner.until)
			if (expiry > now) {
				banners.push(banner)
			}
		}
	}

	if (protocolData.rugged && protocolData.deadUrl) {
		banners.push({
			message: 'This protocol rug pulled user funds, their website is down.',
			level: 'rug'
		})
	} else {
		if (protocolData.rugged) {
			banners.push({
				message: 'This protocol rug pulled user funds.',
				level: 'rug'
			})
		}
	}
	return banners
}

export const filterStablecoinsFromTokens = (
	tokens: Record<string, number>,
	stablecoinSymbols: Set<string>
): Record<string, number> => {
	const filteredTokens: Record<string, number> = {}
	for (const token in tokens) {
		const value = tokens[token]
		if (value !== undefined && stablecoinSymbols.has(token)) {
			filteredTokens[token] = value
		}
	}
	return filteredTokens
}

export const groupTokensByPegType = (
	tokens: Record<string, number>,
	pegTypeMap: Map<string, string>
): Record<string, number> => {
	const grouped: Record<string, number> = {}
	for (const token in tokens) {
		const value = tokens[token]
		const pegType = pegTypeMap.get(token)
		if (value !== undefined && pegType) {
			grouped[pegType] = (grouped[pegType] ?? 0) + value
		}
	}
	return grouped
}

export const groupTokensByPegMechanism = (
	tokens: Record<string, number>,
	pegMechanismMap: Map<string, string>
): Record<string, number> => {
	const grouped: Record<string, number> = {}
	for (const token in tokens) {
		const value = tokens[token]
		const pegMechanism = pegMechanismMap.get(token)
		if (value !== undefined && pegMechanism) {
			grouped[pegMechanism] = (grouped[pegMechanism] ?? 0) + value
		}
	}
	return grouped
}
