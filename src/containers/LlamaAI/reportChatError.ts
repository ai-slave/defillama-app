import { trackUmamiEvent, UMAMI_READY_EVENT } from '~/utils/analytics/umami'

export function isChatChunkError(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.name === 'ChunkLoadError' || /ChunkLoadError|Loading chunk|Failed to load chunk/.test(error.message))
	)
}

const reportedErrors = new Set<string>()

// Exception messages can quote response content. Only public script locations leave the browser.
function scriptLocations(stack: string): string {
	return (stack.match(/\/_next\/static\/[\w./%()[\]-]+\.js(?::\d+){0,2}/g) ?? []).slice(0, 5).join('\n').slice(0, 500)
}

export function reportChatError(error: unknown, phase: 'render' | 'submission', componentStack: string): void {
	console.error(`[llama-ai] ${phase} failed:`, error, componentStack)
	try {
		const exception = error instanceof Error ? error : null
		const stack = scriptLocations(
			(exception?.stack ?? '')
				.split('\n')
				.filter((line) => /^\s+at\s|^[\w.$ ]*@https?:\/\//.test(line))
				.join('\n')
		)
		const components = Array.from(
			componentStack.matchAll(/^\s+at ([\w.$]+)|^([\w.$]+)@/gm),
			(match) => match[1] ?? match[2]
		)
			.slice(0, 10)
			.join('\n')
			.slice(0, 500)
		const kind = isChatChunkError(error) ? 'chunk-load' : 'exception'
		const reactCode = exception?.message.match(/Minified React error #(\d+)/)?.[1] ?? ''
		const name =
			exception && /^(Error|TypeError|RangeError|ReferenceError|SyntaxError|ChunkLoadError)$/.test(exception.name)
				? exception.name
				: 'Error'
		const fingerprint = `${phase}:${kind}:${name}:${reactCode}:${stack}:${components}`
		// Multiple responses can fail on the same cached import; report it once per page.
		if (reportedErrors.has(fingerprint) || reportedErrors.size >= 10) return
		reportedErrors.add(fingerprint)
		const nextData = JSON.parse(document.getElementById('__NEXT_DATA__')!.textContent!) as {
			buildId: string
			page: string
		}
		const data = {
			phase,
			kind,
			name,
			reactCode,
			stack,
			components,
			chunk: isChatChunkError(error) ? scriptLocations(exception!.message) : '',
			buildId: nextData.buildId,
			route: nextData.page,
			browser: navigator.userAgent.slice(0, 300)
		}
		const send = () => trackUmamiEvent('llamaai-client-error', data)
		if (window.umami) send()
		else window.addEventListener(UMAMI_READY_EVENT, send, { once: true })
	} catch {
		// Reporting must never replace the response's recovery UI with another error.
	}
}
