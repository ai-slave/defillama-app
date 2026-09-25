import { describe, expect, test } from 'vitest'
import {
	getDashboardHydrationState,
	isDashboardEditingLocked,
	shouldApplyTrustedDashboard
} from '../dashboardHydrationState'

const settledStream = {
	hasDashboardId: true,
	hasInitialDashboard: true,
	authReady: true,
	streamIsDone: true
} as const

describe('dashboard hydration state', () => {
	test('keeps successful streams on the streamed data path', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasStreamDashboard: true
			})
		).toEqual({
			dashboardReady: true,
			streamDone: true,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})

	test('refetches the trusted config for a seeded page when the settled stream has no dashboard', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasStreamDashboard: false
			})
		).toEqual({
			dashboardReady: true,
			streamDone: true,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: true
		})
	})

	test('keeps source fallbacks closed while a seeded dashboard stream is still active', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				streamIsDone: false,
				hasStreamDashboard: false
			})
		).toEqual({
			dashboardReady: true,
			streamDone: false,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})

	test('unlocks editing only after the trusted config arrives', () => {
		expect(
			isDashboardEditingLocked({
				isReadOnly: false,
				hasDashboardId: true,
				hasCurrentDashboard: true,
				mode: 'edit',
				hasInitialDashboard: true,
				hasTrustedDashboard: false
			})
		).toBe(true)
		expect(
			isDashboardEditingLocked({
				isReadOnly: false,
				hasDashboardId: true,
				hasCurrentDashboard: true,
				mode: 'edit',
				hasInitialDashboard: true,
				hasTrustedDashboard: true
			})
		).toBe(false)
	})

	test('makes a no-seed page ready on the normal config query instead of the seeded fallback', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasInitialDashboard: false,
				hasStreamDashboard: false
			})
		).toEqual({
			dashboardReady: true,
			streamDone: true,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})

	test('keeps everything pending until auth and the stream settle', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasInitialDashboard: false,
				authReady: false,
				streamIsDone: true,
				hasStreamDashboard: false
			})
		).toEqual({
			dashboardReady: false,
			streamDone: false,
			streamHasResolved: false,
			shouldFetchTrustedDashboardFallback: false
		})
	})
})

test.each([
	[true, 3, 2, false],
	[false, 1, 2, false],
	[false, 2, 2, true],
	[false, undefined, 2, true],
	[false, 2, undefined, true]
])('trusted snapshot gate %s %s %s', (hasPendingSave, incomingUpdatedAt, appliedUpdatedAt, expected) => {
	expect(shouldApplyTrustedDashboard({ hasPendingSave, incomingUpdatedAt, appliedUpdatedAt })).toBe(expected)
})
