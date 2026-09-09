// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest'
import { setInputSize } from '~/containers/LlamaAI/utils/scrollUtils'

function mount(contentHeight: number) {
	const wrapper = document.createElement('div')
	const textarea = document.createElement('textarea')
	const highlight = document.createElement('div')
	wrapper.append(textarea, highlight)
	document.body.append(wrapper)

	Object.defineProperty(wrapper, 'offsetHeight', { configurable: true, value: 21 })
	// Read during the measurement, so it records the wrapper's height at that moment.
	const wrapperHeightWhenMeasured: Array<string> = []
	Object.defineProperty(textarea, 'scrollHeight', {
		configurable: true,
		get() {
			wrapperHeightWhenMeasured.push(wrapper.style.height)
			return contentHeight
		}
	})

	return {
		wrapper,
		wrapperHeightWhenMeasured,
		refs: {
			promptInputRef: { current: textarea },
			highlightRef: { current: highlight },
			wrapperRef: { current: wrapper }
		}
	}
}

describe('setInputSize', () => {
	// The composer is a sibling of the chat scroll container. Letting the collapsed textarea
	// reach the outer layout grows the chat viewport for one synchronous layout, which clamps a
	// bottom-anchored scrollTop and makes the conversation jump once per keystroke.
	test('holds the wrapper height while it measures the collapsed textarea', () => {
		const { wrapperHeightWhenMeasured, refs } = mount(21)

		setInputSize(refs.promptInputRef, refs.highlightRef, 5, refs.wrapperRef)

		expect(wrapperHeightWhenMeasured).toEqual(['21px'])
	})

	test('releases the wrapper height so the composer keeps sizing to its content', () => {
		const { wrapper, refs } = mount(21)

		setInputSize(refs.promptInputRef, refs.highlightRef, 5, refs.wrapperRef)

		expect(wrapper.style.height).toBe('')
	})

	test('still sizes the textarea and the highlight overlay', () => {
		const { refs } = mount(42)

		setInputSize(refs.promptInputRef, refs.highlightRef, 5, refs.wrapperRef)

		expect(refs.promptInputRef.current.style.height).toBe('42px')
		expect(refs.highlightRef.current.style.height).toBe('42px')
		expect(refs.promptInputRef.current.style.overflowY).toBe('hidden')
	})

	test('caps at maxRows and scrolls the textarea beyond it', () => {
		const { refs } = mount(1000)

		setInputSize(refs.promptInputRef, refs.highlightRef, 3, refs.wrapperRef)

		const capped = Number.parseFloat(refs.promptInputRef.current.style.height)
		expect(capped).toBeLessThan(1000)
		expect(refs.promptInputRef.current.style.overflowY).toBe('auto')
		expect(refs.highlightRef.current.style.overflowY).toBe('auto')
	})

	test('works without a wrapper ref', () => {
		const { refs } = mount(21)

		expect(() => setInputSize(refs.promptInputRef, refs.highlightRef, 5)).not.toThrow()
		expect(refs.promptInputRef.current.style.height).toBe('21px')
	})
})
