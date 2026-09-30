import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChatChunkError, reportChatError } from '~/containers/LlamaAI/reportChatError'
import { Button } from '~/ui/Button'
import { ChatStatusLine } from '../status/ChatStatusLine'

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
			<ChatStatusLine
				variant="error"
				align="start"
				action={
					<Button type="button" size="sm" onClick={() => window.location.reload()}>
						Reload page
					</Button>
				}
			>
				{this.state.failure === 'chunk'
					? 'This response couldn’t be displayed. Part of the page failed to load.'
					: 'This response couldn’t be displayed. You can keep chatting.'}
			</ChatStatusLine>
		)
	}
}
