// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { MarkoutHorizons, SlippageLadder } from '../ProfileExecution'

describe('paired execution measurements', () => {
	test('shows the measured slippage rung independently of the other size', () => {
		const html = renderToStaticMarkup(
			<SlippageLadder
				execution={{
					predictedSlippage10kBps: null,
					realizedSlippage10kBps: null,
					predictedSlippage100kBps: 2.5,
					realizedSlippage100kBps: 2
				}}
			/>
		)
		expect(html).toContain('$10k')
		expect(html).toContain('n/a')
		expect(html).toContain('$100k')
		expect(html).toContain('$20.00')
	})

	test('shows the measured markout independently of the other horizon', () => {
		const html = renderToStaticMarkup(<MarkoutHorizons execution={{ markout1mBps: null, markout5mBps: 3 }} />)
		expect(html).toContain('1m')
		expect(html).toContain('n/a')
		expect(html).toContain('5m')
		expect(html).toContain('+$3.00')
	})

	test('keeps wholly unmeasured cells as a single n/a', () => {
		for (const element of [
			<SlippageLadder key="absent-slippage" execution={null} />,
			<SlippageLadder
				key="unmeasured-slippage"
				execution={{
					predictedSlippage10kBps: 1,
					realizedSlippage10kBps: null,
					predictedSlippage100kBps: 2,
					realizedSlippage100kBps: null
				}}
			/>,
			<MarkoutHorizons key="absent-markout" execution={null} />,
			<MarkoutHorizons key="unmeasured-markout" execution={{ markout1mBps: null, markout5mBps: null }} />
		]) {
			const cell = document.createElement('div')
			cell.innerHTML = renderToStaticMarkup(element)
			expect(cell.textContent).toBe('n/a')
		}
	})
})
