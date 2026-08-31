import { describe, expect, it, vi } from 'vitest'
import type { RewardsApiRecord } from '../api.types'
import { buildRewardsPageData } from '../queries.server'
import { apiRecord } from './fixtures'

vi.mock('~/utils/telemetry', () => ({ recordDomainEvent: vi.fn() }))

describe('Rewards popularity boundary', () => {
	it('rejects a catalog served by the old producer with omitted project paths', () => {
		const legacy: Partial<RewardsApiRecord> = apiRecord({})
		delete legacy.project_path
		const entries: RewardsApiRecord[] = JSON.parse(JSON.stringify([legacy]))
		expect(() => buildRewardsPageData(entries, {}, { version: 1, startAt: 0, endAt: 1, viewsByPath: {} })).toThrow(
			'Rewards catalog is missing project_path'
		)
	})

	it('shares parent popularity without changing child navigation or CEX suppression', () => {
		const { programs } = buildRewardsPageData(
			[
				apiRecord({ program_id: 'a', defillama_id: 'child', project_path: '/protocol/example' }),
				apiRecord({ program_id: 'b', defillama_id: 'child', project_path: '/protocol/example' }),
				apiRecord({ program_id: 'c', defillama_id: 'cex', project_path: null })
			],
			{ child: { name: 'Example Bridge' }, cex: { name: 'Exchange', cex: true } },
			{ version: 1, startAt: 0, endAt: 1, viewsByPath: { '/protocol/example': 500 } }
		)
		expect(programs.map(({ programId, protocolHref }) => [programId, protocolHref])).toEqual([
			['a', '/protocol/example-bridge'],
			['b', '/protocol/example-bridge'],
			['c', null]
		])
	})
	it('sorts by popularity with alphabetical ties and missing counts last, without returning counts', () => {
		const { programs } = buildRewardsPageData(
			[
				apiRecord({ program_id: 'unresolved', protocol: 'A', project_path: null }),
				apiRecord({ program_id: 'new', protocol: 'B', project_path: '/protocol/new' }),
				apiRecord({ program_id: 'zero', protocol: 'Z', project_path: '/protocol/zero' }),
				apiRecord({ program_id: 'popular-z', protocol: 'Z', project_path: '/protocol/example' }),
				apiRecord({ program_id: 'popular-a', protocol: 'A', project_path: '/protocol/example' })
			],
			{},
			{ version: 1, startAt: 0, endAt: 1, viewsByPath: { '/protocol/example': 500, '/protocol/zero': 0 } }
		)
		expect(programs.map((p) => p.programId)).toEqual(['popular-a', 'popular-z', 'zero', 'unresolved', 'new'])
		expect(programs.every((p) => !('pageViews' in p))).toBe(true)
	})
})
