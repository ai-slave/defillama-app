// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { getGrowthDeposit } from '../queryState'
import { useQueryDraft } from '../useQueryDraft'

describe('useQueryDraft', () => {
	let container: HTMLDivElement
	let root: Root
	let latest: [string, (text: string) => void, { onFocus: () => void; onBlur: () => void }]

	function Harness({ committed }: { committed: number }) {
		latest = useQueryDraft(committed, getGrowthDeposit)
		return null
	}
	const render = (committed: number) => act(async () => root.render(<Harness committed={committed} />))

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('keeps an empty or partial entry while the URL still holds the default', async () => {
		await render(1)
		await act(async () => latest[1](''))
		expect(latest[0]).toBe('')
		await act(async () => latest[1]('0.'))
		await render(1)
		expect(latest[0]).toBe('0.')
	})

	test('keeps a valid new value before its debounced URL commit lands', async () => {
		await render(1)
		await act(async () => latest[2].onFocus())
		await act(async () => latest[1]('500'))
		// A slower commit of an earlier draft must not overwrite the characters now under the caret.
		await render(50)
		expect(latest[0]).toBe('500')

		// The change that landed while focused stays dropped after blur.
		await act(async () => latest[2].onBlur())
		expect(latest[0]).toBe('500')
	})

	test('normalizes incomplete text on blur without snapping valid text to the old URL value', async () => {
		await render(1)
		await act(async () => latest[2].onFocus())
		await act(async () => latest[1]('500'))
		await act(async () => latest[2].onBlur())
		expect(latest[0]).toBe('500')

		await act(async () => latest[2].onFocus())
		await act(async () => latest[1](''))
		await act(async () => latest[2].onBlur())
		expect(latest[0]).toBe('1')
	})

	test('yields to the URL once it changes to a different value', async () => {
		await render(1)
		await act(async () => latest[1]('500'))
		await render(500)
		expect(latest[0]).toBe('500')
		await render(1)
		expect(latest[0]).toBe('1')
	})
})
