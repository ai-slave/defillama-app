import { describe, expect, test } from 'vitest'
import { collapseTrend, resolveApy } from '../apy'
import type { ApyWindows, IntrinsicApy, Trend } from '../types'

function windows(base: number | null, reward: number | null, total: number | null): ApyWindows {
	const value = { base, reward, total }
	return { current: value, avg_7d: value, avg_30d: value }
}

function intrinsic(base: number | null): IntrinsicApy {
	const value = { base }
	return {
		apy: { current: value, avg_7d: value, avg_30d: value },
		source_pool: { id: 'source', pool_token: null, symbol: 'stETH' }
	}
}

describe('resolveApy', () => {
	test('keeps intrinsic APY when every selected primary component is null', () => {
		expect(resolveApy(windows(null, null, null), intrinsic(0.5), 'current', ['base', 'intrinsic'])).toEqual({
			base: null,
			reward: null,
			intrinsic: 0.5,
			total: 0.5
		})
	})

	test('keeps explicit primary zero while adding intrinsic APY', () => {
		expect(resolveApy(windows(0, null, 0), intrinsic(0.5), 'current', ['base', 'reward', 'intrinsic']).total).toBe(0.5)
	})

	test('returns no APY only when every selected component is null', () => {
		expect(resolveApy(windows(null, null, null), null, 'current', ['base', 'reward', 'intrinsic']).total).toBeNull()
	})

	test('uses the served base-reward total instead of recomputing it', () => {
		expect(resolveApy(windows(2, 1, 2.9999), null, 'current', ['base', 'reward']).total).toBe(2.9999)
	})
})

describe('collapseTrend', () => {
	const split: Trend = {
		id: 'pool',
		start_date: '2026-01-01',
		end_date: '2026-01-03',
		base: [null, 0, 2],
		reward: [1, null, null],
		intrinsic: [null, 0.5, null]
	}

	test('keeps a point when any selected component is known', () => {
		expect(collapseTrend(split, ['base', 'reward', 'intrinsic'])).toEqual([1, 0.5, 2])
	})

	test('keeps gaps when every selected component is null', () => {
		expect(collapseTrend(split, ['base'])).toEqual([null, 0, 2])
	})

	test('uses the unattributable total as the trend spine', () => {
		const unsplit: Trend = {
			id: 'pool',
			start_date: '2026-01-01',
			end_date: '2026-01-02',
			total: [3, null],
			intrinsic: [null, 0.5]
		}
		expect(collapseTrend(unsplit, ['base', 'intrinsic'])).toEqual([3, 0.5])
	})
})
