import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { TokenSearchDialog } from '../Filters/TokenSearchDialog'

const mocks = vi.hoisted(() => ({
	portalMounted: false,
	useVirtualizer: vi.fn()
}))

vi.mock('@ariakit/react', async () => {
	const { createElement } = await import('react')
	return {
		DialogProvider: ({ children }: { children: ReactNode }) => children,
		Dialog: ({ children }: { children: ReactNode }) =>
			mocks.portalMounted ? createElement('div', null, children) : null
	}
})

vi.mock('@tanstack/react-virtual', () => ({
	useVirtualizer: (options: unknown) => {
		mocks.useVirtualizer(options)
		return {
			getTotalSize: () => 74,
			getVirtualItems: () => [{ index: 0, key: 'ETH', start: 0 }]
		}
	}
}))

vi.mock('~/ui/Icon', () => ({ Icon: () => null }))
vi.mock('~/ui/Dialog', async () => {
	const { createElement } = await import('react')
	return {
		DialogCloseButton: () => null,
		DialogHeading: ({ children }: { children: ReactNode }) => createElement('h2', null, children),
		dialogScrollableBodyStyles: 'scrollable',
		dialogSurfaceStyles: 'surface'
	}
})
vi.mock('~/ui/Input', async () => {
	const { createElement } = await import('react')
	return { Input: (props: Record<string, unknown>) => createElement('input', props) }
})
vi.mock('~/ui/Hovercard', () => ({ Hovercard: ({ children }: { children: ReactNode }) => children }))
vi.mock('~/ui/SegmentedControl', () => ({ SegmentedControl: () => null }))

function renderDialog() {
	return renderToStaticMarkup(
		<TokenSearchDialog
			open
			onClose={() => {}}
			title="Search tokens"
			options={[
				['ETH group', 'family:eth'],
				['Ethereum', 'ETH'],
				['USD Coin', 'USDC']
			]}
			selectedValues={[]}
			multiple
			onToggle={() => {}}
			onClear={() => {}}
		/>
	)
}

describe('TokenSearchDialog virtualizer lifecycle', () => {
	beforeEach(() => {
		mocks.portalMounted = false
		mocks.useVirtualizer.mockClear()
	})

	test('initializes virtual rows only when the portal content and scroll element mount', () => {
		renderDialog()
		expect(mocks.useVirtualizer).not.toHaveBeenCalled()

		mocks.portalMounted = true
		const html = renderDialog()

		expect(mocks.useVirtualizer).toHaveBeenCalledOnce()
		expect(html).toContain('Ethereum')
	})
})
