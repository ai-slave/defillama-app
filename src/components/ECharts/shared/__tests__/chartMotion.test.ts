import { expect, test } from 'vitest'
import { enterAnimationOptions } from '../chartMotion'

test('the default mode leaves every animation option to echarts', () => {
	expect(enterAnimationOptions('default', false, false)).toEqual({})
	expect(enterAnimationOptions('default', true, false)).toEqual({})
	expect(enterAnimationOptions('default', false, true)).toEqual({})
})

test('draw mode takes a shorter duration when the caller asks for one', () => {
	expect(enterAnimationOptions('draw', false, false, 500).animationDuration).toBe(500)
})

test('reduced motion turns animation off outright, entered or not', () => {
	expect(enterAnimationOptions('draw', false, true)).toEqual({ animation: false })
	expect(enterAnimationOptions('draw', true, true)).toEqual({ animation: false })
})
