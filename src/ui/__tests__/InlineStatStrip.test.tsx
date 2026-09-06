import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { InlineStatStrip } from '../SummaryStats'

test('makes metric definitions keyboard accessible without adding stops to plain labels', () => {
	const html = renderToStaticMarkup(
		<InlineStatStrip
			items={[
				{ label: 'OI', value: '$0', tooltip: 'Current value of outstanding positions.' },
				{ label: 'Plain', value: '$1' }
			]}
		/>
	)
	expect(html.match(/tabindex="0"/g)).toHaveLength(1)
	expect(html).toContain('$0')
})
