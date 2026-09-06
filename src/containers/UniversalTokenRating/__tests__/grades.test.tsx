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
	test('renders the resolved letter on a solid grade-colored chip', () => {
		const html = renderToStaticMarkup(<GradeBadge score={60} gradingScale={overallScale} />)
		expect(html).toContain('AAA')
		expect(html).toContain('bg-utr-grade-aaa')
		expect(html).toContain('text-utr-grade-on-color')
	})

	test('falls back to a muted N/A chip when the score is missing', () => {
		const html = renderToStaticMarkup(<GradeBadge score={null} />)
		expect(html).toContain('N/A')
		expect(html).toContain('bg-surface-elevated-1')
	})
})

describe('GradeChip', () => {
	test('renders the Token Grade label with tinted background and grade-colored text', () => {
		const html = renderToStaticMarkup(<GradeChip score={45} grade="B" gradingScale={overallScale} />)
		expect(html).toContain('Token Grade')
		expect(html).toContain('>B<')
		expect(html).toContain('bg-utr-grade-b-tint')
		expect(html).toContain('text-utr-grade-b')
	})
})

describe('ScoreBar', () => {
	test('renders the numeric value and a fill width proportional to the scale', () => {
		const html = renderToStaticMarkup(<ScoreBar score={63.73} gradingScale={overallScale} />)
		expect(html).toContain('63.73')
		expect(html).toContain('width:63.73%')
		expect(html).toContain('bg-utr-grade-aaa')
	})

	test('normalizes 0-10 rubric scores to the full track width', () => {
		const html = renderToStaticMarkup(<ScoreBar score={8.5} scale={10} gradingScale={axisScale} />)
		expect(html).toContain('8.50')
		expect(html).toContain('width:85%')
	})

	test('uses an explicit API grade without changing the numeric bar width', () => {
		const html = renderToStaticMarkup(<ScoreBar score={60} grade="B" gradingScale={overallScale} />)
		expect(html).toContain('width:60%')
		expect(html).toContain('bg-utr-grade-b')
	})

	test('hides the value column when showValue is false and renders an empty track for null', () => {
		const withoutValue = renderToStaticMarkup(<ScoreBar score={8.5} scale={10} showValue={false} />)
		expect(withoutValue).not.toContain('8.50')
		const empty = renderToStaticMarkup(<ScoreBar score={null} />)
		expect(empty).toContain('N/A')
	})
})
