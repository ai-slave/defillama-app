import { describe, expect, it } from 'vitest'
import { applyConfiguredYAxisScale, applyLogScaleToYAxes, getZeroBaselineYAxisMin } from './logScale'
import type { MultiSeriesYAxisOption } from './types'

describe('applyConfiguredYAxisScale', () => {
	it('removes the implicit zero baseline when a caller opts into axis scaling', () => {
		expect(
			applyConfiguredYAxisScale({ type: 'value', min: getZeroBaselineYAxisMin, scale: true }, { scale: true })
		).toEqual({ type: 'value', scale: true })
	})

	it('preserves explicit caller minima on scaled axes', () => {
		expect(applyConfiguredYAxisScale({ min: 10, scale: true }, { min: 10, scale: true })).toEqual({
			min: 10,
			scale: true
		})
	})

	it('applies scaling intent independently to each configured axis', () => {
		expect(
			applyConfiguredYAxisScale(
				[{ min: getZeroBaselineYAxisMin, scale: true }, { min: getZeroBaselineYAxisMin }],
				[{ scale: true }, {}]
			)
		).toEqual([{ scale: true }, { min: getZeroBaselineYAxisMin }])
	})
})

describe('applyLogScaleToYAxes', () => {
	it('leaves axes untouched when logScale is off', () => {
		const axes: MultiSeriesYAxisOption[] = [{ type: 'value', min: 0 }]
		expect(applyLogScaleToYAxes(axes, false, [0])).toBe(axes)
	})

	it('sets type=log, drops a zero baseline, and keeps a positive maximum', () => {
		const axes: MultiSeriesYAxisOption[] = [{ type: 'value', min: 0, max: 100, position: 'left' }]
		const out = applyLogScaleToYAxes(axes, true, [0])
		expect(out[0]).toEqual({ type: 'log', max: 100, position: 'left' })
		expect(out[0]).not.toHaveProperty('min')
	})

	it('drops the shared zero-baseline callback from eligible log axes', () => {
		const out = applyLogScaleToYAxes([{ type: 'value', min: getZeroBaselineYAxisMin }], true, [0])

		expect(out[0]).toEqual({ type: 'log' })
	})

	it('preserves valid explicit and data-driven log bounds', () => {
		const axes: MultiSeriesYAxisOption[] = [
			{ type: 'value', min: 10, max: 1_000 },
			{ type: 'value', min: 'dataMin', max: 'dataMax' }
		]
		expect(applyLogScaleToYAxes(axes, true, [0, 1])).toEqual([
			{ type: 'log', min: 10, max: 1_000 },
			{ type: 'log', min: 'dataMin', max: 'dataMax' }
		])
	})

	it('only log-scales eligible axis indices, leaving ineligible ones linear', () => {
		const axes: MultiSeriesYAxisOption[] = [
			{ type: 'value', min: 0, position: 'left' },
			{ type: 'value', min: 0, position: 'right' }
		]
		const out = applyLogScaleToYAxes(axes, true, [0]) // axis 1 has zero/negative values → not eligible
		expect(out[0].type).toBe('log')
		expect(out[1]).toEqual({ type: 'value', min: 0, position: 'right' })
	})

	it('is a no-op when nothing is eligible', () => {
		const axes: MultiSeriesYAxisOption[] = [{ type: 'value', min: 0 }]
		expect(applyLogScaleToYAxes(axes, true, [])).toEqual(axes)
	})
})
