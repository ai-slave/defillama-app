import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { GradeBadge, GradeChip, ScoreBar } from '../grades'

const overallScale = [
	{ min: 60, grade: 'AAA', interpretation: 'Highest confidence' },
	{ min: 40, grade: 'AA', interpretation: 'Very high confidence' },
	{ min: null, grade: 'CCC', interpretation: 'Very low confidence' }
]

const axisScale = [
	{ min: 8, grade: 'AAA', interpretation: 'Exceptional' },
	{ min: 6, grade: 'AA', interpretation: 'Excellent' },
	{ min: null, grade: 'CCC', interpretation: 'Insufficient' }
]

describe('GradeBadge', () => {
	test('shows N/A when the score is missing', () => {
		const html = renderToStaticMarkup(<GradeBadge score={null} />)
		expect(html).toContain('N/A')
	})
})

describe('GradeChip', () => {
	test('shows the explicit API grade instead of the grade derived from the score', () => {
		const html = renderToStaticMarkup(<GradeChip score={45} grade="B" gradingScale={overallScale} />)
		// A score of 45 alone would resolve to AA on this scale.
		expect(html.replace(/<[^>]*>/g, '')).toBe('Token GradeB')
	})
})

describe('ScoreBar', () => {
	test('shows rubric scores with two decimals', () => {
		const html = renderToStaticMarkup(<ScoreBar score={8.5} scale={10} gradingScale={axisScale} />)
		expect(html).toContain('8.50')
	})

	test('hides the value column when showValue is false and renders an empty track for null', () => {
		const withoutValue = renderToStaticMarkup(<ScoreBar score={8.5} scale={10} showValue={false} />)
		expect(withoutValue).not.toContain('8.50')
		const empty = renderToStaticMarkup(<ScoreBar score={null} />)
		expect(empty).toContain('N/A')
	})
})
