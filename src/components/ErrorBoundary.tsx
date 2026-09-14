import { Component, type ErrorInfo, type ReactNode } from 'react'

export type ErrorBoundaryFallback = ReactNode | ((error: Error, reset: () => void) => ReactNode)

interface ErrorBoundaryProps {
	children: ReactNode
	fallback: ErrorBoundaryFallback
	onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
	error: Error | null
}

function toError(thrown: unknown): Error {
	return thrown instanceof Error ? thrown : new Error(String(thrown))
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null }

	static getDerivedStateFromError(thrown: unknown): ErrorBoundaryState {
		return { error: toError(thrown) }
	}

	override componentDidCatch(thrown: Error, info: ErrorInfo) {
		this.props.onError?.(toError(thrown), info)
	}

	reset = () => {
		this.setState({ error: null })
	}

	override render() {
		const { error } = this.state
		if (!error) return this.props.children
		const { fallback } = this.props
		return typeof fallback === 'function' ? fallback(error, this.reset) : fallback
	}
}
