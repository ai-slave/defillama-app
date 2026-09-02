export type UtrCriterionDrawerCopy = {
	navigationLabel: string
	heading: string
	definition: string
	showMarketMakerMaturityException?: boolean
}

const MARKET_MAKER_MATURITY_KEYS = new Set([
	'disclosure:mm_contract_transparency',
	'performance:mm_volume_pct',
	'performance:mm_depth_pct',
	'performance:mm_uptime_sla'
])

export const MARKET_MAKER_MATURITY_EXCEPTION = {
	performanceNote:
		'Note, where Forgd does not have market maker trade activity data for a project that meets the maturity criteria defined below, the project receives an AAA rating for this metric. At sufficient scale, a project may have enough organic liquidity and market participation that contracted market makers are no longer necessary.',
	disclosureNote:
		'Note, where Forgd does not have insight on market maker engagements for a project that meets the maturity criteria defined below, the project receives an AAA rating for this metric. At sufficient scale, a project may have enough organic liquidity and market participation that contracted market makers are no longer necessary.',
	intro: 'A project qualifies for the exception when all three of the following conditions are met:',
	criteria: [
		'Spot + perpetual market depth / market capitalization ≥ 1%',
		'Listed on ≥ 3 Tier 1 centralized exchanges',
		'Fully diluted valuation (FDV) ≥ $2.5 billion'
	],
	outro:
		'These criteria are designed to identify projects with sufficiently robust markets across liquidity, exchange coverage, and valuation.'
} as const

const CRITERION_DRAWER_COPY: Record<string, Omit<UtrCriterionDrawerCopy, 'showMarketMakerMaturityException'>> = {
	'disclosure:team_identities': {
		navigationLabel: 'Insider Identities Disclosed',
		heading: 'Insider Identities Disclosed',
		definition:
			'Core team members (founders, key devs, C-suite) are publicly identified by real name and verifiable professional history.'
	},
	'disclosure:roles_org_chart': {
		navigationLabel: 'Role descriptions & org structure',
		heading: 'Role descriptions & org structure',
		definition:
			'The organizational structure of the blockchain project has been disclosed with clear linkage between entities and reporting lines for all core contributors.'
	},
	'disclosure:insider_wallets': {
		navigationLabel: 'Anonymized insider wallet disclosures',
		heading: 'Anonymized insider wallet disclosures',
		definition:
			'The project discloses insider/team wallet addresses (even if pseudonymous) so on-chain flows can be independently tracked.'
	},
	'disclosure:treasury_reports': {
		navigationLabel: 'Treasury reporting',
		heading: 'Treasury reporting',
		definition:
			'The project publishes regular treasury reports disclosing asset composition, total value, stablecoin/native token split, and significant changes.'
	},
	'disclosure:cash_flows': {
		navigationLabel: 'Cash flow disclosures',
		heading: 'Cash flow disclosures',
		definition:
			'The project discloses revenue sources, operating expenses, and net cash position or burn rate on a regular basis.'
	},
	'disclosure:legal_entities': {
		navigationLabel: 'Legal entities, licenses & patents',
		heading: 'Legal entities, licenses & patents',
		definition:
			'The project discloses its legal entity structure, jurisdiction of incorporation, any relevant regulatory licenses, and IP/patents held.'
	},
	'disclosure:mm_contract_transparency': {
		navigationLabel: 'Market maker engagement transparency',
		heading: 'Market maker engagement transparency',
		definition:
			'The project discloses that it has engaged market makers, the general structure of those engagements (loan-based, retainer, etc.), and the venues covered.'
	},
	'disclosure:smart_contract_audits': {
		navigationLabel: 'Auditor disclosures (smart contract)',
		heading: 'Auditor disclosures (smart contract)',
		definition:
			'The project discloses all smart contract auditors engaged, the scope of each audit, and the published audit reports, including finding severity and remediation status.'
	},
	'disclosure:exchange_agreements': {
		navigationLabel: 'Exchange engagement disclosures',
		heading: 'Exchange engagement disclosures',
		definition:
			'The project discloses which centralized and decentralized exchanges it is listed on, and whether any listing fees, token allocations, or incentive arrangements were part of the listing agreement.'
	},
	'disclosure:vesting_published': {
		navigationLabel: 'Vesting schedules fully published',
		heading: 'Vesting schedules fully published',
		definition:
			'All insider, team, advisor, and investor vesting schedules are fully published with cliff dates, linear/cliff structures, and total allocation per party.'
	},
	'disclosure:distribution_published': {
		navigationLabel: 'Distribution schedules fully published',
		heading: 'Distribution schedules fully published',
		definition:
			'The complete token distribution is published - all allocation buckets (ecosystem, treasury, team, investors, public) with percentages and unlock logic.'
	},
	'disclosure:external_allocations': {
		navigationLabel: 'External allocation disclosures',
		heading: 'External allocation disclosures',
		definition:
			'Allocations to external parties (VCs, angels, strategic partners, exchanges, KOLs) are disclosed with amounts or percentage ranges.'
	},
	'disclosure:multisigs': {
		navigationLabel: 'Multisig disclosures',
		heading: 'Multisig disclosures',
		definition:
			'All multi-signature wallets controlling material funds (treasury, ecosystem, team) are publicly disclosed with signer identities or roles, threshold structure, and on-chain address.'
	},
	'performance:volume_mcap': {
		navigationLabel: 'Trade Volume',
		heading: 'Total Volume (as % of Market Cap)',
		definition:
			'Aggregate 24h trading volume across all venues as a percentage of fully diluted market cap. Measures overall market activity from non-blacklisted exchanges relative to token size.'
	},
	'performance:depth_mcap': {
		navigationLabel: 'Depth +/- 2%',
		heading: 'Depth +/- 2%',
		definition:
			'Aggregate order book depth (sum of bids + asks within 2% of mid) across all venues, as a percentage of market cap. Measures how much capital supports the current price from non-blacklisted exchanges.'
	},
	'performance:vwas': {
		navigationLabel: 'Bid / Ask Spread',
		heading: 'Bid / Ask Spread',
		definition:
			'Volume-weighted average bid-ask spread across all active trading pairs, in basis points. Measures market efficiency and cost of execution on non-blacklisted exchanges.'
	},
	'performance:candle_win_rate_30d': {
		navigationLabel: 'Price Performance',
		heading: 'Price Performance',
		definition:
			"Measures sustained buying pressure and market sentiment through daily candle direction over a trailing 30-day window. A green candle is any day where closing price > opening price. Intentionally isolated from BTC, ETH, or any altcoin index. The project's score reflects only its own market behavior, not macro conditions outside its control."
	},
	'performance:oi_mcap': {
		navigationLabel: 'Open Interest',
		heading: 'Open Interest',
		definition:
			'Total open interest across all perpetual and futures contracts from non-blacklisted exchanges as a percentage of market cap. Measures speculative engagement and derivatives market development.'
	},
	'performance:funding_rate': {
		navigationLabel: 'Funding Rate',
		heading: 'Funding Rate',
		definition:
			'Time-weighted average perpetual funding rate over the trailing 7-day window, in basis points per 8 hours from non-blacklisted exchanges. Positive funding rates indicate longs are paying shorts, reflecting eagerness to hold long exposure. Higher positive funding scores better; negative funding scores lower at equivalent absolute magnitude.'
	},
	'performance:mm_volume_pct': {
		navigationLabel: 'MM Volume (as a % of total)',
		heading: 'MM Volume (as a % of total)',
		definition:
			'Market maker-attributed fill volume as a percentage of total market fill volume across supported venues. Forgd collects market maker trade activity via API for projects utilizing its free-to-use Market Maker Monitoring tools.'
	},
	'performance:mm_depth_pct': {
		navigationLabel: 'MM Depth (as a % of total)',
		heading: 'MM Depth (as a % of total)',
		definition:
			'Market maker-attributed order book depth as a percentage of total market depth across supported venues. Forgd collects market maker trade activity via API for projects utilizing its free-to-use Market Maker Monitoring tools.'
	},
	'performance:mm_uptime_sla': {
		navigationLabel: 'Uptime / KPI Adherence',
		heading: 'Uptime / KPI Adherence',
		definition:
			"Measures the percentage of time a project's market maker(s) meet agreed liquidity KPIs, including applicable spread, depth, and uptime requirements, during the evaluation period. Performance is measured using trade activity collected via API from market makers participating in Forgd's free-to-use Market Maker Monitoring tools."
	},
	'performance:tier1_coverage': {
		navigationLabel: 'Top-Tier Exchange Coverage',
		heading: 'Top-Tier Exchange Coverage',
		definition:
			'Is the token listed and actively traded on at least one Tier-1 centralized exchange (Binance, Coinbase, OKX, Upbit)? How many Tier-1 venues are covered?'
	},
	'performance:cex_vs_dex_volume': {
		navigationLabel: 'Total Volume (CEX vs DEX)',
		heading: 'Total Volume (CEX vs DEX)',
		definition:
			'Breakdown of total 24h trading volume between centralized and decentralized venues that are not blacklisted. Measures venue diversification and organic DEX demand signal.'
	},
	'performance:cex_vs_dex_depth': {
		navigationLabel: 'Total Depth (CEX vs DEX)',
		heading: 'Total Depth (CEX vs DEX)',
		definition:
			'Order book and pool depth split between non-blacklisted CEX and DEX venues. Measures how resilient liquidity is. DEX liquidity is sticky; CEX liquidity can vanish faster.'
	},
	'performance:spot_vs_perps_volume': {
		navigationLabel: 'Total Volume (Spot vs Perps)',
		heading: 'Total Volume (Spot vs Perps)',
		definition:
			'Breakdown of total volume between spot and perpetual/futures markets across non-blacklisted exchanges. Measures market maturity and the balance between hedging/speculative demand.'
	},
	'performance:spot_vs_perps_depth': {
		navigationLabel: 'Total Depth (Spot vs Perps)',
		heading: 'Total Depth (Spot vs Perps)',
		definition:
			'Depth split between spot order books and perp/futures books of non-blacklisted exchanges. Measures whether price discovery is anchored in real asset transfers or primarily derivatives.'
	},
	'performance:vesting_actual_vs_disclosed': {
		navigationLabel: 'Actual Token Vesting vs Disclosures',
		heading: 'Actual Token Vesting vs Disclosures',
		definition:
			'Observed on-chain token unlock events match the published vesting schedule. Measures disclosure accuracy and insider compliance with committed timelines.'
	},
	'performance:fdv': {
		navigationLabel: 'FDV',
		heading: 'FDV',
		definition:
			'Current fully diluted valuation (max supply × current price) in USD. Higher FDV indicates greater assigned value to the project. Scored on absolute size. No benchmarking, no self-referencing. Larger, more established projects score higher.'
	},
	'performance:mcap_vs_fdv': {
		navigationLabel: 'Market Cap vs FDV',
		heading: 'Market Cap vs FDV',
		definition:
			"Circulating market cap as a percentage of fully diluted valuation. Measures supply overhang - how much of the token's value is already circulating vs. still locked and awaiting release."
	},
	'performance:annualized_inflation': {
		navigationLabel: 'Annualized Rate of Inflation',
		heading: 'Annualized Rate of Inflation',
		definition:
			'New token supply entering circulation over the next 12 months as a percentage of current circulating supply. Measures dilution pressure on existing holders.'
	},
	'performance:buyback_burn': {
		navigationLabel: 'Buyback & Burn Events',
		heading: 'Buyback & Burn Events',
		definition:
			'Measures buyback events and burn events (independently) relative to the amount of total supply that has been released.'
	}
}

export function getCriterionDrawerCopy(
	axis: 'disclosure' | 'performance',
	key: string,
	fallbackLabel: string,
	fallbackDefinition: string | null | undefined
): UtrCriterionDrawerCopy {
	const lookupKey = `${axis}:${key}`
	const copy = CRITERION_DRAWER_COPY[lookupKey]
	return {
		navigationLabel: copy?.navigationLabel ?? fallbackLabel,
		heading: copy?.heading ?? fallbackLabel,
		definition: copy?.definition ?? fallbackDefinition ?? '',
		showMarketMakerMaturityException: MARKET_MAKER_MATURITY_KEYS.has(lookupKey)
	}
}
