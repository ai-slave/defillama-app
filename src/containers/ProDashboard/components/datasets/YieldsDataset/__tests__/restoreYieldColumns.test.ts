import { expect, test } from 'vitest'
import { restoreYieldColumns } from '../useYieldsTable'

test('a dashboard saved without Pool opens with Pool visible and first, so the panel and CSV list it', () => {
	const restored = restoreYieldColumns(['tvl', 'apy'], { pool: false, tvl: true, apy: true, project: false })

	expect(restored.columnOrder).toEqual(['pool', 'tvl', 'apy'])
	expect(restored.columnVisibility.pool).toBe(true)
	expect(restored.columnVisibility.project).toBe(false)
	expect(restored.preset).toBe(null)
})

test('a saved order that places Pool elsewhere keeps that position', () => {
	expect(restoreYieldColumns(['tvl', 'pool', 'apy'], { pool: true, tvl: true, apy: true }).columnOrder).toEqual([
		'tvl',
		'pool',
		'apy'
	])
})
