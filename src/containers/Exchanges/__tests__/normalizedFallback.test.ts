import { describe, expect, test } from 'vitest'
import { normalizedOrReported } from '../directoryColumns'
import type { ExchangeDirectoryRowModel } from '../models'

const row = (patch: { normalized?: number | null; volume?: number | null }): ExchangeDirectoryRowModel =>
	({
		segments: { linear_perp: { volume24h: patch.volume ?? null } },
		normalizedVolume: { linear_perp: patch.normalized == null ? null : { normalized: patch.normalized } }
	}) as unknown as ExchangeDirectoryRowModel

describe('normalizedOrReported', () => {
	test('prefers the normalized figure and does not mark it', () => {
		expect(normalizedOrReported(row({ normalized: 70, volume: 100 }), 'linear_perp')).toEqual({
			value: 70,
			reported: false
		})
	})

	// Normalized volume is dropped entirely for a segment we captured no depth for.
	// A blank cell hid real activity, so reported volume stands in.
	test('falls back to reported volume when there is no book to normalize against', () => {
		expect(normalizedOrReported(row({ normalized: null, volume: 100 }), 'linear_perp')).toEqual({
			value: 100,
			reported: true
		})
	})

	// The whole point of the column is that it is not the venue's own number. A
	// fallback that did not announce itself would quietly undo that.
	test('always flags the fallback, including when there is nothing to show either', () => {
		expect(normalizedOrReported(row({ normalized: null, volume: null }), 'linear_perp')).toEqual({
			value: null,
			reported: true
		})
	})

	test('treats an untracked segment as having nothing rather than as a fallback value', () => {
		const spotOnly = { segments: {}, normalizedVolume: null } as unknown as ExchangeDirectoryRowModel
		expect(normalizedOrReported(spotOnly, 'linear_perp')).toEqual({ value: null, reported: true })
	})
})
