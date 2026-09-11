import { describe, expect, test } from 'vitest'
import { type Counts, findGrowth, findStale, parseCounts, renderCounts, total } from './lib/compilerBaselineCounts'

const base: Counts = {
	'react/refs': { 'src/a.tsx': 2, 'src/b.tsx': 1 },
	'no-empty': { 'src/c.ts': 1 }
}

describe('findGrowth', () => {
	test('accepts an identical baseline', () => {
		expect(findGrowth(base, base)).toEqual([])
	})

	test('accepts shrinkage: dropped files and lowered counts', () => {
		const head: Counts = { 'react/refs': { 'src/a.tsx': 1 } }
		expect(findGrowth(base, head)).toEqual([])
	})

	test('rejects a new rule/file pair', () => {
		const head: Counts = { ...base, 'react/refs': { ...base['react/refs'], 'src/new.tsx': 1 } }
		expect(findGrowth(base, head)).toEqual(['react/refs  src/new.tsx  0 -> 1'])
	})

	test('rejects a higher count in a file the rule is already suppressed in', () => {
		const head: Counts = { ...base, 'react/refs': { ...base['react/refs'], 'src/a.tsx': 3 } }
		expect(findGrowth(base, head)).toEqual(['react/refs  src/a.tsx  2 -> 3'])
	})

	test('rejects a new rule', () => {
		const head: Counts = { ...base, 'no-var': { 'src/d.ts': 1 } }
		expect(findGrowth(base, head)).toEqual(['no-var  src/d.ts  0 -> 1'])
	})
})

describe('findStale', () => {
	test('reports entries whose debt is gone or reduced', () => {
		const fresh: Counts = { 'react/refs': { 'src/a.tsx': 1 } }
		expect(findStale(base, fresh)).toEqual([
			'no-empty  src/c.ts  1 -> 0',
			'react/refs  src/a.tsx  2 -> 1',
			'react/refs  src/b.tsx  1 -> 0'
		])
	})

	test('is silent when the working tree matches the baseline', () => {
		expect(findStale(base, base)).toEqual([])
	})
})

describe('rendering', () => {
	test('counts round-trip through the sidecar with stable ordering', () => {
		expect(parseCounts(renderCounts(base))).toEqual(base)
		expect(renderCounts(base)).toBe(renderCounts({ 'no-empty': base['no-empty'], 'react/refs': base['react/refs'] }))
	})

	test('counts are file-major with one line per file, so fixing a file touches one line', () => {
		expect(renderCounts(base)).toBe(
			[
				'{',
				'\t"src/a.tsx": {"react/refs":2},',
				'\t"src/b.tsx": {"react/refs":1},',
				'\t"src/c.ts": {"no-empty":1}',
				'}',
				''
			].join('\n')
		)
	})
})

test('totals distinct files across reasons', () => {
	expect(total({ a: { 'x.ts': 2 }, b: { 'x.ts': 1, 'y.ts': 3 } })).toEqual({ rules: 2, files: 2, violations: 6 })
	expect(total({})).toEqual({ rules: 0, files: 0, violations: 0 })
})
