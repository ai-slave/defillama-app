import type { RawAllLiquidationsResponse } from '~/containers/LiquidationsV2/api.types'

export function extractLiquidationsTokenSymbols(liquidationsResponse: RawAllLiquidationsResponse): string[] {
	const symbols = new Set<string>()

	for (const protocolId in liquidationsResponse.data) {
		const protocolData = liquidationsResponse.data[protocolId]
		if (!protocolData) continue
		for (const chainId in protocolData) {
			const positions = protocolData[chainId]
			if (!positions) continue

			for (const position of positions) {
				symbols.add(position.collateral)
			}
		}
	}

	return Array.from(symbols).sort((a, b) => a.localeCompare(b))
}
