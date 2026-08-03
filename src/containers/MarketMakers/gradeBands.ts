export type GradeBand = {
	min: number
	label: string
	range: string
	colorClassName: string
	interpretation: string
}

export const GRADE_BANDS: GradeBand[] = [
	{
		min: 9.1,
		label: 'AAA',
		range: '9.1 – 10.0',
		colorClassName: 'text-success',
		interpretation:
			'Best-in-class market maker with exceptional historical trading KPIs across depth, volume, spreads, and KPI adherence. Demonstrates strong trust signals, broad exchange and ecosystem coverage, high uptime, and deep integration with the Forgd platform.'
	},
	{
		min: 8,
		label: 'AA',
		range: '8.0 – 9.1',
		colorClassName: 'text-success',
		interpretation:
			'Highly reliable, institution-grade market maker with strong performance across core trading KPIs and consistent execution across tracked engagements. Shows meaningful trust, broad capabilities, strong uptime, and a well-established integration profile with Forgd.'
	},
	{
		min: 7,
		label: 'BBB',
		range: '7.0 – 8.0',
		colorClassName: 'text-warning',
		interpretation:
			'Generally strong provider with solid trading performance, though there may be some variability across depth, volume, spreads, KPI adherence, or coverage. Suitable for many engagements, with credible trust signals and capabilities but room for improvement in consistency, breadth, or integration.'
	},
	{
		min: 6,
		label: 'BB',
		range: '6.0 – 7.0',
		colorClassName: 'text-warning',
		interpretation:
			'Usable counterparty with demonstrated capabilities, but with more noticeable limitations across trading KPIs, exchange coverage, uptime, trust signals, or Forgd integration. Best suited for narrower mandates where the market maker’s strengths align closely with the project’s specific liquidity needs.'
	},
	{
		min: 5,
		label: 'B',
		range: '5.0 – 6.0',
		colorClassName: 'text-warning',
		interpretation:
			'Viable for targeted mandates, but with inconsistent performance across trading KPIs, exchange coverage, uptime, trust signals, or Forgd integration. Projects should confirm the market maker’s ability to meet required depth, spread, and availability obligations before relying on it for core liquidity needs.'
	},
	{
		min: -Infinity,
		label: 'CCC',
		range: '<5.0',
		colorClassName: 'text-error',
		interpretation:
			'Limited information is currently available on this market maker due to lower visibility or limited integration with Forgd. Projects should engage the counterparty directly, request additional materials, and conduct appropriate diligence before relying on the provider for key liquidity mandates.'
	}
]

export const GRADE_SCALE_SUMMARY = 'Grades are measured AAA (highest) to CCC (lowest).'
