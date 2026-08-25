import { describe, expect, it } from 'vitest'
import { getSelectedPreIpoSectors } from '../queryState'

const sectors = ['Artificial Intelligence', 'Clean Technology', 'Financial Services']

describe('pre-IPO overview query state', () => {
	it('uses every sector when the URL has no filter', () => {
		expect(getSelectedPreIpoSectors({}, sectors)).toBe(sectors)
	})

	it('resolves explicit includes, exclusions, and deselect all', () => {
		expect(getSelectedPreIpoSectors({ sector: ['Artificial Intelligence', 'Clean Technology'] }, sectors)).toEqual([
			'Artificial Intelligence',
			'Clean Technology'
		])
		expect(getSelectedPreIpoSectors({ excludeSector: 'Financial Services' }, sectors)).toEqual([
			'Artificial Intelligence',
			'Clean Technology'
		])
		expect(getSelectedPreIpoSectors({ sector: 'None' }, sectors)).toEqual([])
	})

	it('canonicalizes duplicate URL values before detecting select all', () => {
		expect(
			getSelectedPreIpoSectors(
				{
					sector: ['Artificial Intelligence', 'Artificial Intelligence', 'Clean Technology']
				},
				sectors
			)
		).toEqual(['Artificial Intelligence', 'Clean Technology'])
	})
})
