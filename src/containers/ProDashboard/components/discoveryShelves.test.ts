import { expect, test } from 'vitest'
import { dedupeShelves, DISCOVERY_RAIL_SIZE } from './discoveryShelves'

const dashboard = (id: string) => ({ id })

test('a dashboard stays only in the first shelf that claims it', () => {
	const [trending, popular, recent] = dedupeShelves([
		{ key: 'trending', dashboards: [dashboard('a'), dashboard('b')] },
		{ key: 'popular', dashboards: [dashboard('b'), dashboard('c')] },
		{ key: 'recent', dashboards: [dashboard('a'), dashboard('b'), dashboard('c')] }
	])
	expect(trending.dashboards.map((entry) => entry.id)).toEqual(['a', 'b'])
	expect(popular.dashboards.map((entry) => entry.id)).toEqual(['c'])
	expect(recent.dashboards).toEqual([])
})

test('a shelf of twelve is cut to the rail size and releases the rest to the next shelf', () => {
	const twelve = Array.from({ length: 12 }, (_, index) => dashboard(`d${index}`))
	const [first, second] = dedupeShelves([
		{ key: 'first', dashboards: twelve },
		{ key: 'second', dashboards: twelve }
	])
	expect(first.dashboards).toHaveLength(DISCOVERY_RAIL_SIZE)
	expect(first.dashboards.map((entry) => entry.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'])
	expect(second.dashboards.map((entry) => entry.id)).toEqual(['d8', 'd9', 'd10', 'd11'])
})

test('a shelf that keeps duplicates shows its own order even when earlier shelves claimed the same dashboards', () => {
	const [trending, recent] = dedupeShelves([
		{ key: 'trending', dashboards: [dashboard('a'), dashboard('b')] },
		{ key: 'recent', dashboards: [dashboard('b'), dashboard('a'), dashboard('c')], keepDuplicates: true }
	])
	expect(trending.dashboards.map((entry) => entry.id)).toEqual(['a', 'b'])
	expect(recent.dashboards.map((entry) => entry.id)).toEqual(['b', 'a', 'c'])
})
