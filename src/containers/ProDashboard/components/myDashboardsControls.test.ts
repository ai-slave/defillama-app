import { expect, test } from 'vitest'
import type { Dashboard } from '../dashboardTypes'
import {
	areMyDashboardsControlsActive,
	DEFAULT_MY_DASHBOARDS_CONTROLS,
	filterAndSortMyDashboards,
	type MyDashboardsControlsState
} from './myDashboardsControls'

function makeDashboard(dashboard: Partial<Dashboard> & { id: string; name: string }): Dashboard {
	const { id, name, ...rest } = dashboard
	return {
		id,
		data: { items: [], dashboardName: name },
		created: '2026-01-01T00:00:00Z',
		updated: '2026-01-01T00:00:00Z',
		...rest
	} as Dashboard
}

const dashboards = [
	makeDashboard({
		id: 'audit',
		name: 'Zebra audit board',
		visibility: 'private',
		tags: ['Security'],
		viewCount: 4,
		editedAt: '2026-03-01T00:00:00Z'
	}),
	makeDashboard({
		id: 'yields',
		name: 'Alpha yields',
		visibility: 'public',
		description: 'Tracks the audit of pool APYs',
		tags: ['Yields'],
		viewCount: 90,
		editedAt: '2026-02-01T00:00:00Z'
	}),
	makeDashboard({
		id: 'fees',
		name: 'Middle fees',
		visibility: 'public',
		tags: ['Audit trail'],
		viewCount: 12,
		editedAt: '2026-04-01T00:00:00Z'
	})
]

const controls = (state: Partial<MyDashboardsControlsState>): MyDashboardsControlsState => ({
	...DEFAULT_MY_DASHBOARDS_CONTROLS,
	...state
})

test('search covers the name, description and tags without regard to case', () => {
	expect(filterAndSortMyDashboards(dashboards, controls({ query: 'AUDIT' })).map((entry) => entry.id)).toEqual([
		'fees',
		'audit',
		'yields'
	])
	expect(filterAndSortMyDashboards(dashboards, controls({ query: ' yields ' })).map((entry) => entry.id)).toEqual([
		'yields'
	])
	expect(filterAndSortMyDashboards(dashboards, controls({ query: 'nothing here' }))).toEqual([])
})

test('sorting runs by edit time, name and views', () => {
	expect(filterAndSortMyDashboards(dashboards, controls({})).map((entry) => entry.id)).toEqual([
		'fees',
		'audit',
		'yields'
	])
	expect(filterAndSortMyDashboards(dashboards, controls({ sort: 'name' })).map((entry) => entry.id)).toEqual([
		'yields',
		'fees',
		'audit'
	])
	expect(filterAndSortMyDashboards(dashboards, controls({ sort: 'views' })).map((entry) => entry.id)).toEqual([
		'yields',
		'fees',
		'audit'
	])
})

test('visibility treats a missing value as private and combines with search', () => {
	expect(filterAndSortMyDashboards(dashboards, controls({ visibility: 'private' })).map((entry) => entry.id)).toEqual([
		'audit'
	])
	expect(filterAndSortMyDashboards(dashboards, controls({ visibility: 'public' })).map((entry) => entry.id)).toEqual([
		'fees',
		'yields'
	])
	const withoutVisibility = [makeDashboard({ id: 'draft', name: 'Draft board' })]
	expect(filterAndSortMyDashboards(withoutVisibility, controls({ visibility: 'private' }))).toHaveLength(1)
	expect(filterAndSortMyDashboards(withoutVisibility, controls({ visibility: 'public' }))).toHaveLength(0)
	expect(
		filterAndSortMyDashboards(dashboards, controls({ visibility: 'public', query: 'audit' })).map((entry) => entry.id)
	).toEqual(['fees', 'yields'])
})

test('the defaults are not an active control set', () => {
	expect(areMyDashboardsControlsActive(DEFAULT_MY_DASHBOARDS_CONTROLS)).toBe(false)
	expect(areMyDashboardsControlsActive(controls({ query: '   ' }))).toBe(false)
	expect(areMyDashboardsControlsActive(controls({ query: 'a' }))).toBe(true)
	expect(areMyDashboardsControlsActive(controls({ sort: 'name' }))).toBe(true)
	expect(areMyDashboardsControlsActive(controls({ visibility: 'private' }))).toBe(true)
})
