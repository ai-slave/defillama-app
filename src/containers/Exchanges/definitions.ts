export interface ExchangeDefinition {
	label: string
	description: string
}

// ponytail: descriptions stay one or two short sentences. Facts that hold for every
// volume or fee column (one-sided counting, pre-discount fees) are stated once per
// column in the shortest form, not re-explained in each.
export const exchangeDefinitions = {
	segments: {
		spot: {
			label: 'Spot',
			description: 'Buying and selling the asset itself, settled immediately.'
		},
		linearPerps: {
			label: 'USD Perps',
			description: 'Perps margined and settled in a quote asset such as USDT or USDC.'
		},
		inversePerps: {
			label: 'COIN Perps',
			description: 'Perps margined and settled in the coin itself, so collateral and PnL are in that coin.'
		}
	},
	summary: {
		totalVolume24h: {
			label: 'Total Trading Volume (24h)',
			description:
				'Spot plus perp USD volume across tracked venues, last 24h. One-sided; a shared order book counts once.'
		},
		cex: {
			label: 'CEX',
			description: 'Spot plus perp volume from centralized exchanges.'
		},
		dex: {
			label: 'DEX',
			description: 'Spot plus perp volume from decentralized exchanges.'
		},
		spot: {
			label: 'Spot',
			description: 'Spot USD volume, last 24h. One-sided.'
		},
		linearPerp: {
			label: 'USD Perps',
			description: 'Volume in perps margined in a quote asset such as USDT or USDC, last 24h. One-sided.'
		},
		inversePerp: {
			label: 'COIN Perps',
			description: 'Volume in perps margined in the coin itself, last 24h. One-sided.'
		},
		spotVolume24h: {
			label: 'Spot volume 24h',
			description: 'Spot USD volume across tracked venues. One-sided.'
		},
		linearPerpVolume24h: {
			label: 'USD perp volume 24h',
			description: 'USD-margined perp volume across tracked venues. One-sided.'
		},
		inversePerpVolume24h: {
			label: 'COIN perp volume 24h',
			description: 'Coin-margined perp volume across tracked venues. One-sided.'
		},
		linearPerpOpenInterest: {
			label: 'USD perp open interest',
			description: 'USD value of one side of open positions in tracked USD perp markets.'
		},
		inversePerpOpenInterest: {
			label: 'COIN perp open interest',
			description: 'USD value of one side of open positions in tracked COIN perp markets.'
		},
		reserves: {
			label: 'Reserves',
			description: 'Assets held in tracked exchange wallets. Assets only, not liabilities or solvency.'
		},
		venues: {
			label: 'Venues',
			description: 'Tracked venues have activity data; listed also counts metadata-only entries.'
		}
	},
	directory: {
		name: {
			label: 'Exchange',
			description:
				'Venue identity, sorted by the REAL ranking the table opens with. “Metadata only” means no market activity is tracked.'
		},
		venueLinks: {
			label: 'Links',
			description: 'Reserves page, DefiLlama profile, and website.'
		},
		// Header tooltips are plain strings, so the docs pointer is spelled out rather than linked.
		execCostToTrade: {
			label: 'Cost to trade $10k',
			description: 'What a $10k market order really costs: taker fee plus half the spread, measured from actual fills.'
		},
		execSlippage10k: {
			label: 'Slippage',
			description: 'How far fills moved the price at $10k and $100k, with what the order book predicted first.'
		},
		execMarkout1m: {
			label: 'Markout',
			description:
				'Where the price went 1 and 5 minutes after a fill, per $10k. Positive (red) means it kept moving against the buyer.'
		},
		kind: {
			label: 'Type',
			description: 'Centralized (CEX) or decentralized (DEX).'
		},
		volume24h: {
			label: '24h Volume',
			description:
				'USD volume over the last 24h for the selected scope. One-sided. A dotted value shares its order book with another venue that also counts it; brand rows add the parent plus each own-book entity.'
		},
		volumeChange24h: {
			label: 'Volume Δ',
			description: 'Change versus the previous 24h.'
		},
		openInterestUsd: {
			label: 'Open Interest',
			description:
				'USD value of one side of open perp positions, latest snapshot. A dotted value shares its order book with another venue that also counts it; brand rows sum own-book children only.'
		},
		volumeToOi: {
			label: 'Vol / OI',
			description:
				'24h volume ÷ open interest: how many times the position base turned over in a day. Very high suggests wash-like churn or a thin base. Perp scopes only.'
		},
		volumeToDepth: {
			label: 'Vol / Depth',
			description:
				'24h volume ÷ the ±2% depth we snapshot: daily turnover against resting liquidity. Very high means volume dwarfs the visible book.'
		},
		openInterestChange24h: {
			label: 'OI Δ',
			description: 'Change versus 24 hours earlier.'
		},
		marketCount: {
			label: 'Markets',
			description: 'Active trading markets in the selected scope.'
		},
		coinCount: {
			label: 'Coins',
			description: 'Distinct base assets in the selected scope.'
		},
		normalizedVolume: {
			label: 'Norm Volume',
			description:
				'Reported 24h volume capped at what the book we snapshot could support, so never above reported. A * marks a market with no captured book. Brand rows sum the parent plus each own-book entity.'
		},
		activeLiquidity: {
			label: 'Active liquidity',
			description:
				'Bid plus ask depth from our own snapshots inside each market’s daily volatility band (2% to 25%) instead of a fixed ±2%. Observed depth only, never extrapolated.'
		},
		depth2Usd: {
			label: 'Depth ±2%',
			description:
				'Bid plus ask depth within 2% of mid, from our own snapshots. A floor: endpoint limits can cut a book short. Active liquidity is the volatility-adjusted version.'
		},
		segmentActiveLiquidity: {
			label: 'Active liquidity',
			description:
				'Active liquidity across the venue’s spot and USD perp markets, one line each. N/A means it runs neither. COIN perps are separate.'
		},
		spotSlippage: {
			label: 'Spot slippage',
			description:
				'How far fills moved the price on the venue’s spot markets at $10k and $100k, with what the order book predicted first.'
		},
		perpSlippage: {
			label: 'USD perp slippage',
			description:
				'How far fills moved the price on the venue’s USD perp markets at $10k and $100k, with what the order book predicted first.'
		},
		spotMarkout: {
			label: 'Spot markout',
			description:
				'Where the price went 1 and 5 minutes after a spot fill, per $10k. Positive (red) means it kept moving against the buyer.'
		},
		perpMarkout: {
			label: 'USD perp markout',
			description:
				'Where the price went 1 and 5 minutes after a USD perp fill, per $10k. Positive (red) means it kept moving against the buyer.'
		},
		intraSpread: {
			label: 'Intra-spread vol.',
			description:
				'Share of volume printed inside the spread the order book showed. Blank below 2.5%, amber from 5%, a warning from 10%.'
		},
		perpOpenInterest: {
			label: 'USD perp OI',
			description:
				'USD value of one side of open USD perp positions; halved where the venue publishes long plus short. COIN perps are separate.'
		},
		spotNormalizedVolume: {
			label: 'Spot n. vol',
			description:
				'24h spot volume capped at what the book we snapshot could support. A * means no book was captured, so reported volume is shown unchecked.'
		},
		perpNormalizedVolume: {
			label: 'USD perp n. vol',
			description:
				'24h USD perp volume capped at what the book we snapshot could support. A * means no book was captured, so reported volume is shown unchecked.'
		},
		sparkline: {
			label: 'Volume trend',
			description:
				'Up to 14 recent daily volume points for the selected scope. Brand rows sum the parent and each own-book regional entity.'
		},
		reservesUsd: {
			label: 'Reserves',
			description: 'USD value of assets in tracked exchange wallets. Assets only, not liabilities or solvency.'
		},
		cleanRatio: {
			label: 'Clean Ratio',
			description: 'Clean reserves ÷ total reserves. Clean excludes assets the exchange issued itself.'
		},
		inflows24hUsd: {
			label: '24h Inflows',
			description: 'Net USD flow into tracked reserve wallets over the last 24h.'
		},
		inflows7dUsd: {
			label: '7d Inflows',
			description: 'Net USD flow into tracked reserve wallets over the last 7 days.'
		},
		inflows1mUsd: {
			label: '1m Inflows',
			description: 'Net USD flow into tracked reserve wallets over the last month.'
		},
		ownTokenFraction: {
			label: 'Own Token',
			description: 'Share of tracked reserves held in assets the exchange issued itself.'
		},
		auditor: {
			label: 'Auditor',
			description: 'Auditor or attestation provider for the venue’s reserve disclosure.'
		},
		freshness: {
			label: 'Volume as of',
			description: 'Date of the volume observation used for this venue and scope.'
		},
		warnings: {
			label: 'Warnings',
			description: 'Current editorial or data-quality cautions. Open the value to read them.'
		},
		reservesSource: {
			label: 'Source',
			description: 'Page used to verify the venue’s reserve data.'
		},
		spotFee: {
			label: 'Spot fees',
			description: 'Regular-tier spot maker and taker fees, before VIP or fee-token discounts.'
		},
		linearPerpFee: {
			label: 'USD Perps fees',
			description:
				'Regular-tier maker and taker fees on perps margined in a quote asset such as USDT or USDC, before VIP or fee-token discounts.'
		},
		inversePerpFee: {
			label: 'COIN Perps fees',
			description:
				'Regular-tier maker and taker fees on perps margined in the coin itself, before VIP or fee-token discounts.'
		},
		feeToken: {
			label: 'Fee Token',
			description: 'Venue token that cuts trading fees, with the recorded discount where available.'
		},
		fiatCurrencies: {
			label: 'Fiat currencies',
			description: 'Fiat currencies documented on the venue’s funding rails.'
		},
		fiatFees: {
			label: 'Fiat fees',
			description: 'Documented on- and off-ramp routes. Open the value for methods, fees, minimums, times and sources.'
		},
		fiatOnramp: {
			label: 'Fiat on-ramp',
			description: 'Whether the venue documents a route for moving fiat onto the platform.'
		},
		rampCost: {
			label: '$1k on-ramp cost',
			description:
				'All-in cost of depositing $1,000, buying BTC and withdrawing it: fiat, taker, slippage and transfer fees. Priced on the selected country’s cheapest rail, otherwise EUR/SEPA.'
		},
		offRampCost: {
			label: '$1k off-ramp cost',
			description:
				'All-in cost of depositing BTC, selling it and withdrawing $1,000 of fiat: fiat, taker, slippage and transfer fees. Priced on the selected country’s cheapest rail, otherwise EUR/SEPA.'
		},
		headquarters: {
			label: 'HQ',
			description: 'Recorded headquarters of the entity in this row.'
		},
		euStatus: {
			label: 'EU availability',
			description: 'Usability for EU customers today. Separate from holding a MiCA authorization.'
		},
		mica: {
			label: 'MiCA',
			description: 'Recorded MiCA authorization. It does not by itself imply current EU availability.'
		},
		kyc: {
			label: 'KYC',
			description: 'Identity documents and verification steps required to use the exchange.'
		},
		licenseCount: {
			label: 'All licenses',
			description: 'Recorded regulatory licenses across all jurisdictions, not only MiCA.'
		},
		founded: {
			label: 'Founded',
			description: 'Year the venue entity was founded.'
		}
	},
	markets: {
		venue: {
			label: 'Venue',
			description: 'Exchange that lists this market.'
		},
		token: {
			label: 'Token',
			description: 'Base asset being traded.'
		},
		pair: {
			label: 'Pair',
			description: 'Venue market symbol. Open it to visit the market on the venue.'
		},
		price: {
			label: 'Price',
			description: 'Latest price, in the quote asset shown beside the value.'
		},
		priceChange24h: {
			label: 'Price Δ',
			description: 'Change over the last 24h.'
		},
		volume24h: {
			label: 'Volume',
			description: 'USD volume for this market over the last 24h. One-sided.'
		},
		volumeChange24h: {
			label: 'Volume Δ',
			description: 'Change versus the previous 24h.'
		},
		normalizedVolume: {
			label: 'Norm Volume',
			description:
				'Reported 24h volume capped at what the book we snapshot could support, so never above reported. A * marks a market with no captured book, shown unchecked.'
		},
		activeLiquidity: {
			label: 'Active liquidity',
			description:
				'Bid plus ask depth from our own snapshot inside this market’s own volatility band (its typical daily range, 2% to 25%) instead of a fixed ±2%, so it covers the depth reachable on a day like today. Observed depth only. Hover for the band and how much of the visible book it spans.'
		},
		depth2Usd: {
			label: 'Depth ±2%',
			description: 'Bid plus ask depth within 2% of mid, from our own snapshot, never venue-reported.'
		},
		spreadFraction: {
			label: 'Spread',
			description: 'Best ask minus best bid, as a percentage of mid.'
		},
		execCostToTrade: {
			label: 'Cost to trade $10k',
			description:
				'What a $10k market order on this market really costs: taker fee plus half the effective spread, from the last 30 days of fills.'
		},
		execSlippage10k: {
			label: 'Slippage $10k',
			description: 'What the order book before a $10k order predicted, then what the fills paid, in dollars.'
		},
		execEffectiveSpread: {
			label: 'Eff. spread',
			description: 'What trades actually paid: twice the gap between fill price and mid, as a percentage of price.'
		},
		execMarkout1m: {
			label: 'Markout 1m',
			description:
				'Where the price went 1 minute after a fill, per $10k. Positive (red) means it kept moving against the taker.'
		},
		intraSpread: {
			label: 'Intra-spread vol.',
			description:
				'Share of volume printed inside the spread the order book showed. Blank below 2.5%, amber from 5%, a warning from 10%.'
		},
		markPrice: {
			label: 'Mark price',
			description: 'Venue mark price, used to value open positions and unrealized PnL.'
		},
		indexPrice: {
			label: 'Index price',
			description: 'Reference asset price the venue marks the contract against.'
		},
		basis: {
			label: 'Basis',
			description: 'Mark price premium or discount to the index price (mark ÷ index − 1).'
		},
		openInterestUsd: {
			label: 'Open Interest',
			description: 'USD value of one side of open positions in this market, latest snapshot.'
		},
		openInterestChange24h: {
			label: 'OI Δ',
			description: 'Change versus 24 hours earlier.'
		},
		fundingRate8h: {
			label: 'Funding 8h',
			description:
				'Payment rate between longs and shorts, normalized to 8 hours. Open a value for the venue’s raw period.'
		},
		nextFundingAt: {
			label: 'Next funding',
			description: 'Next scheduled funding payment, in UTC.'
		},
		maxLeverage: {
			label: 'Max Leverage',
			description: 'Maximum leverage recorded for this market.'
		},
		volumeFreshness: {
			label: 'Volume as of',
			description: 'Date of the latest volume observation for this market.'
		},
		makerFee: {
			label: 'Maker Fee',
			description: 'Fee on orders that add liquidity, before VIP or fee-token discounts.'
		},
		takerFee: {
			label: 'Taker Fee',
			description: 'Fee on orders that remove liquidity, before VIP or fee-token discounts.'
		},
		listedAt: {
			label: 'Listed',
			description: 'Venue-reported listing date, where available.'
		}
	}
} as const satisfies {
	segments: Record<string, ExchangeDefinition>
	summary: Record<string, ExchangeDefinition>
	directory: Record<string, ExchangeDefinition>
	markets: Record<string, ExchangeDefinition>
}
