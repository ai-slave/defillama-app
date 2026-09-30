// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ArticleEmbedBlock } from '../renderer/ArticleEmbedBlock'

// Like the browser's, it reports the target's current state as soon as observation starts, then on each change.
class FakeIntersectionObserver {
	static instances: Array<FakeIntersectionObserver> = []
	static near = false
	private targets = new Set<Element>()

	constructor(private readonly callback: IntersectionObserverCallback) {
		FakeIntersectionObserver.instances.push(this)
	}

	observe(target: Element) {
		this.targets.add(target)
		this.report()
	}

	unobserve(target: Element) {
		this.targets.delete(target)
	}

	disconnect() {
		this.targets.clear()
	}

	takeRecords(): Array<IntersectionObserverEntry> {
		return []
	}

	report() {
		if (this.targets.size === 0) return
		const entries = [...this.targets].map(
			(target) => ({ isIntersecting: FakeIntersectionObserver.near, target }) as IntersectionObserverEntry
		)
		this.callback(entries, this as unknown as IntersectionObserver)
	}
}

async function scroll(near: boolean) {
	FakeIntersectionObserver.near = near
	await act(async () => {
		for (const observer of FakeIntersectionObserver.instances) observer.report()
	})
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	FakeIntersectionObserver.instances = []
	FakeIntersectionObserver.near = false
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
	// The tweet widget script is third-party; a loaded one lets the embed skip injecting it.
	vi.stubGlobal('twttr', { widgets: { load: () => {} } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	vi.unstubAllGlobals()
	container.remove()
})

test('a tweet loads once it nears the viewport and stays loaded after scrolling away', async () => {
	const tweetUrl = 'https://twitter.com/DefiLlama/status/1'
	await act(async () =>
		root.render(
			<ArticleEmbedBlock
				config={{ provider: 'twitter', url: tweetUrl, sourceUrl: tweetUrl, title: 'DefiLlama on X' }}
			/>
		)
	)
	const tweetLink = () => container.querySelector<HTMLAnchorElement>('blockquote.twitter-tweet a')
	expect(tweetLink()).toBeNull()
	expect(container.textContent).toContain('Loading…')

	await scroll(true)
	expect(tweetLink()!.textContent).toBe('DefiLlama on X')

	await scroll(false)
	expect(tweetLink()!.textContent).toBe('DefiLlama on X')
	expect(container.textContent).not.toContain('Loading…')
})
