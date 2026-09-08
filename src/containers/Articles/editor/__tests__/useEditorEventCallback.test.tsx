// @vitest-environment happy-dom

import { act, Suspense, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { useEditorEventCallback } from '../useEditorEventCallback'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test('keeps the callback stable and exposes the new article before passive effects', async () => {
	let readArticle: () => string
	const committedArticles: Array<string> = []
	function Harness({ articleId }: { articleId: string }) {
		readArticle = useEditorEventCallback(() => articleId)
		useLayoutEffect(() => {
			committedArticles.push(readArticle())
		})
		return null
	}

	await act(async () => root.render(<Harness articleId="first" />))
	const firstCallback = readArticle!
	await act(async () => root.render(<Harness articleId="second" />))
	expect(readArticle!).toBe(firstCallback)
	expect(committedArticles).toEqual(['first', 'second'])
})

test('does not expose an article from a suspended render to existing event handlers', async () => {
	let readArticle: () => string
	const pending = new Promise<void>(() => {})
	function Harness({ articleId, suspend = false }: { articleId: string; suspend?: boolean }) {
		const callback = useEditorEventCallback(() => articleId)
		useLayoutEffect(() => {
			readArticle = callback
		})
		if (suspend) throw pending
		return <span>{articleId}</span>
	}

	await act(async () =>
		root.render(
			<Suspense fallback="Loading">
				<Harness articleId="first" />
			</Suspense>
		)
	)
	await act(async () =>
		root.render(
			<Suspense fallback="Loading">
				<Harness articleId="second" suspend />
			</Suspense>
		)
	)
	expect(readArticle!()).toBe('first')
})
