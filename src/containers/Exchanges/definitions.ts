export interface ExchangeDefinition {
	label: string
	description: string
}

export const exchangeDefinitions = {
	segments: {
		spot: {
			label: 'Spot',
			description: 'Markets where the base asset itself is bought and sold for immediate settlement.'
		},
		linearPerps: {
			label: 'USD Perps',
			description: 'Perpetual contracts margined and settled in a quote asset such as USDT or USDC.'
		},
		inversePerps: {
			label: 'COIN Perps',
			description:
				'Perpetual contracts margined and settled in the underlying coin, so collateral and PnL are denominated in that coin.'
		}
	},
	summary: {
		totalVolume24h: {
			label: 'Total Trading Volume (24h)',
			description:
				"Spot plus perpetual USD volume across tracked venues over the latest 24h, valued at each day's own volume-weighted average price. One-sided: each trade counted once, and shared order books counted once."
		},
		cex: {
			label: 'CEX',
			description: 'Total spot and perpetual volume from centralized exchanges.'
		},
		dex: {
			label: 'DEX',
			description: 'Total spot and perpetual volume from decentralized exchanges.'
		},
		spot: {
			label: 'Spot',
			description: 'USD spot-market volume over the latest 24h, counted one-sided (each trade once).'
		},
		linearPerp: {
			label: 'USD Perps',
			description:
				'USD volume in perps margined and settled in a quote asset such as USDT or USDC, over the latest 24h, counted one-sided (each trade once).'
		},
		inversePerp: {
			label: 'COIN Perps',
			description:
				'USD volume in perps margined and settled in the underlying coin (collateral and PnL in that coin), over the latest 24h, counted one-sided (each trade once).'
		},
		spotVolume24h: {
			label: 'Spot volume 24h',
			description: 'Total USD spot volume across tracked venues, counted one-sided (each trade once).'
		},
		linearPerpVolume24h: {
			label: 'USD perp volume 24h',
			description:
				'Total USD volume in USD-margined perps across tracked venues, counted one-sided (each trade once). Margined and settled in a quote asset such as USDT or USDC.'
		},
		inversePerpVolume24h: {
			label: 'COIN perp volume 24h',
			description:
				'Total USD volume in coin-margined perps across tracked venues, counted one-sided (each trade once). Collateral and PnL are denominated in the underlying coin.'
		},
		linearPerpOpenInterest: {
			label: 'USD perp open interest',
			description: 'USD value of one side of open positions across tracked USD perp markets.'
		},
		inversePerpOpenInterest: {
			label: 'COIN perp open interest',
			description: 'USD value of one side of open positions across tracked COIN perp markets.'
		},
		reserves: {
			label: 'Reserves',
			description: 'Assets held in tracked exchange reserve wallets. Assets only, not liabilities or solvency.'
		},
		venues: {
			label: 'Venues',
			description: 'Tracked venues have market activity data; listed also counts metadata-only entries.'
		}
	},
	directory: {
		name: {
			label: 'Exchange',
			description:
				'Venue identity; sorts by the REAL ranking the table opens with. “Metadata only” means exchange information exists but market activity is not tracked.'
		},
		venueLinks: {
			label: 'Links',
			description: 'Shortcuts to the venue’s reserves page, its DefiLlama profile, and its website.'
		},
		execCostToTrade: {
			label: 'Cost to trade $10k',
			description:
				'What a $10k market order costs all in: taker fee plus half the spread you cross, measured from real fills. VIP tiers can lower the fee part. N/A until 72 measured hours.'
		},
		execSlippage10k: {
			label: 'Slippage',
			description:
				'What fills actually paid beyond the mid price at $10k and $100k, with what the order book promised shown first. Actual far above predicted means displayed depth moves before fills land. N/A until 72 measured hours.'
		},
		execMarkout1m: {
			label: 'Markout',
			description:
				'Where the price went one and five minutes after a fill, per $10k traded. Positive (red) means it kept moving against the taker, a sign of trading against faster flow. Lower is better.'
		},
		kind: {
			label: 'Type',
			description: 'CEX means centralized exchange; DEX means decentralized exchange.'
		},
		volume24h: {
			label: '24h Volume',
			description:
				'USD volume over the latest 24h for the selected scope, counted one-sided (each trade once). A dotted value shares its order book with another venue that also counts it; brand rows add the parent plus each own-book entity.'
		},
		volumeChange24h: {
			label: 'Volume Δ',
			description: 'Percentage change in 24-hour volume versus the preceding 24-hour observation.'
		},
		openInterestUsd: {
			label: 'Open Interest',
			description:
				'USD value of one side of open perp positions at the latest snapshot. A dotted value shares its order book with another venue that also counts it; brand rows sum own-book children only.'
		},
		volumeToOi: {
			label: 'Vol / OI',
			description:
				'24h volume divided by open interest: how many times the open position base turned over in a day. Very high values suggest wash-like churn or a thin position base. Perp scopes only.'
		},
		volumeToDepth: {
			label: 'Vol / Depth',
			description:
				'24h volume divided by the ±2% depth we snapshot: daily turnover against resting liquidity. Very high values mean volume dwarfs the visible book.'
		},
		openInterestChange24h: {
			label: 'OI Δ',
			description: 'Percentage change in open interest versus 24 hours earlier.'
		},
		marketCount: {
			label: 'Markets',
			description: 'Number of active trading markets in the selected market scope.'
		},
		coinCount: {
			label: 'Coins',
			description: 'Number of distinct base assets represented by markets in the selected scope.'
		},
		normalizedVolume: {
			label: 'Norm Volume',
			description:
				'Reported 24h volume (one-sided) capped at what the order book we snapshot could support, so never above reported. A * marks a market with no captured book. Brand rows sum the parent plus each own-book entity.'
		},
		activeLiquidity: {
			label: 'Active liquidity',
			description:
				"Bid plus ask depth from our own order-book snapshots inside each market's own daily volatility band (floor 2%, ceiling 25%), instead of a fixed ±2%. Observed depth only, never extrapolated."
		},
		depth2Usd: {
			label: 'Depth ±2%',
			description:
				'Bid plus ask depth within 2% of mid, from our own snapshots, never venue-reported, and a floor: endpoint level caps can stop a book short. Active liquidity is the volatility-adjusted version.'
		},
		spotActiveLiquidity: {
			label: 'Spot liq.',
			description: 'Active liquidity across the venue’s spot markets. N/A means it runs no spot market.'
		},
		perpActiveLiquidity: {
			label: 'USD perp liq.',
			description: 'Active liquidity across the venue’s USD perpetual markets. COIN perps remain separate.'
		},
		perpOpenInterest: {
			label: 'USD perp OI',
			description:
				'USD value of one side of open positions across the venue’s USD perpetual markets; where the venue publishes long plus short summed, we halve it. COIN perps remain separate.'
		},
		spotNormalizedVolume: {
			label: 'Spot n. vol',
			description:
				'24h spot volume capped at what the book we snapshot could plausibly support. Where no book was captured, reported volume is shown and marked with a * (not liquidity-checked).'
		},
		perpNormalizedVolume: {
			label: 'USD perp n. vol',
			description:
				'24h USD perpetual volume capped at what the book we snapshot could plausibly support. Where no book was captured, reported volume is shown and marked with a * (not liquidity-checked).'
		},
		sparkline: {
			label: 'Volume trend',
			description:
				'Up to 14 recent daily volume observations for the selected market scope. On a brand row the daily series sums the parent and each own-book regional entity.'
		},
		reservesUsd: {
			label: 'Reserves',
			description:
				'USD value of assets in tracked exchange wallets. This is an asset total, not proof of liabilities or solvency.'
		},
		cleanRatio: {
			label: 'Clean Ratio',
			description:
				'Clean reserves divided by total reserves. Clean reserves exclude assets issued by the exchange itself.'
		},
		inflows24hUsd: {
			label: '24h Inflows',
			description: 'Net USD inflows to tracked exchange reserve wallets over the last 24 hours.'
		},
		inflows7dUsd: {
			label: '7d Inflows',
			description: 'Net USD inflows to tracked exchange reserve wallets over the last seven days.'
		},
		inflows1mUsd: {
			label: '1m Inflows',
			description: 'Net USD inflows to tracked exchange reserve wallets over the last month.'
		},
		ownTokenFraction: {
			label: 'Own Token',
			description: 'Share of tracked reserves held in assets issued by the exchange itself.'
		},
		auditor: {
			label: 'Auditor',
			description: 'Auditor or attestation provider recorded for the venue’s reserve disclosure.'
		},
		freshness: {
			label: 'Volume as of',
			description: 'Date of the volume observation used for this venue and market scope.'
		},
		warnings: {
			label: 'Warnings',
			description:
				'Number of current editorial or data-quality cautions recorded for the venue. Open the value to read them.'
		},
		reservesSource: {
			label: 'Source',
			description: 'Source page used to verify the venue’s reserve data.'
		},
		spotFee: {
			label: 'Spot fees',
			description: 'Regular-tier spot maker and taker fees, before VIP or fee-token discounts.'
		},
		linearPerpFee: {
			label: 'USD Perps fees',
			description:
				'Regular-tier USD perp maker and taker fees, before VIP or fee-token discounts. USD perps are margined and settled in a quote asset such as USDT or USDC.'
		},
		inversePerpFee: {
			label: 'COIN Perps fees',
			description:
				'Regular-tier COIN perp maker and taker fees, before VIP or fee-token discounts. COIN perps are margined and settled in the underlying coin, so collateral and PnL are denominated in that coin.'
		},
		feeToken: {
			label: 'Fee Token',
			description: 'Venue token that can reduce trading fees, with the recorded discount when available.'
		},
		fiatCurrencies: {
			label: 'Fiat currencies',
			description: 'Fiat currencies documented as supported by the venue’s funding rails.'
		},
		fiatFees: {
			label: 'Fiat fees',
			description:
				'Documented on-ramp and off-ramp fee routes. Open the value for methods, fees, minimums, processing times, and sources.'
		},
		fiatOnramp: {
			label: 'Fiat on-ramp',
			description: 'Whether the venue has a documented route for moving fiat onto the platform.'
		},
		rampCost: {
			label: '$1k on-ramp cost',
			description:
				'Estimated all-in USD cost of depositing the EUR equivalent of $1,000 by SEPA, buying BTC, and withdrawing it. Includes fiat, taker, slippage, and transfer fees.'
		},
		headquarters: {
			label: 'HQ',
			description: 'Recorded headquarters of the legal or operating entity represented by this row.'
		},
		euStatus: {
			label: 'EU availability',
			description: 'Current usability for EU customers. This is separate from holding a MiCA authorization.'
		},
		mica: {
			label: 'MiCA',
			description:
				'Recorded MiCA Crypto-Asset Service Provider authorization. Authorization does not by itself imply current EU availability.'
		},
		kyc: {
			label: 'KYC',
			description: 'Identity documents and verification steps required to use the exchange.'
		},
		licenseCount: {
			label: 'All licenses',
			description: 'Count of recorded regulatory licenses across all jurisdictions, not only MiCA.'
		},
		founded: {
			label: 'Founded',
			description: 'Year the exchange or represented venue entity was founded.'
		}
	},
	markets: {
		venue: {
			label: 'Venue',
			description: 'Exchange or trading venue that lists this market.'
		},
		token: {
			label: 'Token',
			description: 'Base asset being traded in the market.'
		},
		pair: {
			label: 'Pair',
			description: 'Venue market symbol. Open the value to visit the market on the venue.'
		},
		price: {
			label: 'Price',
			description: 'Latest recorded market price, denominated in the quote asset shown beside the value.'
		},
		priceChange24h: {
			label: 'Price Δ',
			description: 'Percentage change in price over the latest 24-hour observation.'
		},
		volume24h: {
			label: 'Volume',
			description: 'USD volume for this market over the latest 24h, counted one-sided (each trade once).'
		},
		volumeChange24h: {
			label: 'Volume Δ',
			description: 'Percentage change in 24-hour volume versus the preceding 24-hour observation.'
		},
		normalizedVolume: {
			label: 'Norm Volume',
			description:
				'Reported 24h volume (one-sided) capped at what the order book we snapshot could support, so never above reported. A * marks a market with no captured book, shown unchecked.'
		},
		activeLiquidity: {
			label: 'Active liquidity',
			description:
				"Combined USD bid and ask depth from our own order-book snapshot inside this market's own volatility band rather than a fixed ±2%: the band is its typical daily range (floor 2%, ceiling 25%), so the figure covers the depth reachable on a day like today. Observed depth only, never extrapolated past what the snapshot captured. Hover for the band and how much of the market's visible book it spans."
		},
		depth2Usd: {
			label: 'Depth ±2%',
			description:
				'Combined USD bid and ask depth within a fixed 2% of the mid price, from our own order-book snapshot, never venue-reported.'
		},
		spreadFraction: {
			label: 'Spread',
			description: 'Difference between the best ask and best bid, expressed as a percentage of the mid price.'
		},
		markPrice: {
			label: 'Mark price',
			description: 'Venue mark price used to value open positions and calculate unrealized profit and loss.'
		},
		indexPrice: {
			label: 'Index price',
			description: 'Reference asset price used by the venue to calculate the derivative contract’s mark price.'
		},
		basis: {
			label: 'Basis',
			description:
				'Percentage premium or discount of the mark price to the index price, calculated as mark price divided by index price minus one.'
		},
		openInterestUsd: {
			label: 'Open Interest',
			description: 'USD value of one side of open positions in this market at the latest snapshot.'
		},
		openInterestChange24h: {
			label: 'OI Δ',
			description: 'Percentage change in this market’s open interest versus 24 hours earlier.'
		},
		fundingRate8h: {
			label: 'Funding 8h',
			description:
				'Periodic payment rate between long and short positions, normalized to an eight-hour period. Open a value to see the venue’s raw funding period.'
		},
		nextFundingAt: {
			label: 'Next funding',
			description: 'Next scheduled funding payment date for this market, in UTC.'
		},
		maxLeverage: {
			label: 'Max Leverage',
			description: 'Maximum leverage recorded for this market.'
		},
		volumeFreshness: {
			label: 'Volume as of',
			description: 'Date of the latest volume observation used for this market.'
		},
		makerFee: {
			label: 'Maker Fee',
			description: 'Fee charged on orders that add liquidity to this market, before VIP or fee-token discounts.'
		},
		takerFee: {
			label: 'Taker Fee',
			description: 'Fee charged on orders that remove liquidity from this market, before VIP or fee-token discounts.'
		},
		listedAt: {
			label: 'Listed',
			description: 'Venue-reported date when this market was listed, when available.'
		}
	}
} as const satisfies {
	segments: Record<string, ExchangeDefinition>
	summary: Record<string, ExchangeDefinition>
	directory: Record<string, ExchangeDefinition>
	markets: Record<string, ExchangeDefinition>
}

/**
 * A metric label qualified with the segment it is measured on, for surfaces that mix
 * segments in one table (the merged directory view, the profile's per-token table).
 * Execution is USD perps only, so those columns say so where a spot row sits beside
 * them; exact-segment tables keep the short label.
 */
export const usdPerpLabel = (label: string) => `USD perp ${label.toLowerCase()}`
