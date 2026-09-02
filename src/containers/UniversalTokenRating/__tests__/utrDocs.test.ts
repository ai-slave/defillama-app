import { describe, expect, it } from 'vitest'
import type { UtrScoringConfig } from '../types'
import { buildUtrDocChapters } from '../utrDocs'

const gradingScale = [
	{ min: 8, grade: 'AAA', interpretation: 'Exceptional' },
	{ min: 6, grade: 'AA', interpretation: 'Excellent' },
	{ min: null, grade: 'CCC', interpretation: 'Insufficient' }
]

const config: UtrScoringConfig = {
	version: 18,
	grading: {
		disclosure: { description: 'Live disclosure description', scale: gradingScale },
		performance: { description: 'Live performance description', scale: gradingScale },
		overall: {
			description: 'Live overall description',
			scale: [
				{ min: 60, grade: 'AAA', interpretation: 'Highest confidence' },
				{ min: 40, grade: 'AA', interpretation: 'Very high confidence' },
				{ min: 20, grade: 'B', interpretation: 'Low confidence' },
				{ min: null, grade: 'CCC', interpretation: 'Very low confidence' }
			]
		}
	},
	disclosure: {
		categories: [
			{
				key: 'core_contributors',
				label: 'Core Contributors',
				criteria: [
					{
						key: 'team_identities',
						label: 'Dynamic Team Label',
						weight: 0.05,
						applicability: 'both',
						evaluationType: null,
						ignoreBlacklistedExchanges: null,
						expression: null,
						bands: [],
						definition: 'Definition',
						rubric: ['Rubric']
					},
					{
						key: 'roles',
						label: 'Dynamic Roles Label',
						weight: 0.06,
						applicability: 'both',
						evaluationType: null,
						ignoreBlacklistedExchanges: null,
						expression: null,
						bands: [],
						definition: null,
						rubric: []
					}
				]
			}
		]
	},
	performance: {
		categories: [
			{
				key: 'total_market',
				label: 'Total Market',
				criteria: [
					{
						key: 'post_volume',
						label: 'Post-TGE Volume',
						weight: 0.1,
						applicability: 'postTge',
						evaluationType: null,
						ignoreBlacklistedExchanges: null,
						expression: null,
						bands: [],
						definition: null,
						rubric: []
					},
					{
						key: 'pre_fundraising',
						label: 'Pre-TGE Fundraising',
						weight: 0.15,
						applicability: 'preTge',
						evaluationType: null,
						ignoreBlacklistedExchanges: null,
						expression: null,
						bands: [],
						definition: null,
						rubric: []
					}
				]
			}
		]
	},
	exchanges: {
		tier1: [{ id: 'binance', displayName: 'Binance Live', logoUrl: null }],
		tier2: [{ id: 'kraken', displayName: 'Kraken Live', logoUrl: null }]
	}
}

function chapterText(configValue: UtrScoringConfig | null): string {
	return JSON.stringify(buildUtrDocChapters(configValue))
}

describe('buildUtrDocChapters', () => {
	it('builds all seven Figma chapters with live grading ranges and interpretations', () => {
		const chapters = buildUtrDocChapters(config)
		const text = JSON.stringify(chapters)

		expect(chapters).toHaveLength(7)
		expect(chapters.map((chapter) => chapter.id)).toEqual([
			'preface',
			'overview',
			'disclosure-axis',
			'performance-axis',
			'grading-methodology',
			'appendix',
			'glossary'
		])
		expect(text).toContain('≥60.00')
		expect(text).toContain('40.00–&lt;60.00'.replace('&lt;', '<'))
		expect(text).toContain('<20.00')
		expect(text).toContain('Live overall description')
		expect(text).not.toContain('Token Visibility Standard')
		expect(text).not.toContain('TVS')
	})

	it('uses API order, dynamic category totals, and pre/post-TGE applicability groups', () => {
		const text = chapterText(config)

		expect(text).toContain('Dynamic Team Label')
		expect(text.indexOf('Dynamic Team Label')).toBeLessThan(text.indexOf('Dynamic Roles Label'))
		expect(text).toContain('11.00%')
		expect(text).toContain('Post-TGE Criteria')
		expect(text).toContain('Post-TGE Volume')
		expect(text).toContain('10.00%')
		expect(text).toContain('Pre-TGE Criteria')
		expect(text).toContain('Pre-TGE Fundraising')
		expect(text).toContain('15.00%')
		expect(text).toContain('Binance Live')
		expect(text).toContain('active scoring configuration')
		expect(text).not.toContain('final Performance score of 7.91')
		expect(text).not.toContain('Market Makers (category weight: 21%)')
		expect(text).not.toContain('carry a null or provisional score')
		expect(text).toContain('fully diluted valuation is at least $2.5 billion')
	})

	it('keeps prose but marks dynamic tables unavailable when configuration cannot be loaded', () => {
		const chapters = buildUtrDocChapters(null)
		const text = JSON.stringify(chapters)

		expect(chapters).toHaveLength(7)
		expect(text).toContain('Forgd')
		expect(text).toContain('Scoring configuration is temporarily unavailable.')
		expect(text).not.toContain('82.50 – 100.00')
	})
})
