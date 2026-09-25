import { describe, expect, test } from 'vitest'
import { formatClaimProjectStatus, resolveRequestedProjectId } from '../navigation'

const projects = [
	{
		arcticId: 'ee2e1b0a-6618-4e8e-8096-28f6fc959929',
		projectName: 'Ethereum',
		symbol: 'ETH',
		coingeckoId: 'ethereum',
		tgeStatus: 'post' as const,
		disclosureScore: 8.72,
		gradedCount: 13,
		criteriaCount: 13
	},
	{
		arcticId: 'project-pre',
		projectName: 'Upcoming',
		symbol: 'UP',
		coingeckoId: null,
		tgeStatus: 'pre' as const,
		disclosureScore: null,
		gradedCount: 0,
		criteriaCount: 13
	}
]

describe('ClaimTokenProfile', () => {
	test('resolves claim links by Arctic id, CoinGecko id, name, or ticker', () => {
		expect(resolveRequestedProjectId(projects, 'ethereum')).toBe(projects[0].arcticId)
		expect(resolveRequestedProjectId(projects, 'ETH')).toBe(projects[0].arcticId)
		expect(resolveRequestedProjectId(projects, 'project-pre')).toBe('project-pre')
		expect(resolveRequestedProjectId(projects, 'missing')).toBeNull()
	})

	test('labels each claimable project with its listing and disclosure coverage', () => {
		expect(formatClaimProjectStatus(projects[0])).toBe('Listed · 13/13 criteria scored · Disclosure 8.72/10')
		expect(formatClaimProjectStatus(projects[1])).toBe('Pre-TGE · 0/13 criteria scored')
		expect(formatClaimProjectStatus({ ...projects[1], criteriaCount: 0 })).toBe('Pre-TGE · Not scored')
	})
})
