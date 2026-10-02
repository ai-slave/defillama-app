// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { compile } from 'tailwindcss'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { EntityQuestionsStrip } from '~/components/EntityQuestionsStrip'
import { freeBadgeBOnly, freeLabelAOnly, freeLabelBOnly } from '~/components/LlamaAIFreeLabel'
import { LinkToPage } from '~/components/Nav/shared'
import { DesktopSearch, MobileSearch } from '~/components/Search'
import { AB_SEED_COOKIE_NAME } from '~/utils/abTesting'
import { getHeadBootstrapScript } from '~/utils/cookies'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async () => []
}))
// Opening sign-in is not what these tests read.
vi.mock('~/containers/Subscription/SignInDialog', () => ({ SignInDialog: () => null }))
vi.mock('next/router', () => ({
	useRouter: () => ({ asPath: '/protocol/aave', push: vi.fn(), query: {}, pathname: '/protocol/[protocol]' })
}))

const SEED_A = '00000000-0000-4000-8000-000000000008'
const SEED_B = '00000000-0000-4000-8000-000000000000'

// Signed out unless a test signs in.
const session = installSubscriberSession('reader', { account: 'free' })
const track = installUmamiSink()
let root: Root
let container: HTMLDivElement
const experimentCalls = () => track.mock.calls.filter(([name]) => String(name).startsWith('experiment-'))

beforeAll(async () => {
	const compiler = await compile('@tailwind utilities;', {
		loadStylesheet: async () => ({ path: '', content: '', base: '' })
	})
	const style = document.createElement('style')
	const displayClasses = `${freeLabelAOnly} ${freeLabelBOnly} ${freeBadgeBOnly}`
		.split(' ')
		.filter((name) => /(^|:)(hidden|inline|inline-flex)$/.test(name))
	style.textContent = compiler.build(displayClasses)
	document.head.appendChild(style)
})

beforeEach(() => {
	pb.authStore.clear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(() => {
	act(() => root.unmount())
	container.remove()
	sessionStorage.clear()
})

function renderForSeed(seed: string, ui: ReactNode) {
	document.cookie = `${AB_SEED_COOKIE_NAME}=${seed}`
	new Function(getHeadBootstrapScript())()
	act(() => root.unmount())
	root = createRoot(container)
	act(() => root.render(<session.Wrapper>{ui}</session.Wrapper>))
}

function visibleText(el: Element): string {
	return [...el.childNodes]
		.map((node) =>
			node.nodeType === Node.TEXT_NODE
				? node.textContent
				: getComputedStyle(node as Element).display === 'none'
					? ''
					: visibleText(node as Element)
		)
		.join('')
}

const ctaLink = () => container.querySelector('a[href="/ai"]')!

const entryPoints = {
	header: () => <DesktopSearch />,
	sidebar: () => <LinkToPage route="/ai" name="LlamaAI" asPath="/" />,
	strip: () => (
		<EntityQuestionsStrip questions={['What is Aave?']} entitySlug="aave" entityType="protocol" entityName="Aave" />
	)
}

describe('llamaai-free-label-v1', () => {
	test.each(Object.entries(entryPoints))(
		'%s: B shows the free label from the pre-paint attribute, A does not',
		(_, ui) => {
			renderForSeed(SEED_A, ui())
			expect(visibleText(container.querySelector('a[href="/ai"]') ?? container)).not.toMatch(/free/i)

			renderForSeed(SEED_B, ui())
			expect(visibleText(container.querySelector('a[href="/ai"]') ?? container)).toMatch(/free/i)
		}
	)

	test.each(Object.entries(entryPoints))('%s: a click sends entry-click for the visitor arm', async (name, ui) => {
		renderForSeed(SEED_B, ui())
		const target =
			name === 'strip'
				? [...container.querySelectorAll('button')].find((b) => b.textContent === 'What is Aave?')!
				: (ctaLink() as HTMLElement)
		target.addEventListener('click', (event) => event.preventDefault())
		// The strip opens sign-in, which loads lazily on the next task.
		await act(async () => {
			target.click()
			await new Promise((resolve) => setTimeout(resolve))
		})
		expect(track).toHaveBeenCalledWith('experiment-exposure', { experiment: 'llamaai-free-label-v1', variant: 'b' })
		expect(track).toHaveBeenCalledWith('experiment-action', {
			experiment: 'llamaai-free-label-v1',
			variant: 'b',
			metric: 'entry-click'
		})
	})
})

test('a signed-in free reader sees the same header button in both arms, so a header click is not counted for the test', async () => {
	pb.authStore.save(session.token, session.record)
	renderForSeed(SEED_B, entryPoints.header())
	const headerButton = () => container.querySelector<HTMLAnchorElement>('a[href="/ai/chat"]')!
	await waitForUi(() => expect(visibleText(headerButton())).toBe('Ask LlamaAI'))

	headerButton().addEventListener('click', (event) => event.preventDefault())
	act(() => headerButton().click())
	expect(experimentCalls()).toEqual([])
})

test('a signed-in free reader sees plain Ask LlamaAI on the phone header too, but the sidebar Free badge still counts them', async () => {
	pb.authStore.save(session.token, session.record)
	renderForSeed(SEED_B, <MobileSearch />)
	await waitForUi(() => expect(visibleText(container.querySelector('a[href="/ai/chat"]')!)).toBe('Ask LlamaAI'))
	expect(experimentCalls()).toEqual([])

	renderForSeed(SEED_B, entryPoints.sidebar())
	expect(visibleText(ctaLink())).toMatch(/free/i)
	expect(track).toHaveBeenCalledWith('experiment-exposure', { experiment: 'llamaai-free-label-v1', variant: 'b' })
})
