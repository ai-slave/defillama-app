import { describe, expect, test } from 'vitest'
import { createAnnouncementDismissalToken } from '~/utils/cookies'
import type { AnnouncementRegistry, BannerDefinition } from '../registry'
import { resolveAnnouncement } from '../resolveAnnouncement'

const banner = (id: string, extra: Partial<BannerDefinition> = {}): BannerDefinition => ({
	id,
	version: 'v1',
	render: () => null,
	...extra
})

const registry: AnnouncementRegistry = {
	launch: { ...banner('launch'), until: '2026-10-01' },
	segments: {},
	targeted: {
		yields: banner('verified-apy', { hideForSubscribers: true }),
		llamaai: banner('mobile-app')
	},
	fallback: banner('default')
}

const duringLaunch = Date.parse('2026-09-20')
const afterLaunch = Date.parse('2026-10-05')
const dismissed = (id: string) => createAnnouncementDismissalToken(id, 'v1')
const profile = (...categories: Array<'protocols' | 'chains' | 'yields' | 'llamaai' | 'fees'>) => ({
	interests: categories.map((category, index) => ({ category, score: 1 - index / 10 })),
	segments: []
})

const resolve = (overrides: Partial<Parameters<typeof resolveAnnouncement>[0]>) =>
	resolveAnnouncement({
		registry,
		now: afterLaunch,
		profile: null,
		hasActiveSubscription: false,
		dismissedTokens: [],
		...overrides
	})

describe('resolveAnnouncement', () => {
	test('an open launch window beats targeting for everyone', () => {
		expect(resolve({ now: duringLaunch, profile: profile('yields') })?.banner.id).toBe('launch')
	})

	test('the launch expires on its end date and targeting takes over', () => {
		expect(resolve({ now: Date.parse('2026-10-01'), profile: profile('yields') })?.banner.id).toBe('verified-apy')
	})

	test('a dismissed launch falls through to targeting even inside the window', () => {
		const result = resolve({ now: duringLaunch, profile: profile('llamaai'), dismissedTokens: [dismissed('launch')] })
		expect(result).toMatchObject({ kind: 'targeted', category: 'llamaai' })
	})

	test('categories without a banner are skipped in rank order', () => {
		const result = resolve({ profile: profile('protocols', 'chains', 'yields', 'llamaai') })
		expect(result).toMatchObject({ kind: 'targeted', category: 'yields', banner: { id: 'verified-apy' } })
	})

	test('a reader whose interests have no banner gets the fallback', () => {
		expect(resolve({ profile: profile('protocols', 'chains', 'fees') })).toMatchObject({ kind: 'fallback' })
	})

	test('an unknown profile only considers the launch and fallback', () => {
		expect(resolve({ profile: null })).toMatchObject({ kind: 'fallback' })
		expect(resolve({ profile: { interests: [], segments: [] } })).toMatchObject({ kind: 'fallback' })
	})

	test('a subscriber never sees an upsell they already own', () => {
		const result = resolve({ profile: profile('yields', 'llamaai'), hasActiveSubscription: true })
		expect(result).toMatchObject({ kind: 'targeted', category: 'llamaai' })
	})

	test('a dismissed targeted banner is skipped on the next resolution', () => {
		const result = resolve({ profile: profile('yields', 'llamaai'), dismissedTokens: [dismissed('verified-apy')] })
		expect(result).toMatchObject({ kind: 'targeted', category: 'llamaai' })
	})

	test('dismissal is versioned: an old dismissal does not hide a new version', () => {
		const bumped: AnnouncementRegistry = { ...registry, fallback: { ...banner('default'), version: 'v2' } }
		expect(resolve({ registry: bumped, dismissedTokens: [dismissed('default')] })).toMatchObject({ kind: 'fallback' })
	})

	test('nothing renders when every candidate is dismissed', () => {
		const input = { profile: profile('yields'), dismissedTokens: [dismissed('verified-apy')] }
		expect(resolve(input)).toMatchObject({ kind: 'fallback' })
		expect(resolve({ ...input, dismissedTokens: [...input.dismissedTokens, dismissed('default')] })).toBeNull()
	})
})
