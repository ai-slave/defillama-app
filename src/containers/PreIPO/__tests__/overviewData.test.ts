import { describe, expect, it } from 'vitest'
import type { PreIpoCompanyListItem } from '../api.types'
import { filterPreIpoCompanies, getPreIpoSectors } from '../overviewData'

const companies: PreIpoCompanyListItem[] = [
	{
		id: 'anthropic',
		name: 'Anthropic',
		description: 'AI company',
		website: 'https://anthropic.com',
		sector: 'Artificial Intelligence',
		latestEstimatedValuation: 1,
		latestRaise: 1,
		latestFundingValuation: null,
		latestFundingDate: '2026-08-25',
		lastValuationDate: '2026-08-24',
		totalRaised: 1,
		valuationChange1YPercentage: 0,
		premiumVsLatestFundingPercentage: null
	},
	{
		id: 'commonwealth-fusion',
		name: 'Commonwealth Fusion Systems',
		description: 'Fusion company',
		website: 'https://cfs.energy',
		sector: 'Clean Technology',
		latestEstimatedValuation: null,
		latestRaise: null,
		latestFundingValuation: null,
		latestFundingDate: null,
		lastValuationDate: null,
		totalRaised: null,
		valuationChange1YPercentage: null,
		premiumVsLatestFundingPercentage: null
	}
]

describe('pre-IPO overview data', () => {
	it('returns the producer array when no filters are active', () => {
		expect(filterPreIpoCompanies(companies, '', null)).toBe(companies)
	})

	it('searches name, canonical ID, and sector while applying the sector filter', () => {
		expect(filterPreIpoCompanies(companies, 'fusion', null)).toEqual([companies[1]])
		const aiOnly = new Set(['Artificial Intelligence'])
		expect(filterPreIpoCompanies(companies, 'anthropic', aiOnly)).toEqual([companies[0]])
		expect(filterPreIpoCompanies(companies, 'clean technology', aiOnly)).toEqual([])
		expect(filterPreIpoCompanies(companies, '', new Set())).toEqual([])
	})

	it('deduplicates and sorts sectors', () => {
		expect(getPreIpoSectors(companies)).toEqual(['Artificial Intelligence', 'Clean Technology'])
	})
})
