export const preIpoDefinitions = {
	company: {
		estimatedValuation: {
			label: 'Estimated Valuation',
			description:
				'Latest tracked valuation estimate. When no valuation series is available, this uses the latest funding-round valuation.'
		},
		valuationChange1Y: {
			label: '1y Change',
			description: 'Percentage change between the latest monthly valuation estimate and the estimate 12 months earlier.'
		},
		latestRaise: {
			label: 'Latest Raise',
			description: 'Amount raised in the latest tracked funding round.'
		},
		latestFundingValuation: {
			label: 'Latest Funding Valuation',
			description: 'Company valuation reported for the latest tracked funding round.'
		},
		totalRaised: {
			label: 'Total Raised',
			description: 'Sum of the amounts raised across all tracked funding rounds.'
		},
		premiumVsFunding: {
			label: 'Premium vs Funding',
			description:
				'Percentage difference between the latest estimated valuation and the latest funding-round valuation.'
		},
		latestFundingDate: {
			label: 'Latest Funding Date',
			description: 'Date of the latest tracked funding round.'
		},
		valuationAsOf: {
			label: 'Valuation As Of',
			description: 'Most recent valuation observation date from any tracked source.'
		}
	},
	fundingRound: {
		amountRaised: {
			label: 'Amount Raised',
			description: 'Capital raised in this funding round.'
		},
		valuation: {
			label: 'Round Valuation',
			description: 'Company valuation reported for this funding round, not the amount raised.'
		}
	},
	perpetualMarket: {
		type: {
			label: 'Type',
			description: 'CEX means centralized exchange; DEX means decentralized exchange.'
		},
		contract: {
			label: 'Contract',
			description: 'Venue contract identifier. Select the contract to open its trading market.'
		},
		price: {
			label: 'Price',
			description: 'Latest contract price reported by the trading venue.'
		},
		volume: {
			label: '24h Volume',
			description: 'USD notional traded during the venue’s latest 24-hour window.'
		},
		openInterest: {
			label: 'Open Interest',
			description: 'USD value of outstanding positions at the latest market snapshot.'
		},
		annualizedFunding: {
			label: 'Annualized Funding',
			description: 'Latest contract funding rate annualized using the venue’s funding interval.'
		},
		estimatedValuation: {
			label: 'Estimated Valuation',
			description: 'Company valuation implied by the contract price and the estimated company share count.'
		}
	},
	tokenIssuer: {
		issuer: {
			label: 'Issuer',
			description: 'Platform offering the pre-IPO exposure. Select the issuer to open the product.'
		},
		backing: {
			label: 'Backing',
			description: 'Legal or economic structure used by the product to provide exposure to the private company.'
		},
		price: {
			label: 'Price',
			description: 'Latest product price reported by the issuer or its market.'
		},
		marketCap: {
			label: 'Market Cap',
			description: 'Reported market capitalization of the tokenized product, not the underlying company.'
		},
		estimatedValuation: {
			label: 'Estimated Valuation',
			description: 'Underlying company valuation implied by the product price and issuer reference data.'
		}
	}
} as const
