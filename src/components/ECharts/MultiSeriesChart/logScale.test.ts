import { describe, expect, it } from 'vitest'
import { applyConfiguredYAxisScale, applyLogScaleToYAxes, getZeroBaselineYAxisMin, mergeYAxisOption } from './logScale'
import type { MultiSeriesYAxisOption, MultiSeriesYAxisOverride } from './types'

const valueYAxisOverride = { type: 'value', scale: true } satisfies MultiSeriesYAxisOverride
const logYAxisOverride = { type: 'log', logBase: 2 } satisfies MultiSeriesYAxisOverride

// @ts-expect-error `scale` is exclusive to value axes.
const invalidLogYAxisOverride = { type: 'log', scale: true } satisfies MultiSeriesYAxisOverride

// @ts-expect-error `logBase` is exclusive to log axes.
const invalidValueYAxisOverride = { type: 'value', logBase: 2 } satisfies MultiSeriesYAxisOverride

void invalidLogYAxisOverride
void invalidValueYAxisOverride

describe('MultiSeriesYAxisOverride', () => {
	it('keeps value-only and log-only settings in separate variants', () => {
		expect(valueYAxisOverride).toEqual({ type: 'value', scale: true })
		expect(logYAxisOverride).toEqual({ type: 'log', logBase: 2 })
	})
})

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

describe('mergeYAxisOption', () => {
	it('uses explicit undefined to clear an inherited minimum', () => {
		expect(mergeYAxisOption({ min: getZeroBaselineYAxisMin }, { min: undefined })).toEqual({})
	})

	it('preserves an explicit scaled-axis request', () => {
		expect(mergeYAxisOption({ min: getZeroBaselineYAxisMin }, { scale: true })).toEqual({
			min: getZeroBaselineYAxisMin,
			scale: true
		})
	})

	it('removes value-only settings when an override selects a log axis', () => {
		expect(mergeYAxisOption({ type: 'value', scale: true }, { type: 'log', logBase: 2 })).toEqual({
			type: 'log',
			logBase: 2
		})
	})

	it('removes log-only settings when an override selects a value axis', () => {
		expect(mergeYAxisOption({ type: 'log', logBase: 2 }, { type: 'value', scale: true })).toEqual({
			type: 'value',
			scale: true
		})
	})
})

describe('applyLogScaleToYAxes', () => {
	it('leaves axes untouched when logScale is off', () => {
		const axes: MultiSeriesYAxisOption[] = [{ type: 'value', min: 0 }]
		expect(applyLogScaleToYAxes(axes, false, [0])).toBe(axes)
	})

	it('sets type=log, drops a zero baseline, and keeps a positive maximum', () => {
		const axes: MultiSeriesYAxisOption[] = [{ type: 'value', min: 0, max: 100, position: 'left', scale: true }]
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
