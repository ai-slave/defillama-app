import { describe, expect, test } from 'vitest'
import { decodeDownloadConfig } from '~/containers/Downloads/urlState'
import type { SqlChartConfig } from '../../../types'
import { buildSqlStudioHref } from '../SqlQueryView'

describe('buildSqlStudioHref', () => {
	test('opens SQL Studio with the query, sources, and chart configuration', () => {
		const config = {
			id: 'sql-1',
			kind: 'sql',
			query: {
				sql: 'SELECT * FROM protocols',
				tableSources: [{ kind: 'dataset', slug: 'protocols' }]
			},
			chart: {
				chartType: 'scatter',
				xCol: 'fees',
				yCols: ['revenue'],
				splitByCol: null,
				stackMode: 'off',
				rightAxisCols: [],
				seriesKinds: {},
				seriesColors: {},
				numberFormat: 'currency'
			}
		} satisfies SqlChartConfig

		const href = buildSqlStudioHref(config)
		const url = new URL(href, 'https://defillama.com')
		const decoded = decodeDownloadConfig(Object.fromEntries(url.searchParams.entries()))

		expect(url.pathname).toBe('/downloads')
		expect(url.searchParams.get('mode')).toBe('sql')
		expect(decoded).toMatchObject({
			kind: 'query',
			sql: config.query.sql,
			tables: config.query.tableSources,
			chartConfig: { chartType: 'scatter', xCol: 'fees', yCols: ['revenue'] }
		})
	})
})
