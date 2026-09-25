import { expect, test } from 'vitest'
import { enterAnimationOptions } from '../chartMotion'

test('the default mode leaves every animation option to echarts', () => {
	expect(enterAnimationOptions('default', false, false)).toEqual({})
	expect(enterAnimationOptions('default', true, false)).toEqual({})
	expect(enterAnimationOptions('default', false, true)).toEqual({})
})

test('draw mode animates the first render past the point threshold', () => {
	expect(enterAnimationOptions('draw', false, false)).toEqual({
		animation: true,
		animationThreshold: 200_000,
		animationDuration: 700,
		animationEasing: 'quarticOut'
	})
})

test('draw mode takes a shorter duration when the caller asks for one', () => {
	expect(enterAnimationOptions('draw', false, false, 500).animationDuration).toBe(500)
})

test('an entered chart stops drawing itself in but keeps its state transitions alive', () => {
	expect(enterAnimationOptions('draw', true, false)).toEqual({ animationDuration: 0 })
})

test('reduced motion turns animation off outright, entered or not', () => {
	expect(enterAnimationOptions('draw', false, true)).toEqual({ animation: false })
	expect(enterAnimationOptions('draw', true, true)).toEqual({ animation: false })
})
