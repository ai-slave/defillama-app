import { act, type ReactNode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'

const tree = (clock: number, node: ReactNode) => <PageClockProvider pageClockSec={clock}>{node}</PageClockProvider>

/**
 * The server renders hours before the visit: its system clock is the page clock, not the visitor's, and a component
 * that reads `Date.now()` while rendering must see the difference. The visitor's clock and zone come back before
 * hydration, including a clock the calling test faked.
 */
function renderOnServer(ui: ReactNode, pageClockSec: number, serverTimeZone: string | undefined): string {
	const callerFakedTime = vi.isFakeTimers()
	const visitorNowMs = Date.now()
	const visitorTimeZone = process.env.TZ
	if (callerFakedTime) vi.setSystemTime(pageClockSec * 1000)
	else vi.useFakeTimers({ toFake: ['Date'], now: pageClockSec * 1000 })
	if (serverTimeZone) process.env.TZ = serverTimeZone
	try {
		return renderToString(tree(pageClockSec, ui))
	} finally {
		if (callerFakedTime) vi.setSystemTime(visitorNowMs)
		else vi.useRealTimers()
		// Assigning undefined to an env var stores the string "undefined".
		if (visitorTimeZone === undefined) delete process.env.TZ
		else process.env.TZ = visitorTimeZone
	}
}

export type HydrationResult = {
	/** The server HTML the client hydrated onto. */
	serverHtml: string
	/** Hydration problems React reported: mismatches it recovered from and console errors it logged. */
	errors: Array<string>
	container: HTMLDivElement
	root: Root
	/** Re-render the tree with a new page clock or tree, as a live update would. */
	update: (ui: ReactNode, pageClockSec?: number) => Promise<void>
	unmount: () => Promise<void>
}

/**
 * Renders `ui` the way a static page reaches a visitor: the server draws it with its system clock at `pageClockSec`
 * (and, when given, in `serverTimeZone`), the browser hydrates that HTML at its own clock and zone. A clean result has no `errors`; a
 * countdown or "ago" label that read the live clock during render shows up here as a recoverable error, the same
 * way it would in the browser console. Both renders get the same `ui` element, so per-render state such as a
 * `QueryClient` belongs inside the tree: one instance shared by both renders hides a mismatch.
 */
export async function renderHydrated(
	ui: ReactNode,
	{ pageClockSec, serverTimeZone }: { pageClockSec: number; serverTimeZone?: string }
): Promise<HydrationResult> {
	const errors: Array<string> = []

	const serverHtml = renderOnServer(ui, pageClockSec, serverTimeZone)

	const container = document.createElement('div')
	container.innerHTML = serverHtml
	document.body.appendChild(container)

	const consoleError = console.error
	console.error = (...args: Array<unknown>) => {
		errors.push(args.map(String).join(' '))
	}
	let root: Root
	try {
		await act(async () => {
			root = hydrateRoot(container, tree(pageClockSec, ui), {
				onRecoverableError: (error) => {
					errors.push(error instanceof Error ? error.message : String(error))
				}
			})
		})
	} finally {
		console.error = consoleError
	}

	return {
		serverHtml,
		errors,
		container,
		root: root!,
		update: async (nextUi, nextClock = pageClockSec) => {
			await act(async () => root.render(tree(nextClock, nextUi)))
		},
		unmount: async () => {
			await act(async () => root.unmount())
			container.remove()
		}
	}
}
