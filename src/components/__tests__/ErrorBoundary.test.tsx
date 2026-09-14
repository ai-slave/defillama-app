// @vitest-environment happy-dom
import { act, type ErrorInfo } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'

function Thrower({ shouldThrow }: { shouldThrow: boolean }) {
	if (shouldThrow) throw new Error('render exploded')
	return <p>Recovered content</p>
}

describe('ErrorBoundary', () => {
	let container: HTMLDivElement
	let root: Root
	let consoleError: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		container = document.createElement('div')
		document.body.appendChild(container)
		root = createRoot(container)
	})

	afterEach(async () => {
		await act(async () => root.unmount())
		container.remove()
		consoleError.mockRestore()
	})

	test('renders children while nothing throws', async () => {
		await act(async () =>
			root.render(
				<ErrorBoundary fallback={<p role="alert">Broken</p>}>
					<Thrower shouldThrow={false} />
				</ErrorBoundary>
			)
		)
		expect(container.textContent).toBe('Recovered content')
		expect(container.querySelector('[role="alert"]')).toBeNull()
	})

	test('renders a static fallback when a child throws and reports the error', async () => {
		const onError = vi.fn()
		await act(async () =>
			root.render(
				<ErrorBoundary fallback={<p role="alert">Broken</p>} onError={onError}>
					<Thrower shouldThrow />
				</ErrorBoundary>
			)
		)
		expect(container.querySelector('[role="alert"]')?.textContent).toBe('Broken')
		expect(container.textContent).not.toContain('Recovered content')
		expect(onError).toHaveBeenCalledOnce()
		const [reportedError, reportedInfo] = onError.mock.calls[0] as [Error, ErrorInfo]
		expect(reportedError).toBeInstanceOf(Error)
		expect(reportedError.message).toBe('render exploded')
		expect(reportedInfo).toHaveProperty('componentStack')
	})

	test('passes the error and a reset callback to a function fallback', async () => {
		let shouldThrow = true
		const render = () =>
			act(async () =>
				root.render(
					<ErrorBoundary
						fallback={(error, reset) => (
							<div role="alert">
								<span>{error.message}</span>
								<button type="button" onClick={reset}>
									Try again
								</button>
							</div>
						)}
					>
						<Thrower shouldThrow={shouldThrow} />
					</ErrorBoundary>
				)
			)
		await render()
		expect(container.querySelector('[role="alert"] span')?.textContent).toBe('render exploded')

		shouldThrow = false
		await render()
		expect(container.querySelector('[role="alert"]')).not.toBeNull()

		await act(async () => container.querySelector('button')!.click())
		expect(container.querySelector('[role="alert"]')).toBeNull()
		expect(container.textContent).toBe('Recovered content')
	})

	test('wraps non-Error throwables so the fallback always receives an Error', async () => {
		function ThrowString(): null {
			// oxlint-disable-next-line no-throw-literal
			throw 'plain string failure'
		}
		const seen: Array<Error> = []
		await act(async () =>
			root.render(
				<ErrorBoundary
					fallback={(error) => {
						seen.push(error)
						return <p role="alert">{error.message}</p>
					}}
				>
					<ThrowString />
				</ErrorBoundary>
			)
		)
		expect(seen[0]).toBeInstanceOf(Error)
		expect(container.querySelector('[role="alert"]')?.textContent).toBe('plain string failure')
	})
})
