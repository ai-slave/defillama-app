import { describe, expect, it } from 'vitest'
import { applyLogScaleToYAxes } from '../logScale'

describe('applyLogScaleToYAxes', () => {
	it('leaves axes untouched when logScale is off', () => {
		const axes = [{ type: 'value', min: 0 }]
		expect(applyLogScaleToYAxes(axes, false, [0])).toBe(axes)
	})

	it('sets type=log and drops the min/max baseline on eligible axes', () => {
		const axes = [{ type: 'value', min: 0, max: 100, position: 'left' }]
		const out = applyLogScaleToYAxes(axes, true, [0])
		expect(out[0]).toEqual({ type: 'log', position: 'left' })
		expect(out[0]).not.toHaveProperty('min')
		expect(out[0]).not.toHaveProperty('max')
	})

	it('only log-scales eligible axis indices, leaving ineligible ones linear', () => {
		const axes = [
			{ type: 'value', min: 0, position: 'left' },
			{ type: 'value', min: 0, position: 'right' }
		]
		const out = applyLogScaleToYAxes(axes, true, [0]) // axis 1 has zero/negative values → not eligible
		expect(out[0].type).toBe('log')
		expect(out[1]).toEqual({ type: 'value', min: 0, position: 'right' })
	})

	it('is a no-op when nothing is eligible', () => {
		const axes = [{ type: 'value', min: 0 }]
		expect(applyLogScaleToYAxes(axes, true, [])).toEqual(axes)
	})
})
