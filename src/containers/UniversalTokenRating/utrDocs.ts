import { formatNumber, formatPercent } from '~/utils/numberFormat'
import type {
	UtrGradeScaleEntry,
	UtrGradingAxisConfig,
	UtrScoringCategoryConfig,
	UtrScoringConfig,
	UtrScoringCriterionConfig
} from './types'

export type UtrDocListItem = { text: string; children?: Array<string>; strong?: boolean }

export type UtrDocBlock =
	| { type: 'heading'; text: string }
	| { type: 'paragraph'; text: string; lead?: string; strong?: boolean }
	| { type: 'formula'; text: string }
	| { type: 'bullets'; items: Array<UtrDocListItem> }
	| { type: 'numbered'; items: Array<UtrDocListItem> }
	| { type: 'table'; headers: Array<string>; rows: Array<Array<string>> }

export type UtrDocChapter = {
	id: string
	label: string
	blocks: Array<UtrDocBlock>
}

export const UTR_DOCS_TITLE = 'Universal Token Rating Documentation'

const UTR_FIGMA_DOC_CHAPTERS: Array<UtrDocChapter> = [
	{
		id: 'preface',
		label: '1. Preface',
		blocks: [
			{ type: 'heading', text: '1,294 Total Tokens Scored' },
			{
				type: 'paragraph',
				text: "Forgd's Universal Token Ratings (“UTR”) provide a structured, continuously updated framework for evaluating the disclosure quality and live market performance of 1,200+ token projects across the digital asset ecosystem. The standard is designed for founders, investors, advisors, and researchers who require a consistent and transparent basis for assessing a project's operational health, not just at launch, but throughout its lifecycle."
			},
			{ type: 'paragraph', text: 'The TVS combines two independent dimensions into a single composite score:' },
			{
				type: 'numbered',
				items: [
					{
						text: 'The Disclosure Axis (D) evaluates the completeness, quality, and freshness of information disclosed by the project itself, including team transparency, tokenomics, legal structure, and service provider disclosures.'
					},
					{
						text: 'The Performance Axis (P) evaluates whether observed market structure and operational behavior validate those disclosures over time, drawing on live liquidity, volume, spread, exchange coverage, and on-chain data.'
					}
				]
			},
			{
				type: 'paragraph',
				text: 'The final TVS score is the product of both axes: TVS(t) = D(t) × P(t), producing a composite score on a 0–100 scale. The multiplicative structure is intentional — strong disclosures cannot compensate for poor execution, and strong market performance cannot compensate for weak transparency.'
			},
			{
				type: 'paragraph',
				text: "Unlike existing transparency initiatives, which primarily function as filing systems measuring whether a project disclosed information, Forgd's approach continuously validates whether the underlying market data and operational behavior actually support those disclosures in practice. Both axes update dynamically as new information enters the system."
			},
			{
				type: 'paragraph',
				text: 'Forgd maintains data partnerships with DeFiLlama, Tokenomist, and other industry providers to source and verify the underlying metrics powering the Performance Axis. Disclosure data is submitted directly by projects or sourced from existing third-party transparency submissions.'
			}
		]
	},
	{
		id: 'overview',
		label: '2. Overview',
		blocks: [
			{
				type: 'paragraph',
				text: 'The Universal Token Ratings are organized around two independent scoring axes — Disclosure and Performance — each graded on a standardized 0–10 scale. The two axis scores are then multiplied together to produce the final 0–100 composite UTR score:'
			},
			{ type: 'formula', text: 'TVS(t) = D(t) × P(t)' },
			{
				type: 'paragraph',
				text: "Both axes dynamically update as new information enters the system. On the Disclosure side, static reporting must remain current — any material amendment not reflected within 60 days triggers an automatic 50% reduction to that category's Disclosure contribution until remediated. On the Performance side, live market maker reporting, exchange-level liquidity data, spreads, depth, volume, and on-chain events continuously roll forward and recalculate underlying ratios."
			},
			{
				type: 'paragraph',
				text: 'At TGE (Token Generation Event), the Disclosure axis is fully measurable because the underlying disclosures either exist or they do not. The Performance axis, however, has no historical operating window yet — projects initially carry a provisional TVS score with Performance still accruing. Over time, the TVS transitions from a disclosure-heavy onboarding framework into a fully validated, continuously updated operational score.'
			},
			{ type: 'heading', text: 'Calculation Methodology' },
			{
				type: 'paragraph',
				text: 'Everything within the Visibility Standard is graded on a standardized 0–10 scale and weighted upwards through categories into two independent scoring axes: Disclosure (D) and Performance (P). The two scores are then multiplied together to produce the final 0–100 Visibility Standard score: Visibility Standard(t) = D(t) × P(t). The system is intentionally designed to evolve alongside a project rather than act as a one-time filing or disclosure event.'
			},
			{
				type: 'paragraph',
				text: 'At T (TGE), Disclosure is fully measurable immediately because the underlying disclosures either exist or they do not. Performance, however, has no historical operating window yet, meaning projects initially launch with a provisional Visibility Standard where Performance is still accruing. Conceptually, this follows a similar structure to the B-1 / B-2 distinction from Blockworks, except both dimensions ultimately converge into a single continuously updating score rather than separate reporting frameworks.'
			},
			{
				type: 'paragraph',
				text: 'At launch, Disclosure is simply the weighted average of all static disclosure categories. Using Core Contributors as an example: if insider identities are fully disclosed (10/10), but role descriptions are only partially completed (5/10), the category score becomes: (10 + 5) / 2 = 7.5. That score is then rolled together with other disclosure categories such as Service Providers, Financials, Licenses, Patents and Token Disclosures to derive the overall Disclosure score (e.g.): D(T) = 8.5.'
			},
			{
				type: 'paragraph',
				text: 'Performance scoring functions differently because it measures delivery relative to operational commitments and observed market behavior over time. For each live criterion i on day d:'
			},
			{ type: 'formula', text: 'rᵢ(d) = min(1, delivered ÷ committed)' },
			{ type: 'paragraph', text: 'Where:' },
			{
				type: 'bullets',
				items: [
					{ text: 'rᵢ(d) = fulfillment ratio for criterion i on day d' },
					{ text: 'delivered = observed live performance' },
					{ text: 'committed = disclosed or contracted operational target' }
				]
			},
			{
				type: 'paragraph',
				text: 'The cap at 1.0 is intentional. Overperformance in one area should not fully offset persistent underperformance elsewhere. A market maker materially exceeding depth requirements for several days, for example, should not erase prolonged wide spreads or breaches in uptime. Each performance category is calculated as the trailing-window average of its underlying ratios and scaled back onto the same standardized 0–10 framework:'
			},
			{ type: 'formula', text: 'Pcat(t) = 10 × ⟨rᵢ(d)⟩ over trailing window' },
			{ type: 'paragraph', text: 'Where:' },
			{
				type: 'bullets',
				items: [
					{ text: 'Pcat(t) = normalized category-level Performance score at time t' },
					{ text: '⟨rᵢ(d)⟩ = average fulfillment ratio across the selected trailing evaluation window' }
				]
			},
			{
				type: 'paragraph',
				text: 'The overall Performance axis is then the weighted average across all live performance categories:'
			},
			{ type: 'formula', text: 'P(t) = weighted average of Pcat(t)' },
			{
				type: 'paragraph',
				text: 'At T, the trailing window is effectively empty, so Performance remains in an “accruing” state until enough operating history exists to produce statistically meaningful outputs. Over time, the Visibility Standard transitions from a disclosure-heavy onboarding framework into a continuously validated operational score. Importantly, both axes dynamically update as new information enters the system.'
			},
			{
				type: 'paragraph',
				text: 'On the Performance side, new market maker reporting, exchange-level (and potentially trading pair-level) liquidity data, spreads, depth, volume and other live metrics continuously roll the trailing windows forward and recalculate the underlying ratios. Verified on-chain events also directly impact the score without requiring projects to manually refile disclosures. A new exchange listing changes the liquidity footprint baseline, a token unlock changes circulating float dynamics, and changes to market maker mandates update the underlying operational commitments being measured against.'
			},
			{
				type: 'paragraph',
				text: 'On the Disclosure side, static reporting must remain current. Any material amendment not reflected within 60 days results in an automatic 50% reduction to that category’s Disclosure contribution until remediated. A simplified lifecycle example is below:'
			},
			{
				type: 'numbered',
				items: [
					{ text: 'T — D = 8.5, Visibility Standard displays as “Disclosure-complete, Performance pending”.' },
					{
						text: 'T+30 — trailing operating history matures and live ratios average 0.94, resulting in:',
						children: ['P = 9.4', 'Score = 8.5 × 9.4 ≈ 80']
					},
					{
						text: 'T+45 — a 4.2% token unlock occurs on-chain and liquidity conditions temporarily deteriorate as spreads widen and market maker uptime weakens. Trailing ratios fall to 0.86:',
						children: ['P = 8.6', 'Score = 8.5 × 8.6 ≈ 73']
					}
				]
			},
			{
				type: 'paragraph',
				text: 'Importantly, no disclosures changed. The score moved because the live market structure deteriorated.'
			},
			{
				type: 'numbered',
				items: [
					{
						text: 'T+60 — liquidity conditions stabilize and trailing ratios recover to 0.92:',
						children: ['P = 9.2', 'Score = 8.5 × 9.2 ≈ 78']
					},
					{
						text: 'T+72 — the project changes market makers but fails to update its service provider disclosures within the remediation window. The stale disclosure penalty reduces the Disclosure axis contribution:',
						children: ['D = 7.9', 'Score = 7.9 × 9.2 ≈ 73']
					}
				]
			},
			{
				type: 'paragraph',
				text: 'At a high level, the Visibility Standard separates scoring into two independent dimensions: Disclosure and Performance. Disclosure primarily measures transparency and reporting quality, while Performance measures whether live market structure, liquidity conditions and operational behavior actually support those disclosures in practice. The categories below represent the current directional framework for how each axis is evaluated.'
			},
			{ type: 'heading', text: 'How to Interpret the TVS Score' },
			{
				type: 'paragraph',
				text: 'A higher TVS score reflects stronger combined performance across both transparency and live market quality. The score is multiplicative by design — a project that performs well on the market but maintains poor disclosures will score proportionally lower than one that excels on both dimensions. The leaderboard displays both the D and P axis scores independently alongside the composite TVS score, allowing users to identify where a project is strongest and where gaps exist.'
			},
			{
				type: 'paragraph',
				text: 'The leaderboard also highlights the best and worst performing categories for each project within each axis, providing a quick diagnostic view without requiring users to expand the full row-level detail.'
			}
		]
	},
	{
		id: 'disclosure-axis',
		label: '3. Disclosure Axis',
		blocks: [
			{
				type: 'paragraph',
				text: 'The Disclosure Axis evaluates the completeness, quality, and freshness of information disclosed by the project itself. It measures what a project has chosen to report — and whether those reports remain current. Disclosure scoring is fully measurable at TGE because the underlying disclosures either exist or they do not. The axis is graded on a standardized 0–10 scale and is the weighted average of four categories, each containing between three and four individual sub-criteria.'
			},
			{
				type: 'paragraph',
				text: "A 60-day staleness rule governs all disclosure categories. If any material amendment is not reflected within 60 days of the change occurring, that category's contribution to the overall Disclosure score is automatically reduced by 50% until the disclosure is updated and remediated. This prevents static filings from inflating scores for projects that stop maintaining their disclosures after the initial submission."
			},
			{ type: 'heading', text: 'Core Components' },
			{
				type: 'paragraph',
				text: 'The Disclosure Axis is organized into four categories. Category weights and sub-criterion weights are listed below.'
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Core Contributors', '18%'],
					['Tokenomics', '34%'],
					['Legal & Finance', '24%'],
					['Service Provider Engagements', '24%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Core Contributors (18%):',
				text: 'Evaluates whether the team behind the project is publicly identifiable and verifiably described.'
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Insider Identities Disclosed', '5%'],
					['Role Descriptions & Org. Structure', '6%'],
					['Anonymized Insider Wallet Disclosures', '7%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Tokenomics (34%):',
				text: "Evaluates the completeness and transparency of the project's token distribution, vesting, and allocation framework."
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Vesting Schedules Fully Published', '7%'],
					['Distribution Schedules Fully Published', '8%'],
					['External Allocation Disclosures', '9%'],
					['Multisig Disclosures', '10%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Legal & Financial (24%):',
				text: 'Evaluates the degree to which the project discloses its legal structure, financial position, and treasury activity.'
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Treasury reporting', '8%'],
					['Cash flow disclosures', '8%'],
					['Legal entities, licenses & patents', '8%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Service Provider Engagements (24%):',
				text: "Evaluates the transparency of the project's key third-party service relationships, including market makers, smart contract auditors, and exchange listing arrangements."
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Market maker engagement transparency', '9%'],
					['Auditor disclosures (smart contract)', '6%'],
					['Exchange engagement disclosures', '9%']
				]
			},
			{ type: 'heading', text: 'Calculation Methodology' },
			{
				type: 'paragraph',
				text: 'Each sub-criterion is scored on a 0–10 scale using a graded rubric. Sub-criterion scores are multiplied by their individual weight to produce an adjusted score. Adjusted scores are summed within each category to produce the category score. The overall Disclosure axis score is the sum of all category scores:'
			},
			{ type: 'formula', text: 'D(t) = ∑ (sub-criterion score × sub-criterion weight) across all categories' },
			{
				type: 'paragraph',
				text: 'The worked example below uses the sample post-TGE project from the prototype, which produces a final Disclosure score of 8.55.'
			},
			{ type: 'paragraph', text: 'Step #1: Score each sub-criterion and multiply by its weight:', strong: true },
			{ type: 'paragraph', text: 'Core Contributors (category weight: 18%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'Insider identities disclosed: 8 × 5% = 0.40' },
					{ text: 'Role descriptions & org structure: 9 × 6% = 0.54' },
					{ text: 'Anonymized insider wallet disclosures: 8.5 × 7% = 0.595' },
					{ text: 'Core Contributors category score: 0.40 + 0.54 + 0.595 = 1.535', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Tokenomics (category weight: 34%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'Vesting schedules fully published: 7 × 7% = 0.49' },
					{ text: 'Distribution schedules fully published: 8 × 8% = 0.64' },
					{ text: 'External allocation disclosures: 6.5 × 9% = 0.585' },
					{ text: 'Multisig disclosures: 9 × 10% = 0.90' },
					{ text: 'Tokenomics category score: 0.49 + 0.64 + 0.585 + 0.90 = 2.615', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Legal & Financial (category weight: 24%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'Treasury reporting: 10 × 8% = 0.80' },
					{ text: 'Cash flow disclosures: 5 × 8% = 0.40' },
					{ text: 'Legal entities, licenses & patents: 10 × 8% = 0.80' },
					{ text: 'Legal & Financial category score: 0.80 + 0.40 + 0.80 = 2.00', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Service Provider Engagements (category weight: 24%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'Market maker engagement transparency: 10 × 9% = 0.90' },
					{ text: 'Auditor disclosures (smart contract): 10 × 6% = 0.60' },
					{ text: 'Exchange engagement disclosures: 10 × 9% = 0.90' },
					{ text: 'Service Provider Engagements category score: 0.90 + 0.60 + 0.90 = 2.40', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Step #2: Sum all category scores to produce D(t).', strong: true },
			{ type: 'formula', text: 'D(t) = 1.535 + 2.615 + 2.00 + 2.40 = 8.55' },
			{
				type: 'paragraph',
				text: "Scores are graded by Forgd's methodology team for qualitative sub-criteria, or calculated directly from on-chain and submitted data for quantitative sub-criteria. Unresolved critical audit findings hard-cap the Auditor Disclosures sub-criterion at a score of 4, regardless of how complete the disclosure itself is."
			},
			{
				type: 'paragraph',
				text: "The 60-day staleness penalty applies at the category level. If a material change occurs — for example, a market maker change not reflected in service provider disclosures — the entire affected category's contribution to D(t) is reduced by 50% until the disclosure is remediated. In the example above, if the Service Provider Engagements category were subject to the staleness penalty, its contribution would fall from 2.40 to 1.20, reducing D(t) from 8.55 to 7.15."
			},
			{ type: 'heading', text: 'How to Interpret' },
			{
				type: 'paragraph',
				text: 'A higher Disclosure axis score reflects a project that maintains complete, current, and verifiable reporting across team, tokenomics, legal, and service provider information. Lower scores indicate material gaps — either in what was disclosed initially or in maintaining those disclosures over time.'
			},
			{
				type: 'paragraph',
				text: 'The category breakdown visible in the expanded row view allows users to pinpoint where disclosure gaps exist. A project may score highly on Core Contributors and Tokenomics but carry a low Legal & Financial score, signaling that treasury and cash flow transparency has not been prioritized. The Disclosure score should be read alongside the Performance score — a high D score with a low P score may indicate that a project discloses well but is not delivering against its stated commitments in the market.'
			},
			{ type: 'heading', text: 'Filtering' },
			{
				type: 'paragraph',
				text: 'Valuation, sector and exchange listing achievement-level filtering can be configured using the controls at the top of the Token Visibility Standard leaderboard. Disclosure scores reflect the most recent available data as of the selected date. All staleness penalties apply dynamically — if a disclosure lapsed during the selected window, the penalty will be reflected in the score for that period.'
			}
		]
	},
	{
		id: 'performance-axis',
		label: '4. Performance Axis',
		blocks: [
			{
				type: 'paragraph',
				text: "The Performance Axis evaluates whether a project's observed market structure and operational behavior validate the disclosures and commitments it has made over time. Unlike the Disclosure Axis, which measures what a project reports, the Performance Axis measures what a project delivers. It draws on live market data — liquidity depth, trading volume, bid-ask spreads, exchange coverage, funding rates, and on-chain tokenomics — to produce a continuously updated score that reflects actual market health rather than stated intentions."
			},
			{
				type: 'paragraph',
				text: 'Performance scoring begins accruing at TGE. At launch, the trailing evaluation window is effectively empty, so the axis carries a provisional status until sufficient operating history exists to produce statistically meaningful outputs. Over time, the Performance score becomes the primary driver of TVS score movement, as Disclosure scores for mature projects tend to stabilize while market conditions continue to fluctuate.'
			},
			{ type: 'heading', text: 'Core Components' },
			{
				type: 'paragraph',
				text: 'The Performance Axis is organized into four categories. Category weights and sub-criterion weights are listed below.'
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Market Makers', '21%'],
					['Liquidity Footprint', '20%'],
					['Tokenomics (P)', '24%'],
					['Total Market', '35%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Total Market (35%):',
				text: "Evaluates overall market activity, liquidity quality, price behavior, and derivatives market conditions relative to the token's market capitalization."
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Total Volume (as % of Market Cap)', '5%'],
					['Total Depth (as % of Market Cap)', '6%'],
					['Total Spreads (VWAS)', '7%'],
					['Price Performance (Candle Win Rate)', '8%'],
					['Open Interest (as % of Market Cap)', '4.5%'],
					['Funding Rate', '4.5%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Market Makers (21%):',
				text: "Evaluates the contribution and adherence of engaged market makers to their contractual mandates, as tracked via Forgd's monitoring infrastructure."
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['MM Volume (as % of total)', '7%'],
					['MM Depth (as % of total)', '7%'],
					['Uptime / KPI Adherence', '7%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Liquidity Footprint (20%):',
				text: "Evaluates how the project's liquidity is distributed across venue types and market segments, including CEX versus DEX and spot versus perpetuals."
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Top-Tier Exchange Coverage', '4%'],
					['Total Volume, CEX vs DEX', '4%'],
					['Total Depth, CEX vs DEX', '4%'],
					['Total Volume, Spot vs Perps', '4%'],
					['Total Depth, Spot vs Perps', '4%']
				]
			},
			{
				type: 'paragraph',
				lead: 'Tokenomics (P) (24%):',
				text: 'Evaluates on-chain tokenomics delivery, including whether observed unlock events match disclosed schedules, FDV, circulating supply dynamics, inflation, and buyback or burn activity.'
			},
			{
				type: 'table',
				headers: ['Category', 'Category Weight'],
				rows: [
					['Actual Token Vesting vs Disclosures', '5%'],
					['FDV', '4%'],
					['Market Cap vs FDV', '5%'],
					['Annualized Rate of Inflation', '5%'],
					['Buyback & Burn Events', '5%']
				]
			},
			{ type: 'heading', text: 'Calculation Methodology' },
			{
				type: 'paragraph',
				text: 'Each sub-criterion is scored on a 0–10 scale against a published rubric for quantitative criteria, or a graded rubric for qualitative criteria. The score for each sub-criterion is multiplied by its weight to produce an adjusted score. Adjusted scores are summed within each category to produce the category score. The overall Performance axis score is the sum of all category scores:'
			},
			{ type: 'formula', text: 'P(t) = ∑ (sub-criterion score × sub-criterion weight) across all categories' },
			{
				type: 'paragraph',
				text: 'The worked example below uses the sample post-TGE project from the prototype, which produces a final Performance score of 7.91.'
			},
			{ type: 'paragraph', text: 'Step #1: Score each sub-criterion and multiply by its weight.', strong: true },
			{ type: 'paragraph', text: 'Total Market (category weight: 35%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'Total Volume (as % of Market Cap): 7 × 5% = 0.35' },
					{ text: 'Total Depth (as % of Market Cap): 7 × 6% = 0.42' },
					{ text: 'Total Spreads (VWAS): 5.5 × 7% = 0.385' },
					{ text: 'Price Performance (Candle Win Rate): 6 × 8% = 0.48' },
					{ text: 'Open Interest (as % of Market Cap): 7 × 4.5% = 0.315' },
					{ text: 'Funding Rate: 6 × 4.5% = 0.27' },
					{ text: 'Total Market category score: 0.35 + 0.42 + 0.385 + 0.48 + 0.315 + 0.27 = 2.22', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Market Makers (category weight: 21%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'MM Volume (as % of total): 8 × 7% = 0.56' },
					{ text: 'MM Depth (as % of total): 9 × 7% = 0.63' },
					{ text: 'Uptime / KPI Adherence: 8 × 7% = 0.56' },
					{ text: 'Market Makers category score: 0.56 + 0.63 + 0.56 = 1.75', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Liquidity Footprint (category weight: 20%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'Top-Tier Exchange Coverage: 10 × 4% = 0.40' },
					{ text: 'Total Volume, CEX vs DEX: 10 × 4% = 0.40' },
					{ text: 'Total Depth, CEX vs DEX: 9 × 4% = 0.36' },
					{ text: 'Total Volume, Spot vs Perps: 9 × 4% = 0.36' },
					{ text: 'Total Depth, Spot vs Perps: 9 × 4% = 0.36' },
					{ text: 'Liquidity Footprint category score: 0.40 + 0.40 + 0.36 + 0.36 + 0.36 = 1.88', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Tokenomics (P) (category weight: 24%)', strong: true },
			{
				type: 'bullets',
				items: [
					{ text: 'Actual Token Vesting vs Disclosures: 10 × 5% = 0.50' },
					{ text: 'FDV: 9 × 4% = 0.36' },
					{ text: 'Market Cap vs FDV: 8 × 5% = 0.40' },
					{ text: 'Annualized Rate of Inflation: 9 × 5% = 0.45' },
					{ text: 'Buyback & Burn Events: 7 × 5% = 0.35' },
					{ text: 'Tokenomics (P) category score: 0.50 + 0.36 + 0.40 + 0.45 + 0.35 = 2.06', strong: true }
				]
			},
			{ type: 'paragraph', text: 'Step #2: Sum all category scores to produce P(t).', strong: true },
			{ type: 'formula', text: 'P(t) = 2.22 + 1.75 + 1.88 + 2.06 = 7.91' },
			{ type: 'heading', text: 'How to Interpret' },
			{
				type: 'paragraph',
				text: 'A higher Performance axis score reflects a project whose live market conditions, liquidity quality, and on-chain delivery consistently validate its disclosed commitments. Lower scores indicate deterioration in one or more of the underlying market or tokenomics categories.'
			},
			{
				type: 'paragraph',
				text: 'Because Performance is continuously updated, the score is sensitive to real-world events. A token unlock that widens spreads and weakens market maker uptime will reduce the Performance score even if no disclosures changed. Conversely, a new Tier-1 exchange listing will improve the Liquidity Footprint category immediately upon activation.'
			},
			{
				type: 'paragraph',
				text: 'Where Forgd does not have market maker trade activity data, a project receives an AAA rating for the Market Maker metrics when it meets all three maturity criteria: spot plus perpetual market depth is at least 1% of market capitalization, the token is listed on at least three Tier-1 centralized exchanges, and fully diluted valuation is at least $2.5 billion. At sufficient scale, a project may have enough organic liquidity and market participation that contracted market makers are no longer necessary.'
			},
			{
				type: 'paragraph',
				text: 'The Total Market category carries the highest combined weight within the Performance axis. Price Performance, measured through the Candle Win Rate, carries the single highest sub-criterion weight at 8% of the Performance axis, reflecting the view that sustained directional price behavior is the most meaningful signal of ongoing market health under live conditions.'
			},
			{ type: 'heading', text: 'Filtering' },
			{
				type: 'paragraph',
				text: 'Valuation, sector and exchange listing achievement-level filtering can be configured using the controls at the top of the Token Visibility Standard leaderboard. All Performance axis values are recalculated dynamically based on the selected timeframe, as trailing evaluation windows adjust to the selected range. Users can switch between isolated axis views and the composite TVS score to focus specifically on Performance quality across tokens.'
			}
		]
	},
	{
		id: 'grading-methodology',
		label: '5. Grading Methodology',
		blocks: [
			{
				type: 'paragraph',
				text: "The Universal Token Ratings use a familiar letter-grade system (AAA–CCC) to provide a simple, standardized interpretation of a project's Disclosure, Performance, and overall UTR scores."
			},
			{ type: 'heading', text: 'Disclosures Axis' },
			{
				type: 'paragraph',
				text: "The Disclosure grade reflects the completeness, and ongoing maintenance of a project's disclosures across each of the applicable sub-criteria."
			},
			{
				type: 'table',
				headers: ['Disclosures Score', 'Grade', 'Interpretation'],
				rows: [
					[
						'9.50 – 10.00',
						'AAA',
						'Exceptional disclosures across governance, tokenomics, operations, security, and legal transparency. Information is comprehensive, verifiable, and consistently maintained.'
					],
					[
						'9.00 – 9.49',
						'AA',
						'Excellent disclosures with only minor opportunities for greater completeness or ongoing updates.'
					],
					[
						'8.25 – 8.99',
						'A',
						'Strong disclosures across most evaluation criteria, though some information may be less comprehensive or require additional updates.'
					],
					[
						'7.25 – 8.24',
						'BBB',
						'Good disclosures providing sufficient transparency across most evaluation criteria, though moderate information gaps may exist.'
					],
					[
						'6.25 – 7.24',
						'BB',
						'Adequate disclosures providing a reasonable level of transparency, though meaningful gaps or inconsistencies remain.'
					],
					[
						'5.25 – 6.24',
						'B',
						'Limited disclosures with significant deficiencies across multiple transparency criteria. Additional due diligence is recommended.'
					],
					[
						'< 5.25',
						'CCC',
						"Insufficient disclosures to comprehensively assess the project's governance, operations, tokenomics, or legal structure."
					]
				]
			},
			{ type: 'heading', text: 'Performance Axis' },
			{
				type: 'paragraph',
				text: "The Performance grade reflects how consistently a project's observed market activity and operational execution align with the relevant sub-criteria over time."
			},
			{
				type: 'table',
				headers: ['Performance Score', 'Grade', 'Interpretation'],
				rows: [
					[
						'9.50 – 10.00',
						'AAA',
						'Exceptional performance across fundraising, software audibility, roadmap fulfillment, market health, adoption, and ecosystem execution.'
					],
					[
						'9.00 – 9.49',
						'AA',
						'Excellent execution across the majority of Performance criteria with consistently strong operational delivery.'
					],
					[
						'8.25 – 8.99',
						'A',
						'Strong execution demonstrating above-average performance across the majority of measurable criteria.'
					],
					[
						'7.25 – 8.24',
						'BBB',
						'Good execution reflecting generally reliable performance, though results may vary across certain measurable criteria.'
					],
					[
						'6.25 – 7.24',
						'BB',
						'Adequate execution demonstrating a capable project with noticeable weaknesses across multiple performance criteria.'
					],
					['5.25 – 6.24', 'B', 'Limited execution with meaningful weaknesses across multiple performance criteria.'],
					[
						'< 5.25',
						'CCC',
						'Insufficient performance demonstrating persistent weaknesses across measurable execution criteria.'
					]
				]
			},
			{ type: 'heading', text: 'Overall Score' },
			{
				type: 'paragraph',
				text: "The overall UTR grade combines the Disclosure and Performance axes into a single confidence rating that reflects the project's overall transparency and execution."
			},
			{
				type: 'table',
				headers: ['Overall Score', 'Grade', 'Interpretation'],
				rows: [
					[
						'82.50 – 100.00',
						'AAA',
						'Highest confidence overall rating reflecting exceptional performance across both Disclosure and Performance. Projects earning AAA demonstrate the strongest combination of transparency and execution within the Universal Token Rating framework.'
					],
					[
						'75.00 – 82.50',
						'AA',
						'Very high confidence overall rating reflecting consistently strong performance across both rating axes, with only limited areas for improvement.'
					],
					[
						'67.50 – 75.00',
						'A',
						'High confidence overall rating indicating a well-managed project with credible transparency and dependable execution.'
					],
					[
						'60.00 – 67.50',
						'BBB',
						'Moderate confidence overall rating reflecting solid project fundamentals, though continued progress is expected across one or both rating axes.'
					],
					[
						'50.00 – 60.00',
						'BB',
						'Developing confidence overall rating indicating a reasonable project foundation, but elevated risk relative to higher-rated peers.'
					],
					[
						'40.00 – 50.00',
						'B',
						'Low confidence overall rating reflecting material weaknesses across one or both rating axes. Enhanced due diligence is recommended.'
					],
					[
						'< 40.00',
						'CCC',
						'Very low confidence overall rating indicating substantial concerns resulting from weak Disclosure, weak Performance, or both. Independent verification is strongly recommended before relying on the project.'
					]
				]
			}
		]
	},
	{
		id: 'appendix',
		label: '6. Appendix',
		blocks: [
			{ type: 'heading', text: '6.1. Exchange Classifications' },
			{
				type: 'paragraph',
				text: "The Disclosure grade reflects the completeness, and ongoing maintenance of a project's disclosures across each of the applicable sub-criteria."
			},
			{
				type: 'table',
				headers: ['Tier', 'Interpretation', 'Entities Included'],
				rows: [
					[
						'1',
						'The largest and most established trading venues, with deep liquidity, strong price discovery, large and active user bases, broad asset coverage, and reliable market infrastructure. Liquidity on these venues is generally consistent across a wide range of assets.',
						'Binance, Coinbase, OKX, Upbit'
					],
					[
						'2',
						'Well-established exchanges with meaningful liquidity, active users, and broad market coverage, though depth and trading activity can be less consistent than on Tier 1 venues. These exchanges still serve as important sources of liquidity and distribution for a wide range of tokens.',
						'Bitget, Bithumb, Bybit, Gate, Kraken, KuCoin'
					],
					[
						'3',
						'All other eligible centralized and decentralized venues that provide secondary-market trading but with less consistent liquidity, user activity, or market depth across their broader asset base. DEXs can still be very liquid for individual tokens, particularly larger assets that already trade with significant volume and liquidity across major CEXs.',
						'All others'
					]
				]
			},
			{
				type: 'paragraph',
				text: 'In addition, particular exchanges are “blacklisted” from certain Performance calculations that reference trade volume, depth of liquidity, bid-ask spreads, open interest, or funding rate. These entities include AscendEX, LBank, WhiteBit, Ourbit, HTX, CoinUp.io, BTCC, Hotcoin, CoinW, TooBit, DeepCoin, Azbit, Pionex, KCEX, XT.com, GroveX, OrangX, WEEX, and Tapbit.'
			}
		]
	},
	{
		id: 'glossary',
		label: '7. Glossary',
		blocks: [
			{
				type: 'heading',
				text: 'Annualized Rate of Inflation'
			},
			{
				type: 'paragraph',
				text: 'New token supply entering circulation over the next 12 months as a percentage of current circulating supply. Measures dilution pressure on existing holders. Calculated from on-chain and disclosed data; defaults to 0 if emissions are undisclosed.'
			},
			{ type: 'heading', text: 'Auditor Disclosures (Smart Contract)' },
			{
				type: 'paragraph',
				text: 'Whether the project has disclosed all smart contract auditors engaged, the scope of each audit, and the published audit reports including finding severity and remediation status. Unresolved critical findings hard-cap this sub-criterion at a score of 4 regardless of disclosure completeness.'
			},
			{ type: 'heading', text: 'Buyback & Burn Events' },
			{
				type: 'paragraph',
				text: 'Cumulative token buybacks and burn events measured relative to the total amount of supply released. Sourced primarily from Tokenomist, with DeFiLlama as a backfill where Tokenomist coverage is unavailable.'
			},
			{ type: 'heading', text: 'Candle Win Rate' },
			{
				type: 'paragraph',
				text: "The number of daily green candles (closing price greater than opening price) over a trailing 30-day window, expressed as a proportion of total candles. Used to measure sustained buying pressure and directional price behavior. Isolated from BTC, ETH, and any altcoin index so that the score reflects only the project's own market performance."
			},
			{ type: 'heading', text: 'Category Score' },
			{
				type: 'paragraph',
				text: "The weighted sum of sub-criterion scores within a given category, expressed on a 0–10 scale. Contributes to the overall axis score according to the category's assigned weight."
			},
			{ type: 'heading', text: 'CEX' },
			{
				type: 'paragraph',
				text: 'Centralized exchange. A centralized trading venue where assets are traded through an order book managed by an operator.'
			},
			{ type: 'heading', text: 'Composite TVS Score' },
			{
				type: 'paragraph',
				text: 'The product of the Disclosure axis score and the Performance axis score: TVS(t) = D(t) × P(t). Ranges from 0 to 100. Both axes must perform well simultaneously to produce a high composite score.'
			},
			{ type: 'heading', text: 'DEX' },
			{
				type: 'paragraph',
				text: 'Decentralized exchange. An on-chain trading venue where assets are traded without a centralized intermediary.'
			},
			{ type: 'heading', text: 'Disclosure Axis (D)' },
			{
				type: 'paragraph',
				text: 'The axis of the Token Visibility Standard that evaluates the completeness, quality, and freshness of information disclosed by the project itself. Scored on a 0–10 scale. The four categories are Core Contributors (18%), Tokenomics (34%), Legal & Financial (24%), and Service Provider Engagements (24%).'
			},
			{ type: 'heading', text: 'Exchange Engagement Disclosures' },
			{
				type: 'paragraph',
				text: 'Whether the project discloses which centralized and decentralized exchanges it is listed on, and whether any listing fees, token allocations, or incentive arrangements were part of the listing agreement.'
			},
			{ type: 'heading', text: 'FDV' },
			{
				type: 'paragraph',
				text: 'Fully diluted valuation. Max supply multiplied by current price, expressed in USD. Scored on an absolute scale — higher FDV indicates greater assigned value to the project. Calculated as a 90-day average of daily closing FDV; minimum of 30 days of history required.'
			},
			{ type: 'heading', text: 'Funding Rate' },
			{
				type: 'paragraph',
				text: 'Time-weighted average perpetual funding rate over the trailing 7-day window, in basis points per 8 hours. Positive funding rates indicate longs are paying shorts, reflecting eagerness to hold long exposure. Asymmetrically scored — positive funding rates receive higher scores than equivalent negative rates.'
			},
			{ type: 'heading', text: 'KPI Adherence' },
			{
				type: 'paragraph',
				text: "The proportion of time a market maker was live, quoting within agreed spread and depth parameters, during the evaluation window. Measured against the market maker's contracted uptime SLA. Projects without a defined SLA default to a score of 3 for this sub-criterion."
			},
			{ type: 'heading', text: 'Legal Entities, Licenses & Patents' },
			{
				type: 'paragraph',
				text: 'Whether the project discloses its legal entity structure, jurisdiction of incorporation, relevant regulatory licenses, and any intellectual property or patents held.'
			},
			{ type: 'heading', text: 'Liquidity Footprint' },
			{
				type: 'paragraph',
				text: "A Performance Axis category evaluating how a project's liquidity is distributed across venue types and market segments. Includes Top-Tier Exchange Coverage, CEX vs DEX volume and depth splits, and Spot vs Perps volume and depth splits. Category weight: 20%."
			},
			{ type: 'heading', text: 'Market Cap vs FDV' },
			{
				type: 'paragraph',
				text: 'The ratio of current market capitalization to fully diluted valuation, expressed as a percentage. A higher ratio indicates that more of the total supply is already circulating, meaning lower future dilution pressure. A lower ratio signals significant future supply overhang.'
			},
			{ type: 'heading', text: 'Market Makers (Category)' },
			{
				type: 'paragraph',
				text: "A Performance Axis category evaluating the contribution and contractual adherence of engaged market makers, as tracked via Forgd's monitoring infrastructure. Includes MM Volume, MM Depth, and Uptime / KPI Adherence. Category weight: 21%."
			},
			{ type: 'heading', text: 'MM Depth (as % of total)' },
			{
				type: 'paragraph',
				text: "Market maker attributed order book depth as a percentage of total depth across all tracked venues. Measures the market maker's contribution to overall liquidity provision."
			},
			{ type: 'heading', text: 'MM Volume (as % of total)' },
			{
				type: 'paragraph',
				text: "Market maker attributed volume as a percentage of total platform volume, measured via Forgd's MM reporting or API data. Scores are structured to reward a healthy range of MM-attributed volume, reflecting the expectation that organic activity should also be present."
			},
			{ type: 'heading', text: 'Multisig Disclosures' },
			{
				type: 'paragraph',
				text: 'Whether all multi-signature wallets controlling material funds — treasury, ecosystem, team — are publicly disclosed with signer identities or roles, threshold structure, and on-chain address.'
			},
			{ type: 'heading', text: 'Open Interest (as % of Market Cap)' },
			{
				type: 'paragraph',
				text: 'Total open interest across all perpetual and futures contracts as a percentage of market cap. Measures speculative engagement and derivatives market development.'
			},
			{ type: 'heading', text: 'Performance Axis (P)' },
			{
				type: 'paragraph',
				text: "The axis of the Token Visibility Standard that evaluates whether a project's observed market structure and operational behavior validate its disclosures and commitments over time. Scored on a 0–10 scale using a trailing-window fulfillment ratio methodology. The four categories are Total Market (35%), Market Makers (21%), Liquidity Footprint (20%), and Tokenomics (24%)."
			},
			{ type: 'heading', text: 'Price Performance (Candle Win Rate)' },
			{ type: 'paragraph', text: 'See Candle Win Rate.' },
			{ type: 'heading', text: 'Staleness Penalty' },
			{
				type: 'paragraph',
				text: "A 50% reduction applied to a disclosure category's contribution to the overall Disclosure axis score when a material amendment is not reflected within 60 days of the change occurring. The penalty remains in effect until the disclosure is remediated."
			},
			{ type: 'heading', text: 'TGE' },
			{
				type: 'paragraph',
				text: "Token Generation Event. The date on which a project's token is launched and first made available for trading. At TGE, Disclosure is fully measurable and Performance begins accruing."
			},
			{ type: 'heading', text: 'Token Visibility Standard (TVS)' },
			{
				type: 'paragraph',
				text: "Forgd's continuous, dual-axis framework for evaluating the disclosure quality and live market performance of token projects. Produces a composite 0–100 score as the product of the Disclosure and Performance axes."
			},
			{ type: 'heading', text: 'Tokenomics (Disclosure Category)' },
			{
				type: 'paragraph',
				text: "A Disclosure Axis category evaluating the completeness of the project's token distribution, vesting, and allocation framework. Includes vesting schedules, distribution schedules, external allocation disclosures, and multisig disclosures. Category weight: 34%."
			},
			{ type: 'heading', text: 'Tokenomics (Performance Category)' },
			{
				type: 'paragraph',
				text: 'A Performance Axis category evaluating on-chain tokenomics delivery. Includes Actual Token Vesting vs Disclosures, FDV, Market Cap vs FDV, Annualized Rate of Inflation, and Buyback & Burn Events. Category weight: 24%.'
			},
			{ type: 'heading', text: 'Top-Tier Exchange Coverage' },
			{
				type: 'paragraph',
				text: 'Whether the token is listed and actively traded on Tier-1 or Tier-2 centralized exchanges. Tier 1 is defined as Binance, OKX, Coinbase, and Upbit. Tier 2 is defined as Bybit, Bitget, Bithumb, Kraken, KuCoin, and Gate. All other venues are Tier 3.'
			},
			{ type: 'heading', text: 'Total Depth (as % of Market Cap)' },
			{
				type: 'paragraph',
				text: 'Aggregate order book depth — the sum of bids and asks within 2% of mid — across all tracked venues, expressed as a percentage of market cap. Excluded exchange list applies.'
			},
			{ type: 'heading', text: 'Total Market (Category)' },
			{
				type: 'paragraph',
				text: 'A Performance Axis category evaluating overall market activity, liquidity quality, price behavior, and derivatives conditions. Includes Total Volume, Total Depth, Total Spreads, Price Performance, Open Interest, and Funding Rate. Category weight: 35%.'
			},
			{ type: 'heading', text: 'Total Spreads (VWAS)' },
			{
				type: 'paragraph',
				text: 'Volume-weighted average bid-ask spread across all active trading pairs, in basis points. Measures market efficiency and the cost of execution. See also: VWAS.'
			},
			{ type: 'heading', text: 'Total Volume (as % of Market Cap)' },
			{
				type: 'paragraph',
				text: 'Aggregate 24-hour trading volume across all tracked venues, expressed as a percentage of market cap. Excluded exchange list applies.'
			},
			{ type: 'heading', text: 'Trailing Window' },
			{
				type: 'paragraph',
				text: 'The lookback period used to calculate Performance axis scores. Trailing windows roll forward continuously as new data enters the system, ensuring that scores reflect recent operating conditions rather than a fixed historical snapshot.'
			},
			{ type: 'heading', text: 'TVS Score' },
			{ type: 'paragraph', text: 'See Composite TVS Score.' },
			{ type: 'heading', text: 'VWAS: Volume-Weighted Average Spread' },
			{
				type: 'paragraph',
				text: 'The average bid-ask spread weighted by executed trading volume across all venues, giving greater influence to periods with higher trading activity.'
			}
		]
	}
]

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
	core_contributors: 'Evaluates whether the team behind the project is publicly identifiable and verifiably described.',
	tokenomics_d:
		"Evaluates the completeness and transparency of the project's token distribution, vesting, and allocation framework.",
	legal_financial:
		'Evaluates the degree to which the project discloses its legal structure, financial position, and treasury activity.',
	service_providers:
		"Evaluates the transparency of the project's key third-party service relationships, including market makers, smart contract auditors, and exchange listing arrangements.",
	total_market:
		"Evaluates overall market activity, liquidity quality, price behavior, and derivatives market conditions relative to the token's market capitalization.",
	market_makers:
		"Evaluates the contribution and adherence of engaged market makers to their contractual mandates, as tracked via Forgd's monitoring infrastructure.",
	liquidity_footprint:
		"Evaluates how the project's liquidity is distributed across venue types and market segments, including CEX versus DEX and spot versus perpetuals.",
	tokenomics_p:
		'Evaluates on-chain tokenomics delivery, including whether observed unlock events match disclosed schedules, FDV, circulating supply dynamics, inflation, and buyback or burn activity.'
}

function modernizeText(text: string): string {
	return text
		.replaceAll('Token Visibility Standard', 'Universal Token Rating')
		.replaceAll('Visibility Standard', 'Universal Token Rating')
		.replaceAll('TVS', 'UTR')
}

function modernizeBlock(block: UtrDocBlock): UtrDocBlock {
	switch (block.type) {
		case 'heading':
		case 'formula':
			return { ...block, text: modernizeText(block.text) }
		case 'paragraph':
			return {
				...block,
				text: modernizeText(block.text),
				lead: block.lead ? modernizeText(block.lead) : undefined
			}
		case 'bullets':
		case 'numbered':
			return {
				...block,
				items: block.items.map((item) => ({
					...item,
					text: modernizeText(item.text),
					children: item.children?.map(modernizeText)
				}))
			}
		case 'table':
			return {
				...block,
				headers: block.headers.map(modernizeText),
				rows: block.rows.map((row) => row.map(modernizeText))
			}
	}
}

function formatWeight(weight: number): string {
	return formatPercent(weight, {
		input: 'fraction',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		useGrouping: false
	})
}

function categoryWeight(criteria: Array<UtrScoringCriterionConfig>): number {
	return criteria.reduce((total, criterion) => total + criterion.weight, 0)
}

function criteriaForApplicability(
	category: UtrScoringCategoryConfig,
	applicability?: 'preTge' | 'postTge'
): Array<UtrScoringCriterionConfig> {
	if (!applicability) return category.criteria
	return category.criteria.filter(
		(criterion) => criterion.applicability === 'both' || criterion.applicability === applicability
	)
}

function categoryTableBlocks(
	categories: Array<UtrScoringCategoryConfig>,
	applicability?: 'preTge' | 'postTge'
): Array<UtrDocBlock> {
	const applicableCategories = categories.flatMap((category) => {
		const criteria = criteriaForApplicability(category, applicability)
		return criteria.length > 0 ? [{ category, criteria }] : []
	})
	if (applicableCategories.length === 0) return []
	const blocks: Array<UtrDocBlock> = [
		{
			type: 'table',
			headers: ['Category', 'Category Weight'],
			rows: applicableCategories.map(({ category, criteria }) => [
				category.label,
				formatWeight(categoryWeight(criteria))
			])
		}
	]
	for (const { category, criteria } of applicableCategories) {
		blocks.push(
			{
				type: 'paragraph',
				lead: `${category.label} (${formatWeight(categoryWeight(criteria))}):`,
				text:
					CATEGORY_DESCRIPTIONS[category.key] ??
					`Includes the currently configured ${applicability === 'preTge' ? 'pre-TGE' : applicability === 'postTge' ? 'post-TGE' : ''} evaluation criteria for this category.`
			},
			{
				type: 'table',
				headers: ['Criterion', 'Weight'],
				rows: criteria.map((criterion) => [criterion.label, formatWeight(criterion.weight)])
			}
		)
	}
	return blocks
}

function unavailableCoreBlocks(axis: 'Disclosure' | 'Performance'): Array<UtrDocBlock> {
	return [
		{ type: 'heading', text: 'Core Components' },
		{
			type: 'paragraph',
			text: `The ${axis} Axis category and criterion weights are loaded from Forgd's active scoring configuration.`
		},
		{
			type: 'table',
			headers: ['Category', 'Category Weight'],
			rows: [['Unavailable', 'Scoring configuration is temporarily unavailable.']]
		}
	]
}

function disclosureCoreBlocks(config: UtrScoringConfig | null): Array<UtrDocBlock> {
	if (!config?.disclosure.categories.length) return unavailableCoreBlocks('Disclosure')
	return [
		{ type: 'heading', text: 'Core Components' },
		{
			type: 'paragraph',
			text: 'The Disclosure Axis is organized into the categories below. Category weights are calculated from the active sub-criterion weights.'
		},
		...categoryTableBlocks(config.disclosure.categories)
	]
}

function performanceCoreBlocks(config: UtrScoringConfig | null): Array<UtrDocBlock> {
	if (!config?.performance.categories.length) return unavailableCoreBlocks('Performance')
	const postTge = categoryTableBlocks(config.performance.categories, 'postTge')
	const preTge = categoryTableBlocks(config.performance.categories, 'preTge')
	return [
		{ type: 'heading', text: 'Core Components' },
		{
			type: 'paragraph',
			text: 'The Performance Axis criteria are grouped by their active pre-TGE or post-TGE applicability. Category weights are calculated from the active sub-criterion weights.'
		},
		...(postTge.length > 0 ? ([{ type: 'heading', text: 'Post-TGE Criteria' }, ...postTge] as Array<UtrDocBlock>) : []),
		...(preTge.length > 0 ? ([{ type: 'heading', text: 'Pre-TGE Criteria' }, ...preTge] as Array<UtrDocBlock>) : [])
	]
}

function replaceCoreComponents(chapter: UtrDocChapter, blocks: Array<UtrDocBlock>): UtrDocChapter {
	const start = chapter.blocks.findIndex((block) => block.type === 'heading' && block.text === 'Core Components')
	const end = chapter.blocks.findIndex(
		(block, index) => index > start && block.type === 'heading' && block.text === 'Calculation Methodology'
	)
	if (start === -1 || end === -1) return chapter
	return { ...chapter, blocks: [...chapter.blocks.slice(0, start), ...blocks, ...chapter.blocks.slice(end)] }
}

function replacePerformanceCalculationMethodology(chapter: UtrDocChapter): UtrDocChapter {
	const start = chapter.blocks.findIndex(
		(block) => block.type === 'heading' && block.text === 'Calculation Methodology'
	)
	const end = chapter.blocks.findIndex(
		(block, index) => index > start && block.type === 'heading' && block.text === 'How to Interpret'
	)
	if (start === -1 || end === -1) return chapter
	const blocks: Array<UtrDocBlock> = [
		{ type: 'heading', text: 'Calculation Methodology' },
		{
			type: 'paragraph',
			text: "Each active sub-criterion is scored on a 0–10 scale and multiplied by its weight from Forgd's current scoring configuration. The weighted sub-criterion scores are summed to produce the Performance axis score."
		},
		{ type: 'formula', text: 'P(t) = ∑ (sub-criterion score × active sub-criterion weight)' },
		{
			type: 'paragraph',
			text: 'The category and criterion tables above are generated from the active scoring configuration, so this documentation remains aligned when weights or applicability rules change.'
		}
	]
	return { ...chapter, blocks: [...chapter.blocks.slice(0, start), ...blocks, ...chapter.blocks.slice(end)] }
}

function gradeRangeRows(scale: Array<UtrGradeScaleEntry>): Array<Array<string>> {
	const formatScore = (score: number) =>
		formatNumber(score, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
	const sorted = [...scale].sort((a, b) => {
		if (a.min === null) return 1
		if (b.min === null) return -1
		return b.min - a.min
	})
	return sorted.map((entry, index) => {
		const previousMin = index > 0 ? sorted[index - 1].min : null
		const range =
			entry.min === null
				? previousMin == null
					? 'All scores'
					: `<${formatScore(previousMin)}`
				: previousMin == null
					? `≥${formatScore(entry.min)}`
					: `${formatScore(entry.min)}–<${formatScore(previousMin)}`
		return [range, entry.grade, entry.interpretation]
	})
}

function gradingAxisBlocks(
	heading: string,
	header: string,
	fallbackDescription: string,
	axis: UtrGradingAxisConfig | null
): Array<UtrDocBlock> {
	return [
		{ type: 'heading', text: heading },
		{ type: 'paragraph', text: axis?.description || fallbackDescription },
		{
			type: 'table',
			headers: [header, 'Grade', 'Interpretation'],
			rows: axis?.scale.length
				? gradeRangeRows(axis.scale)
				: [['Unavailable', 'N/A', 'Scoring configuration is temporarily unavailable.']]
		}
	]
}

function gradingChapter(config: UtrScoringConfig | null): UtrDocChapter {
	return {
		id: 'grading-methodology',
		label: '5. Grading Methodology',
		blocks: [
			{
				type: 'paragraph',
				text: "The Universal Token Ratings use a familiar letter-grade system (AAA–CCC) to provide a simple, standardized interpretation of a project's Disclosure, Performance, and overall UTR scores."
			},
			...gradingAxisBlocks(
				'Disclosures Axis',
				'Disclosures Score',
				"The Disclosure grade reflects the completeness, and ongoing maintenance of a project's disclosures across each of the applicable sub-criteria.",
				config?.grading.disclosure ?? null
			),
			...gradingAxisBlocks(
				'Performance Axis',
				'Performance Score',
				"The Performance grade reflects how consistently a project's observed market activity and operational execution align with the relevant sub-criteria over time.",
				config?.grading.performance ?? null
			),
			...gradingAxisBlocks(
				'Overall Score',
				'Overall Score',
				"The overall UTR grade combines the Disclosure and Performance axes into a single confidence rating that reflects the project's overall transparency and execution.",
				config?.grading.overall ?? null
			)
		]
	}
}

function appendixChapter(chapter: UtrDocChapter, config: UtrScoringConfig | null): UtrDocChapter {
	if (!config) return chapter
	return {
		...chapter,
		blocks: chapter.blocks.map((block) => {
			if (block.type !== 'table' || block.headers[0] !== 'Tier') return block
			return {
				...block,
				rows: block.rows.map((row) => {
					if (row[0] === '1')
						return [row[0], row[1], config.exchanges.tier1.map((entry) => entry.displayName).join(', ')]
					if (row[0] === '2')
						return [row[0], row[1], config.exchanges.tier2.map((entry) => entry.displayName).join(', ')]
					return row
				})
			}
		})
	}
}

function glossaryChapter(chapter: UtrDocChapter, config: UtrScoringConfig | null): UtrDocChapter {
	if (!config) return chapter
	const categoryByKey = new Map(
		[...config.disclosure.categories, ...config.performance.categories].map((category) => [category.key, category])
	)
	const categoryKeyByHeading: Record<string, string> = {
		'Liquidity Footprint': 'liquidity_footprint',
		'Market Makers (Category)': 'market_makers',
		'Tokenomics (Disclosure Category)': 'tokenomics_d',
		'Tokenomics (Performance Category)': 'tokenomics_p',
		'Total Market (Category)': 'total_market'
	}
	const describeCategories = (categories: Array<UtrScoringCategoryConfig>) =>
		categories.map((category) => `${category.label} (${formatWeight(categoryWeight(category.criteria))})`).join(', ')
	let heading = ''
	return {
		...chapter,
		blocks: chapter.blocks.map((block) => {
			if (block.type === 'heading') {
				heading = block.text
				return block
			}
			if (block.type !== 'paragraph') return block
			if (heading === 'Disclosure Axis (D)') {
				return {
					...block,
					text: `The axis of the Universal Token Rating that evaluates the completeness, quality, and freshness of information disclosed by the project itself. Scored on a 0–10 scale. The active categories are ${describeCategories(config.disclosure.categories)}.`
				}
			}
			if (heading === 'Performance Axis (P)') {
				return {
					...block,
					text: `The axis of the Universal Token Rating that evaluates whether a project's observed market structure and operational behavior validate its disclosures and commitments over time. Scored on a 0–10 scale using a trailing-window fulfillment ratio methodology. The active categories are ${describeCategories(config.performance.categories)}.`
				}
			}
			if (heading === 'Top-Tier Exchange Coverage') {
				return {
					...block,
					text: `Whether the token is listed and actively traded on Tier-1 or Tier-2 centralized exchanges. Tier 1 is defined as ${config.exchanges.tier1.map((entry) => entry.displayName).join(', ')}. Tier 2 is defined as ${config.exchanges.tier2.map((entry) => entry.displayName).join(', ')}. All other venues are Tier 3.`
				}
			}
			const category = categoryByKey.get(categoryKeyByHeading[heading])
			if (!category) return block
			return {
				...block,
				text: block.text.replace(
					/Category weight: [0-9.]+%\./,
					`Category weight: ${formatWeight(categoryWeight(category.criteria))}.`
				)
			}
		})
	}
}

export function buildUtrDocChapters(config: UtrScoringConfig | null): Array<UtrDocChapter> {
	return UTR_FIGMA_DOC_CHAPTERS.map((sourceChapter) => ({
		...sourceChapter,
		blocks: sourceChapter.blocks.map(modernizeBlock)
	})).map((chapter) => {
		if (chapter.id === 'disclosure-axis') return replaceCoreComponents(chapter, disclosureCoreBlocks(config))
		if (chapter.id === 'performance-axis') {
			return replacePerformanceCalculationMethodology(replaceCoreComponents(chapter, performanceCoreBlocks(config)))
		}
		if (chapter.id === 'grading-methodology') return gradingChapter(config)
		if (chapter.id === 'appendix') return appendixChapter(chapter, config)
		if (chapter.id === 'glossary') return glossaryChapter(chapter, config)
		return chapter
	})
}
