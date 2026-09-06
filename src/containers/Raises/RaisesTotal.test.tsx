// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { RaisesTotal } from './RaisesTotal'
import { summarizeRaises } from './summary'

describe('fundraising totals', () => {
	test.each([
		{ amounts: [2_500_000, 14_000_000], totalUsd: 16_500_000, undisclosedCount: 0, text: '$16.5m' },
		{ amounts: [2_500_000, null, 14_000_000], totalUsd: 16_500_000, undisclosedCount: 1, text: '$16.5m' },
		{ amounts: [null, null], totalUsd: null, undisclosedCount: 2, text: 'Undisclosed' },
		{ amounts: [0], totalUsd: 0, undisclosedCount: 0, text: '$0' },
		{ amounts: [0, null], totalUsd: 0, undisclosedCount: 1, text: '$0' },
		{ amounts: [], totalUsd: 0, undisclosedCount: 0, text: '$0' }
	])(
		'distinguishes disclosed zero, missing amounts and empty populations: $amounts',
		({ amounts, totalUsd, undisclosedCount, text }) => {
			const summary = summarizeRaises(amounts.map((amountUsd) => ({ amountUsd })))
			expect(summary).toEqual({ totalUsd, undisclosedCount })
			const markup = renderToStaticMarkup(<RaisesTotal {...summary} />)
			expect(markup.replace(/<[^>]*>/g, '')).toBe(text)
			if (undisclosedCount === 0 || totalUsd === null) expect(markup).not.toContain('tabindex')
		}
	)

	test.each([
		{ undisclosedCount: 1, interaction: 'focus' },
		{ undisclosedCount: 2, interaction: 'focus' },
		{ undisclosedCount: 1, interaction: 'touch' }
	])('explains $undisclosedCount undisclosed rounds on $interaction', async ({ undisclosedCount, interaction }) => {
		const container = document.createElement('div')
		document.body.append(container)
		const root = createRoot(container)
		try {
			await act(async () => root.render(<RaisesTotal totalUsd={16_500_000} undisclosedCount={undisclosedCount} />))
			const trigger = container.querySelector<HTMLElement>('[tabindex="0"]')
			expect(trigger?.textContent).toBe('$16.5m')
			await act(async () => {
				if (interaction === 'focus') trigger?.focus()
				else trigger?.dispatchEvent(new Event('touchstart', { bubbles: true }))
			})
			expect(document.querySelector('[role="tooltip"]')?.textContent).toContain(`Excludes ${undisclosedCount}`)
			expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('not the complete total')
		} finally {
			await act(async () => root.unmount())
			container.remove()
		}
	})
})
