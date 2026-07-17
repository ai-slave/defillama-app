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
			label: 'Linear Perps',
			description: 'Perpetual contracts margined and settled in a quote asset such as USDT or USDC.'
		},
		inversePerps: {
			label: 'Inverse Perps',
			description:
				'Perpetual contracts margined and settled in the underlying coin (collateral and PnL denominated in that coin).'
		}
	},
	summary: {
		totalVolume24h: {
			label: 'Total Trading Volume (24h)',
			description:
				'Combined USD spot and perpetual volume across tracked venues over the latest 24-hour observation. Shared order books are counted once in this total.'
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
			description: 'USD spot-market volume over the latest 24-hour observation.'
		},
		linearPerp: {
			label: 'Linear Perps',
			description:
				'USD volume in perpetual contracts margined and settled in a quote asset such as USDT or USDC, over the latest 24-hour observation.'
		},
		inversePerp: {
			label: 'Inverse Perps',
			description:
				'USD volume in perpetual contracts margined and settled in the underlying coin (collateral and PnL denominated in that coin), over the latest 24-hour observation.'
		},
		spotVolume24h: {
			label: 'Spot volume 24h',
			description: 'Total USD spot trading volume across tracked venues.'
		},
		linearPerpVolume24h: {
			label: 'Linear perp volume 24h',
			description:
				'Total USD linear perpetual trading volume across tracked venues. Linear perps are perpetual contracts margined and settled in a quote asset such as USDT or USDC.'
		},
		inversePerpVolume24h: {
			label: 'Inverse perp volume 24h',
			description:
				'Total USD inverse perpetual trading volume across tracked venues. Inverse perps are perpetual contracts margined and settled in the underlying coin (collateral and PnL denominated in that coin).'
		},
		linearPerpOpenInterest: {
			label: 'Linear perp open interest',
			description: 'Total USD value of outstanding positions across tracked linear perpetual markets.'
		},
		inversePerpOpenInterest: {
			label: 'Inverse perp open interest',
			description: 'Total USD value of outstanding positions across tracked inverse perpetual markets.'
		},
		reserves: {
			label: 'Reserves',
			description:
				'Sum of assets held in tracked exchange reserve wallets. This measures assets, not liabilities or solvency.'
		},
		venues: {
			label: 'Venues',
			description:
				'Tracked venues have market activity data. Listed venues include both tracked and metadata-only entries.'
		}
	},
	directory: {
		name: {
			label: 'Exchange',
			description:
				'Venue identity and related links. “Metadata only” means exchange information exists but market activity is not tracked.'
		},
		kind: {
			label: 'Type',
			description: 'CEX means centralized exchange; DEX means decentralized exchange.'
		},
		volume24h: {
			label: '24h Volume',
			description:
				'USD trading volume over the latest 24-hour observation for the selected market scope. A dotted value carries a double-count note: either the figure counts both sides of each trade, or the order book is shared with (and also counted under) another venue. On a brand row it is the parent plus each regional entity that runs its own separate order book.'
		},
		volumeChange24h: {
			label: 'Volume Δ',
			description: 'Percentage change in 24-hour volume versus the preceding 24-hour observation.'
		},
		openInterestUsd: {
			label: 'Open Interest',
			description:
				'USD value of outstanding perpetual positions at the latest available snapshot. A dotted value carries a double-count note (both-sides convention or a shared order book). Brand rows sum only own-book children.'
		},
		volumeToOi: {
			label: 'Vol / OI',
			description:
				'24-hour volume divided by open interest — how many times the outstanding position base turned over in a day. Very high values can indicate wash-like churn or a thin real position base; interpret alongside the double-count note. Perpetual scopes only.'
		},
		volumeToDepth: {
			label: 'Vol / Depth',
			description:
				'24-hour volume divided by combined ±2% order-book depth — daily turnover relative to resting liquidity. Very high values mean volume dwarfs the visible book. Requires order-book depth for the venue.'
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
				'Reported 24-hour volume constrained by the amount of visible order-book liquidity that could plausibly support it. Always less than or equal to reported volume. On a brand row it sums the parent and each own-book regional entity.'
		},
		depth2Usd: {
			label: 'Depth ±2%',
			description:
				'Combined USD bid and ask depth available within 2% of the order-book mid price. A dotted value carries a double-count note when the book is shared with another venue.'
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
			label: 'Linear Perps fees',
			description:
				'Regular-tier linear perpetual maker and taker fees, before VIP or fee-token discounts. Linear perps are perpetual contracts margined and settled in a quote asset such as USDT or USDC.'
		},
		inversePerpFee: {
			label: 'Inverse Perps fees',
			description:
				'Regular-tier inverse perpetual maker and taker fees, before VIP or fee-token discounts. Inverse perps are perpetual contracts margined and settled in the underlying coin (collateral and PnL denominated in that coin).'
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
		availableRegions: {
			label: 'Available regions',
			description: 'Regions explicitly recorded as supported. Product availability may still differ by jurisdiction.'
		},
		restrictedRegions: {
			label: 'Restricted regions',
			description: 'Regions explicitly recorded as unavailable or restricted. Restrictions may vary by product.'
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
			description: 'USD trading volume for this market over the latest 24-hour observation.'
		},
		volumeChange24h: {
			label: 'Volume Δ',
			description: 'Percentage change in 24-hour volume versus the preceding 24-hour observation.'
		},
		normalizedVolume: {
			label: 'Norm Volume',
			description:
				'Reported 24-hour volume constrained by the amount of visible order-book liquidity that could plausibly support it. Always less than or equal to reported volume.'
		},
		depth2Usd: {
			label: 'Depth ±2%',
			description: 'Combined USD bid and ask depth available within 2% of the order-book mid price.'
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
			description: 'USD value of outstanding positions in this market at the latest available snapshot.'
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
