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

	test('a reader with no interests, or none with a banner, gets the fallback', () => {
		expect(resolve({ profile: profile('protocols', 'chains', 'fees') })).toMatchObject({ kind: 'fallback' })
		expect(resolve({ profile: null })).toMatchObject({ kind: 'fallback' })
		expect(resolve({ profile: { interests: [], segments: [] } })).toMatchObject({ kind: 'fallback' })
	})

	test('an account segment with a banner outranks browsing interests', () => {
		const withSegment: AnnouncementRegistry = { ...registry, segments: { fund_institutional: banner('enterprise') } }
		const result = resolve({
			registry: withSegment,
			profile: { ...profile('yields'), segments: ['fund_institutional'] }
		})
		expect(result).toMatchObject({ kind: 'segment', segment: 'fund_institutional', banner: { id: 'enterprise' } })
	})

	test('a segment banner defers to a listed interest the reader has', () => {
		const withSegment: AnnouncementRegistry = {
			...registry,
			segments: { fund_institutional: { ...banner('enterprise'), deferTo: ['yields'] } }
		}
		const fund = (...categories: Array<'protocols' | 'yields'>) => ({
			...profile(...categories),
			segments: ['fund_institutional' as const]
		})
		expect(resolve({ registry: withSegment, profile: fund('protocols', 'yields') })).toMatchObject({
			kind: 'targeted',
			category: 'yields',
			banner: { id: 'verified-apy' }
		})
		expect(resolve({ registry: withSegment, profile: fund('protocols') })).toMatchObject({
			kind: 'segment',
			banner: { id: 'enterprise' }
		})
		// Verified APY is hidden from subscribers, so a subscribed fund keeps the segment banner.
		expect(
			resolve({ registry: withSegment, profile: fund('protocols', 'yields'), hasActiveSubscription: true })
		).toMatchObject({ kind: 'segment', banner: { id: 'enterprise' } })
	})

	test('a segment without a banner falls through to browsing interests', () => {
		const result = resolve({ profile: { ...profile('yields'), segments: ['university'] } })
		expect(result).toMatchObject({ kind: 'targeted', category: 'yields' })
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
