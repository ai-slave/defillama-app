import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChatChunkError, reportChatError } from '~/containers/LlamaAI/reportChatError'

export class ResponseErrorBoundary extends Component<{ children: ReactNode }, { failure: 'chunk' | 'render' | null }> {
	override state: { failure: 'chunk' | 'render' | null } = { failure: null }

	static getDerivedStateFromError(error: unknown) {
		return { failure: isChatChunkError(error) ? 'chunk' : 'render' }
	}

	override componentDidCatch(error: Error, info: ErrorInfo) {
		reportChatError(error, 'render', info.componentStack ?? '')
	}

	override render() {
		if (!this.state.failure) return this.props.children
		return (
			<div role="alert" className="flex flex-col gap-2 rounded-lg border border-ai-error-border bg-ai-error-bg p-4">
				<p className="text-sm text-ai-error-strong">This response couldn’t be displayed.</p>
				<p className="text-sm text-ai-secondary">
					{this.state.failure === 'chunk'
						? 'Part of the page failed to load. Reload to try loading it again.'
						: 'You can continue chatting, or reload to try displaying this response again.'}
				</p>
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="mr-auto rounded-md border border-ai-error-border px-3 py-1 text-sm text-ai-error-strong hover:bg-ai-error-border focus-visible:outline-2"
				>
					Reload page
				</button>
			</div>
		)
	}
}
