import { describe, expect, it } from 'vitest'
import { getPreIpoSitemapRoutes, resolvePreIpoCompanyId } from '../server/routes'

const metadata = {
	preIpoCompanyIds: ['anthropic', 'commonwealth-fusion'],
	preIpoCompanyIdsSet: new Set(['anthropic', 'commonwealth-fusion'])
}

describe('pre-IPO routes', () => {
	it('resolves canonical IDs case-insensitively and rejects unknown companies', () => {
		expect(resolvePreIpoCompanyId('Anthropic', metadata)).toBe('anthropic')
		expect(resolvePreIpoCompanyId('unknown', metadata)).toBeNull()
	})

	it('builds every company sitemap route from metadata', () => {
		expect(getPreIpoSitemapRoutes(metadata)).toEqual(['pre-ipo/anthropic', 'pre-ipo/commonwealth-fusion'])
	})
})
