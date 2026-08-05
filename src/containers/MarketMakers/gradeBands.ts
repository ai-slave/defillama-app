export type GradeBand = {
	min: number
	label: string
	range: string
	colorClassName: string
	interpretation: string
}

export const GRADE_BANDS: GradeBand[] = [
	{
		min: 9.5,
		label: 'AAA',
		range: '9.50 – 10.00',
		colorClassName: 'text-success',
		interpretation:
			'Exceptional rating reserved for market makers demonstrating best-in-class historical trading performance across depth, volume, spreads, and KPI adherence. Reflects consistently outstanding execution, extensive exchange and ecosystem coverage, strong trust signals, exceptional uptime, and deep operational integration with Forgd.'
	},
	{
		min: 9,
		label: 'AA',
		range: '9.00 – 9.49',
		colorClassName: 'text-success',
		interpretation:
			'Excellent rating reflecting highly reliable, institutional-grade market making capabilities with consistently strong performance across trading KPIs. Demonstrates meaningful trust signals, broad exchange coverage, high operational uptime, and a well-established integration profile with Forgd.'
	},
	{
		min: 8.25,
		label: 'A',
		range: '8.25 – 8.99',
		colorClassName: 'text-success',
		interpretation:
			'Strong rating indicating consistently above-average trading performance with solid execution across liquidity, volume, spreads, and KPI adherence. Demonstrates credible trust signals, dependable operational capabilities, and broad coverage, though there remains some opportunity for further optimization or scale.'
	},
	{
		min: 7.25,
		label: 'BBB',
		range: '7.25 – 8.24',
		colorClassName: 'text-warning',
		interpretation:
			'Good rating reflecting capable and dependable market making performance suitable for the majority of project engagements. While execution is generally consistent, there may be moderate variability across certain trading KPIs, exchange coverage, operational uptime, or historical performance metrics.'
	},
	{
		min: 6.25,
		label: 'BB',
		range: '6.25 – 7.24',
		colorClassName: 'text-warning',
		interpretation:
			'Adequate rating indicating market makers capable of servicing a range of liquidity mandates, though with more noticeable limitations in trading consistency, market coverage, execution quality, or operational maturity. Projects should evaluate engagement suitability based on their specific liquidity objectives and risk tolerance.'
	},
	{
		min: 5.25,
		label: 'B',
		range: '5.25 – 6.24',
		colorClassName: 'text-warning',
		interpretation:
			'Speculative rating reflecting providers with meaningful limitations across multiple evaluation criteria, including trading KPIs, exchange coverage, operational reliability, trust signals, or integration maturity. While appropriate for certain mandates, additional due diligence is recommended prior to engagement.'
	},
	{
		min: -Infinity,
		label: 'CCC',
		range: '<5.25',
		colorClassName: 'text-error',
		interpretation:
			'High Risk rating indicating limited historical visibility, incomplete integration with Forgd, or persistent weaknesses across multiple performance indicators. Projects should conduct enhanced due diligence, request supporting materials directly from the provider, and independently validate capabilities before relying on the market maker for critical liquidity mandates.'
	}
]

export const GRADE_SCALE_SUMMARY = 'Grades are measured AAA (highest) to CCC (lowest).'
