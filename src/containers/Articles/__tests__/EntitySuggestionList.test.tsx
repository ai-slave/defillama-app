// @vitest-environment happy-dom

import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EntitySuggestionList, type EntitySuggestionListHandle } from '../editor/EntitySuggestionList'
import type { ArticleEntitySuggestionItem } from '../entitySuggestions'

function entity(id: string): ArticleEntitySuggestionItem {
	return { id, entityType: 'protocol', slug: id, label: id, route: `/protocol/${id}`, source: 'search' }
}

const alpha = entity('alpha')
const beta = entity('beta')
const gamma = entity('gamma')

function key(name: string) {
	return { key: name, shiftKey: false } as KeyboardEvent
}

describe('EntitySuggestionList highlight', () => {
	let container: HTMLDivElement
	let root: Root
	const handle = createRef<EntitySuggestionListHandle>()
	const command = vi.fn()

	function render(items: Array<ArticleEntitySuggestionItem>) {
		return act(async () => {
			root.render(
				<EntitySuggestionList ref={handle} items={items} recents={[]} query="a" loading={false} command={command} />
			)
		})
	}

	function highlighted() {
		return container.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('data-id') ?? null
	}

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
		command.mockClear()
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
	})

	test('forgets a highlight whose row left the list, so widening the list again does not bring it back', async () => {
		await render([alpha, beta])
		await act(async () => void handle.current!.onKeyDown(key('ArrowDown')))
		expect(highlighted()).toBe('beta')

		await render([alpha])
		expect(highlighted()).toBe('alpha')

		await render([alpha, beta])
		expect(highlighted()).toBe('alpha')
		await act(async () => void handle.current!.onKeyDown(key('Enter')))
		expect(command).toHaveBeenCalledWith(alpha)
	})

	test('keeps the highlight while its row stays in the list', async () => {
		await render([alpha, beta])
		await act(async () => void handle.current!.onKeyDown(key('ArrowDown')))
		expect(highlighted()).toBe('beta')

		await render([beta, gamma])
		expect(highlighted()).toBe('beta')
		await act(async () => void handle.current!.onKeyDown(key('Enter')))
		expect(command).toHaveBeenCalledWith(beta)
	})

	test('highlights the first row again when the list refills after being empty', async () => {
		await render([alpha, beta])
		await render([])
		expect(highlighted()).toBeNull()

		await render([gamma, alpha])
		expect(highlighted()).toBe('gamma')
	})
})
