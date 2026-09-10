import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChatChunkError, reportChatError } from '~/containers/LlamaAI/reportChatError'
import { Button } from '~/ui/Button'

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
			<div role="alert" className="flex flex-col gap-2 rounded-lg border border-error/30 bg-error/10 p-4">
				<p className="label-md text-error-on-tint">This response couldn’t be displayed.</p>
				<p className="body-md text-secondary">
					{this.state.failure === 'chunk'
						? 'Part of the page failed to load. Reload to try loading it again.'
						: 'You can continue chatting, or reload to try displaying this response again.'}
				</p>
				<Button type="button" size="md" onClick={() => window.location.reload()} className="mr-auto">
					Reload page
				</Button>
			</div>
		)
	}
}
