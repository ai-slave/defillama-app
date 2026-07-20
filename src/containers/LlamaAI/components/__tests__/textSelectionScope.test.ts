// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { isSelectionInLlamaProse } from '../TextSelectionPopup'

function select(anchorNode: Node, focusNode: Node): Selection {
	const selection = window.getSelection()!
	const range = document.createRange()
	range.setStart(anchorNode, 0)
	range.setEnd(focusNode, (focusNode.textContent ?? '').length)
	selection.removeAllRanges()
	selection.addRange(range)
	return selection
}

describe('isSelectionInLlamaProse', () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div class="message">
				<div data-llamaai-prose><p id="p1">First paragraph of segment one.</p></div>
				<div data-chart-id="c1"><canvas></canvas></div>
				<div data-llamaai-prose><p id="p2">Paragraph in segment two.</p></div>
			</div>
			<div id="outside"><p id="p3">Sidebar text</p></div>
			<div contenteditable="true" data-llamaai-prose><p id="p4">editor</p></div>
		`
	})

	it('accepts a selection inside a single prose block', () => {
		const p1 = document.getElementById('p1')!.firstChild!
		expect(isSelectionInLlamaProse(select(p1, p1))).toBe(true)
	})

	it('accepts a selection spanning two prose blocks across an artifact (the flaky case)', () => {
		const p1 = document.getElementById('p1')!.firstChild!
		const p2 = document.getElementById('p2')!.firstChild!
		expect(isSelectionInLlamaProse(select(p1, p2))).toBe(true)
	})

	it('accepts a selection that starts in prose but ends on a chart or logo (drag past text)', () => {
		const p1 = document.getElementById('p1')!.firstChild!
		const chart = document.querySelector('[data-chart-id]')!
		expect(isSelectionInLlamaProse(select(p1, chart))).toBe(true)
		expect(isSelectionInLlamaProse(select(chart, p1))).toBe(true)
	})

	it('accepts a selection whose endpoints are both on widgets but which sweeps prose between them', () => {
		const chart = document.querySelector('[data-chart-id]')!
		const message = document.querySelector('.message')!
		const selection = window.getSelection()!
		const range = document.createRange()
		range.setStartBefore(message.firstElementChild!)
		range.setEndAfter(chart)
		selection.removeAllRanges()
		selection.addRange(range)
		expect(isSelectionInLlamaProse(selection)).toBe(true)
	})

	it('rejects a selection entirely outside prose', () => {
		const p3 = document.getElementById('p3')!.firstChild!
		expect(isSelectionInLlamaProse(select(p3, p3))).toBe(false)
	})

	it('rejects selections inside editable surfaces', () => {
		const p4 = document.getElementById('p4')!.firstChild!
		expect(isSelectionInLlamaProse(select(p4, p4))).toBe(false)
	})
})
