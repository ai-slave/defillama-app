import { describe, expect, test } from 'vitest'
import { applyConfiguredYAxisScale, applyLogScaleToYAxes, getZeroBaselineYAxisMin, mergeYAxisOption } from './logScale'
import type { MultiSeriesYAxisOption, MultiSeriesYAxisOverride } from './types'

const valueYAxisOverride = { type: 'value', scale: true } satisfies MultiSeriesYAxisOverride
const logYAxisOverride = { type: 'log', logBase: 2 } satisfies MultiSeriesYAxisOverride

// @ts-expect-error `scale` is exclusive to value axes.
const invalidLogYAxisOverride = { type: 'log', scale: true } satisfies MultiSeriesYAxisOverride

// @ts-expect-error `logBase` is exclusive to log axes.
const invalidValueYAxisOverride = { type: 'value', logBase: 2 } satisfies MultiSeriesYAxisOverride

// Compile-time only: `bun run test:typecheck` fails if either variant accepts the other's settings.
void valueYAxisOverride
void logYAxisOverride
void invalidLogYAxisOverride
void invalidValueYAxisOverride

describe('applyConfiguredYAxisScale', () => {
	test('removes the implicit zero baseline when a caller opts into axis scaling', () => {
		expect(
			applyConfiguredYAxisScale({ type: 'value', min: getZeroBaselineYAxisMin, scale: true }, { scale: true })
		).toEqual({ type: 'value', scale: true })
	})

	test('preserves explicit caller minima on scaled axes', () => {
		expect(applyConfiguredYAxisScale({ min: 10, scale: true }, { min: 10, scale: true })).toEqual({
			min: 10,
			scale: true
		})
	})

	test('applies scaling intent independently to each configured axis', () => {
		expect(
			applyConfiguredYAxisScale(
				[{ min: getZeroBaselineYAxisMin, scale: true }, { min: getZeroBaselineYAxisMin }],
				[{ scale: true }, {}]
			)
		).toEqual([{ scale: true }, { min: getZeroBaselineYAxisMin }])
	})
})

describe('mergeYAxisOption', () => {
	test('uses explicit undefined to clear an inherited minimum', () => {
		expect(mergeYAxisOption({ min: getZeroBaselineYAxisMin }, { min: undefined })).toEqual({})
	})

	test('preserves an explicit scaled-axis request', () => {
		expect(mergeYAxisOption({ min: getZeroBaselineYAxisMin }, { scale: true })).toEqual({
			min: getZeroBaselineYAxisMin,
			scale: true
		})
	})

	test('removes value-only settings when an override selects a log axis', () => {
		expect(mergeYAxisOption({ type: 'value', scale: true }, { type: 'log', logBase: 2 })).toEqual({
			type: 'log',
			logBase: 2
		})
	})

	test('removes log-only settings when an override selects a value axis', () => {
		expect(mergeYAxisOption({ type: 'log', logBase: 2 }, { type: 'value', scale: true })).toEqual({
			type: 'value',
			scale: true
		})
	})
})

describe('applyLogScaleToYAxes', () => {
	test('leaves axes untouched when logScale is off', () => {
		const axes: Array<MultiSeriesYAxisOption> = [{ type: 'value', min: 0 }]
		expect(applyLogScaleToYAxes(axes, false, [0])).toBe(axes)
	})

	test('sets type=log, drops a zero baseline, and keeps a positive maximum', () => {
		const axes: Array<MultiSeriesYAxisOption> = [{ type: 'value', min: 0, max: 100, position: 'left', scale: true }]
		const out = applyLogScaleToYAxes(axes, true, [0])
		expect(out[0]).toEqual({ type: 'log', max: 100, position: 'left' })
		expect(out[0]).not.toHaveProperty('min')
	})

	test('drops the shared zero-baseline callback from eligible log axes', () => {
		const out = applyLogScaleToYAxes([{ type: 'value', min: getZeroBaselineYAxisMin }], true, [0])

		expect(out[0]).toEqual({ type: 'log' })
	})

	test('preserves valid explicit and data-driven log bounds', () => {
		const axes: Array<MultiSeriesYAxisOption> = [
			{ type: 'value', min: 10, max: 1000 },
			{ type: 'value', min: 'dataMin', max: 'dataMax' }
		]
		expect(applyLogScaleToYAxes(axes, true, [0, 1])).toEqual([
			{ type: 'log', min: 10, max: 1000 },
			{ type: 'log', min: 'dataMin', max: 'dataMax' }
		])
	})

	test('only log-scales eligible axis indices, leaving ineligible ones linear', () => {
		const axes: Array<MultiSeriesYAxisOption> = [
			{ type: 'value', min: 0, position: 'left' },
			{ type: 'value', min: 0, position: 'right' }
		]
		const out = applyLogScaleToYAxes(axes, true, [0]) // axis 1 has zero/negative values → not eligible
		expect(out[0].type).toBe('log')
		expect(out[1]).toEqual({ type: 'value', min: 0, position: 'right' })
	})
})
