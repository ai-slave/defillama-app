import { Suspense, use, type ReactNode } from 'react'
import { browser } from 'react-dom'

// Renders children only in the browser, for content the server cannot know: the account pages (without loading
// wallet SDKs), auth-dependent prompts, client-fetch failures. The server sends the empty fallback; hydration renders
// the children in its first pass. Use `useIsClient` instead when the component needs the value to pick a branch.
export function ClientOnly({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={null}>
			<BrowserOnly>{children}</BrowserOnly>
		</Suspense>
	)
}

function BrowserOnly({ children }: { children: ReactNode }) {
	use(browser())
	return children
}
