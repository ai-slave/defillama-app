import { expect, test } from 'vitest'
import { buildWatermarkGraphic, watermarkSize } from '../watermark'

test('a full-size plot keeps the 40px logo and a 150px chart gets 20px', () => {
	expect(watermarkSize({ width: 800, height: 324 }).height).toBe(40)
	expect(watermarkSize({ width: 400, height: 114 }).height).toBe(20)
	expect(watermarkSize({ width: 400, height: 200 }).height).toBe(28)
})

test('a narrow area caps the logo at 60% of its width and keeps the logo shape', () => {
	// The height rule alone gives this area 40px; 60px wide at the logo's 389:133 shape is 21px tall.
	expect(watermarkSize({ width: 100, height: 300 })).toEqual({ width: 60, height: 21 })
})

test('centers the logo on the plot box instead of the canvas', () => {
	const box = { x: 52, y: 10, width: 400, height: 114 }
	const graphic = buildWatermarkGraphic(false, box, 'under')
	const { width, height } = graphic.style as { width: number; height: number }
	expect(Math.abs((graphic.left as number) + width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(0.5)
	expect(Math.abs((graphic.top as number) + height / 2 - (box.y + box.height / 2))).toBeLessThanOrEqual(0.5)
})
