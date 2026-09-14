import type { RWAAssetOverviewRow, RWAPerpsContractOverlayRow } from '../../api.types'

export function spotAsset(overrides: Partial<RWAAssetOverviewRow> = {}): RWAAssetOverviewRow {
	return {
		id: 'usdy',
		kind: 'spot',
		detailHref: '/rwa/asset/ondo%2Fusdy',
		canonicalMarketId: 'ondo/usdy',
		ticker: 'USDY',
		assetName: 'Ondo USDY',
		logo: null,
		primaryChain: 'Ethereum',
		chain: ['Ethereum', 'Solana', 'Mantle'],
		price: 1.05,
		openInterest: null,
		volume24h: null,
		volume30d: null,
		assetGroup: 'Bonds',
		parentPlatform: 'Ondo',
		category: ['Treasuries'],
		assetClass: ['Bonds'],
		accessModel: 'Permissioned',
		type: 'Asset',
		rwaClassification: 'RWA',
		issuer: 'Ondo',
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: false,
		governance: false,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: {
			total: 1_000_000,
			breakdown: [
				['Ethereum', 700_000],
				['Solana', 295_000],
				['Mantle', 5000]
			]
		},
		activeMcap: {
			total: 800_000,
			breakdown: [
				['Ethereum', 600_000],
				['Solana', 200_000]
			]
		},
		defiActiveTvl: { total: 100_000, breakdown: [['Aave', 100_000]] },
		defiActiveTvlByChain: { total: 100_000, breakdown: [['Ethereum', 100_000]] },
		priors: {
			'1d': { activeMcap: 790_000, onChainMcap: 990_000, defiActiveTvl: 99_000, bridgeTvl: 0 },
			'7d': { activeMcap: 700_000, onChainMcap: 900_000, defiActiveTvl: 80_000, bridgeTvl: 0 },
			'1m': { activeMcap: 500_000, onChainMcap: 600_000, defiActiveTvl: 50_000, bridgeTvl: 0 }
		},
		firstSeen: 1_700_000_000_000,
		...overrides
	}
}

export function perpsAsset(overrides: Partial<RWAPerpsContractOverlayRow> = {}): RWAPerpsContractOverlayRow {
	return {
		id: 'perps-usdy',
		kind: 'perps',
		priceChange24h: 2.5,
		openInterestChange24h: 25,
		volume7d: 6000,
		fundingRate: 0.0001,
		fundingIntervalHours: 8,
		premium: 0.002,
		maxLeverage: 50,
		protocolFees24h: 300,
		venueType: 'DEX',
		detailHref: '/rwa/perps/contract/hl%3Ausdy',
		contract: 'hl:USDY',
		ticker: 'hl:USDY',
		assetName: 'USDY Perp',
		logo: null,
		primaryChain: null,
		chain: null,
		price: 1,
		openInterest: 5000,
		volume24h: 1000,
		volume30d: 20_000,
		assetGroup: 'Bonds',
		parentPlatform: 'Hyperliquid',
		category: ['Treasuries'],
		assetClass: ['Bond Perp'],
		accessModel: 'Permissionless',
		type: 'Perp',
		rwaClassification: 'RWA',
		issuer: 'Ondo',
		redeemable: null,
		attestations: null,
		cexListed: null,
		kycForMintRedeem: null,
		kycAllowlistedWhitelistedToTransferHold: null,
		transferable: null,
		selfCustody: null,
		stablecoin: null,
		governance: null,
		trueRWA: false,
		suspicious: false,
		suspiciousReason: null,
		onChainMcap: null,
		activeMcap: null,
		defiActiveTvl: null,
		defiActiveTvlByChain: null,
		...overrides
	}
}
