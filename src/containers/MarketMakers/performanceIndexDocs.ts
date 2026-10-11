export const PI_OVERVIEW_PARAGRAPHS = [
	'The Performance Index assigns a “Grade” to all Market Makers based on their weighted rank across (i) trading KPIs, (ii) trust rating, (iii) coverage & capabilities, (iv) uptime, and (v) integration level with Forgd. The weighted rank across these five variables is used to calculate a proprietary composite score which then determines a Grade, measured AAA (highest) and CCC (lowest).',
	'The Performance Index provides a unified view of overall performance by aggregating granular trading KPIs, including liquidity provision, execution quality, and operational consistency, alongside infrastructure, integration, and coverage-related attributes such as exchange integrations, API capabilities, and participation across CEXs, DEXs, and ancillary trading functions.'
]

export const PI_FIGURE_CAPTION =
	'Supporting fields within the table provide additional context on each market maker’s infrastructure and capabilities, and a “Details” view allows for a more granular breakdown of performance and characteristics. Screenshot taken July 31, 2026.'

export const PI_METHODOLOGY_INTRO =
	'“Grades” assigned to each Market Maker in the Performance Index are calculated using a proprietary weighted composite model that incorporates over 50 underlying KPIs. These KPIs are measured at a granular level and may differentiate across specific dimensions (e.g., depth at varying thresholds, bid vs ask side behavior, and execution characteristics).'

export const PI_COMPOSITE_SCORE_INTRO =
	'Each Market Maker’s weighted score creates a “Composite Score”, that ranges 1 - 10, with 10 representing the highest possible Composite Score, and 1 representing the lowest. Composite Scores are then used to assign a letter grade to provide a simplified interpretation of overall performance. Composite Scores align to Grades using predefined ranges and serve as shorthand for comparing market makers with similar overall performance profiles. The exact methodology for each grade can be found below:'

export const PI_GRADE_SUMMARY =
	'Grades provide a more intuitive representation of overall performance. While the Composite Score offers greater precision, the letter grade groups market makers into broad performance tiers, making it easier to benchmark counterparties at a glance. Because grades are derived solely from the Composite Score, changes in grade occur only when a market maker’s composite score crosses a defined threshold. Each of the underlying metrics used to calculate Composite Scores are described below.'

export const PI_COMPONENT_SECTIONS: Array<{ title: string; paragraphs: Array<string> }> = [
	{
		title: 'Trust',
		paragraphs: [
			'The Trust component evaluates the level of confidence Forgd can place in a market maker’s observed performance. This is primarily informed by the number of engagements tracked through Forgd for that market maker. A larger sample size of tracked engagements provides greater visibility into the market maker’s performance across different projects, market environments, and execution requirements. For example, market makers with more than 20 tracked engagements may receive the maximum score for this component, while market makers with fewer than five tracked engagements may receive a lower score due to the limited available sample size.',
			'Trust also accounts for potential trading abnormalities identified through Forgd’s monitoring systems. These may include, but are not limited to, indications of potential spoofing, unusual discrepancies between quoted liquidity and actual filled maker volume, or skewed fill patterns across engagements (e.g., high maker fill volume with no taker fill volume indicating a lack of rebalancing or hedging from tracked accounts). In general, market makers with a larger number of tracked engagements and fewer observed trading abnormalities receive a higher Trust score, as this serves as a proxy for both sample-size confidence and consistency of execution quality.'
		]
	},
	{
		title: 'Coverage and Capabilities',
		paragraphs: [
			'The Coverage and Capabilities component reflects the breadth of a market maker’s exchange coverage, ecosystem reach, and service offering. Market makers with strong connectivity across major centralized exchanges, as well as meaningful integrations across leading decentralized exchanges and multiple base-layer ecosystems, receive a higher score. This category is intended to measure not only where a market maker can operate, but also the depth and flexibility of its execution infrastructure.',
			'This component also considers ancillary services offered beyond standard liquidity provision. These may include treasury management, OTC execution, covered call strategies, zero-cost collars, liquidation support, exchange listing introductions, and advisory support related to exchange applications or go-to-market planning. Market makers with broader capabilities are generally better positioned to support blockchain projects across a wider range of market conditions and strategic objectives.'
		]
	},
	{
		title: 'Uptime',
		paragraphs: [
			'The Uptime component measures a market maker’s operational consistency across tracked engagements. Uptime is synonymous with KPI adherence. For context, most market making agreements include contractual obligations to maintain specific levels of depth, spread, and availability across designated centralized or decentralized exchanges. KPI adherence is measured on a per engagement basis and then averaged across all engagements tracked from the Market Maker. Market makers that consistently satisfy contractual obligations across their engagements receive a higher Uptime score.',
			'Conversely, market makers that frequently fall short of agreed-upon depth, spread, or availability requirements may receive a lower Uptime score. This category is intended to help projects understand whether a market maker has historically demonstrated reliable execution and consistent performance against its contractual obligations.'
		]
	},
	{
		title: 'Integration Level',
		paragraphs: [
			'The Integration Level component reflects the degree to which a market maker is connected to Forgd’s data consumption and monitoring systems. Market makers with full API integrations across multiple engagement types, active participation in RFQs, and consistent data connectivity receive the highest Integration Level scores. This level of integration enables Forgd to evaluate performance with greater accuracy and provides projects with stronger visibility into the market maker’s execution history.',
			'Market makers with less sophisticated data connectivity, limited engagement tracking, or no RFQ participation may receive a partial Integration Level score. Market makers that are not yet integrated with Forgd are not eligible to receive a score in this category, as Forgd has limited visibility into their capabilities and current project engagements. For the avoidance of doubt, integration with Forgd is free and available to all market makers. Any market maker with a lower Integration Level score can improve its ranking by integrating with Forgd’s systems and increasing the transparency of its tracked activity.'
		]
	}
]

export const PI_SAME_RANK_NOTE =
	'Market makers may share the same rank in cases where composite scores are equivalent when rounded to one decimal place.'

export const PI_PREFACE_BULLET =
	'assigns a “Grade” to all Market Makers based on their weighted rank across (i) trading KPIs, (ii) trust rating, (iii) coverage & capabilities, (iv) uptime, and (v) integration level with Forgd. The weighted rank across these five variables is used to calculate a proprietary composite score which then determines a Grade, measured AAA (highest) and CCC (lowest). Accordingly, the Performance Index serves as a holistic measurement of the industry’s top Market Makers based on insights from over 50 quantitative and qualitative variables.'
