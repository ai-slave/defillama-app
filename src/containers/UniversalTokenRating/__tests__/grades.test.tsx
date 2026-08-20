import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GradeBadge, GradeChip, ScoreBar } from '../grades'

describe('GradeBadge', () => {
	it('renders the resolved letter on a solid grade-colored chip', () => {
		const html = renderToStaticMarkup(<GradeBadge score={96} />)
		expect(html).toContain('AAA')
		expect(html).toContain('bg-utr-grade-aaa')
		expect(html).toContain('text-utr-grade-on-color')
	})

	it('falls back to a muted N/A chip when the score is missing', () => {
		const html = renderToStaticMarkup(<GradeBadge score={null} />)
		expect(html).toContain('N/A')
		expect(html).toContain('bg-surface-elevated-1')
	})
})

describe('GradeChip', () => {
	it('renders the Token Grade label with tinted background and grade-colored text', () => {
		const html = renderToStaticMarkup(<GradeChip score={45} />)
		expect(html).toContain('Token Grade')
		expect(html).toContain('>B<')
		expect(html).toContain('bg-utr-grade-b-tint')
		expect(html).toContain('text-utr-grade-b')
	})
})

describe('ScoreBar', () => {
	it('renders the numeric value and a fill width proportional to the scale', () => {
		const html = renderToStaticMarkup(<ScoreBar score={63.73} />)
		expect(html).toContain('63.73')
		expect(html).toContain('width:63.73%')
	})

	it('normalizes 0-10 rubric scores to the full track width', () => {
		const html = renderToStaticMarkup(<ScoreBar score={8.5} scale={10} />)
		expect(html).toContain('8.50')
		expect(html).toContain('width:85%')
	})

	it('hides the value column when showValue is false and renders an empty track for null', () => {
		const withoutValue = renderToStaticMarkup(<ScoreBar score={8.5} scale={10} showValue={false} />)
		expect(withoutValue).not.toContain('8.50')
		const empty = renderToStaticMarkup(<ScoreBar score={null} />)
		expect(empty).toContain('N/A')
	})
})
