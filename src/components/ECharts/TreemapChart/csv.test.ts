import { describe, expect, it } from 'vitest'
import { buildTreemapCsvDataset } from './csv'

describe('buildTreemapCsvDataset', () => {
	it('exports every leaf once without duplicating parent totals', () => {
		expect(
			buildTreemapCsvDataset([
				{
					name: 'Parent',
					value: [30, null, null],
					children: [
						{ name: 'Alpha', path: 'Root/Parent/Alpha', value: [10, null, null] },
						{ name: 'Beta', value: [20, null, null] }
					]
				}
			])
		).toEqual({
			dimensions: ['Path', 'Name', 'Value'],
			source: [
				['Root/Parent/Alpha', 'Alpha', 10],
				['Parent/Beta', 'Beta', 20]
			]
		})
	})
})
