import { describe, expect, it } from 'vitest'
import { chartToDataset } from './transform'

describe('chartToDataset', () => {
	it('guards broad date labels and zero-fills a missing parallel value', () => {
		const dataset = chartToDataset({
			dates: ['Total', '2026-01-01'],
			series: [{ name: 'Revenue', data: [10] }]
		})

		expect(dataset).toEqual({
			dimensions: ['timestamp', 'Revenue'],
			source: [[1_767_225_600_000, 0]]
		})
	})
})
