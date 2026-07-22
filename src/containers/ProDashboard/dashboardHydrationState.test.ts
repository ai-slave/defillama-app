import { describe, expect, it } from 'vitest'
import { getDashboardHydrationState, isDashboardEditingLocked } from './dashboardHydrationState'

const settledStream = {
	hasDashboardId: true,
	hasInitialDashboard: true,
	authReady: true,
	streamIsDone: true
} as const

describe('dashboard hydration state', () => {
	it('keeps successful public streams on the streamed data path', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasStreamDashboard: true,
				mode: 'view'
			})
		).toEqual({
			dashboardReady: true,
			streamDone: true,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})

	it('opens source fallbacks for a public seed when the settled stream has no dashboard', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasStreamDashboard: false,
				mode: 'view'
			})
		).toEqual({
			dashboardReady: true,
			streamDone: true,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})

	it('keeps source fallbacks closed while a seeded dashboard stream is still active', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				streamIsDone: false,
				hasStreamDashboard: false,
				mode: 'view'
			})
		).toEqual({
			dashboardReady: true,
			streamDone: false,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})

	it('requests trusted edit config after a missing stream dashboard and unlocks only after it arrives', () => {
		const state = getDashboardHydrationState({
			...settledStream,
			hasStreamDashboard: false,
			mode: 'edit'
		})

		expect(state.shouldFetchTrustedDashboardFallback).toBe(true)
		expect(state.streamDone).toBe(true)
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

	it('keeps a no-seed view authorization failure blocked', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasInitialDashboard: false,
				hasStreamDashboard: false,
				mode: 'view'
			})
		).toEqual({
			dashboardReady: false,
			streamDone: false,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})

	it('opens only the trusted config fallback for a no-seed edit failure', () => {
		expect(
			getDashboardHydrationState({
				...settledStream,
				hasInitialDashboard: false,
				hasStreamDashboard: false,
				mode: 'edit'
			})
		).toEqual({
			dashboardReady: true,
			streamDone: true,
			streamHasResolved: true,
			shouldFetchTrustedDashboardFallback: false
		})
	})
})
