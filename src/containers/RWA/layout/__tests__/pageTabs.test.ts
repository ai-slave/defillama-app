import { describe, expect, test } from 'vitest'
import { getRwaPageTabRow } from '../pageTabs'

const labels = (row: ReturnType<typeof getRwaPageTabRow>) => row?.tabs.map((tab) => tab.label)
const current = (row: ReturnType<typeof getRwaPageTabRow>) => row?.tabs.find((tab) => tab.current)?.label

describe('getRwaPageTabRow', () => {
	test('a tree page shows the Assets and Perps section tabs', () => {
		const assets = getRwaPageTabRow('chain', '/rwa/chain/ethereum?groupBy=none', { embedded: false })
		expect(labels(assets)).toEqual(['Assets', 'Perps'])
		expect(current(assets)).toBe('Assets')
		expect(assets?.tabs.map((tab) => tab.href)).toEqual(['/rwa', '/rwa/perps'])

		const perps = getRwaPageTabRow('perpsAsset', '/rwa/perps/asset/gold', { embedded: false })
		expect(current(perps)).toBe('Perps')
	})

	test('a platform page shows its own Information and Assets views, keeping the rest of the URL', () => {
		const row = getRwaPageTabRow('platform', '/rwa/platform/circle?chain=Ethereum', { embedded: false })
		expect(labels(row)).toEqual(['Information', 'Assets'])
		expect(current(row)).toBe('Assets')
		expect(row?.tabs.map((tab) => tab.href)).toEqual([
			'/rwa/platform/circle?chain=Ethereum&view=information',
			'/rwa/platform/circle?chain=Ethereum'
		])
		expect(current(getRwaPageTabRow('platform', '/rwa/platform/circle?view=information', { embedded: false }))).toBe(
			'Information'
		)
	})

	test('an old Compliance link keeps its column set on the way to Information', () => {
		const row = getRwaPageTabRow('platform', '/rwa/platform/circle?view=compliance', { embedded: false })
		expect(current(row)).toBe('Assets')
		expect(row?.tabs[0].href).toBe('/rwa/platform/circle?view=information&table=compliance')
	})

	test('a venue page shows its own Information and Markets views', () => {
		const row = getRwaPageTabRow('venue', '/rwa/perps/venue/xyz?view=information#top', { embedded: false })
		expect(labels(row)).toEqual(['Information', 'Markets'])
		expect(current(row)).toBe('Information')
		expect(row?.tabs.map((tab) => tab.href)).toEqual(['/rwa/perps/venue/xyz?view=information', '/rwa/perps/venue/xyz'])
	})

	test('a page embedded in a protocol tab has no row of its own', () => {
		expect(getRwaPageTabRow('platform', '/protocol/rwa/circle', { embedded: true })).toBeNull()
	})
})
