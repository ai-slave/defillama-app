import { useCallback, useEffect, useRef } from 'react'
import { useHackerMode } from '~/containers/LlamaAI/components/status/useHackerMode'

const HACKER_THINKING_STYLE = { textShadow: '0 0 8px rgba(0,255,65,0.4)' }

export function ThinkingPanel({ thinking, defaultOpen = false }: { thinking: string; defaultOpen?: boolean }) {
	const detailsRef = useRef<HTMLDetailsElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const shouldAutoScrollRef = useRef(true)
	const hackerMode = useHackerMode()

	const syncAutoScrollIntent = useCallback(() => {
		const content = contentRef.current
		if (!content) return
		shouldAutoScrollRef.current = Math.ceil(content.scrollTop + content.clientHeight) >= content.scrollHeight - 16
	}, [])

	const scrollContentToBottom = useCallback((force = false) => {
		requestAnimationFrame(() => {
			const content = contentRef.current
			if (!content || (!force && !shouldAutoScrollRef.current)) return
			content.scrollTop = content.scrollHeight
			shouldAutoScrollRef.current = true
		})
	}, [])

	useEffect(() => {
		if (defaultOpen && detailsRef.current) {
			detailsRef.current.open = true
			scrollContentToBottom(true)
		}
	}, [defaultOpen, scrollContentToBottom])

	useEffect(() => {
		if (detailsRef.current?.open) {
			scrollContentToBottom()
		}
	}, [thinking, scrollContentToBottom])

	if (!thinking) return null

	return (
		<details
			ref={detailsRef}
			className="group"
			onToggle={() => {
				if (detailsRef.current?.open) {
					scrollContentToBottom(true)
				}
			}}
		>
			<summary
				className={
					hackerMode
						? 'flex items-center gap-1 text-xs text-ai-terminal drop-shadow-ai-terminal'
						: 'flex items-center gap-1 text-xs text-ai-secondary'
				}
			>
				<span className="inline-block transition-transform duration-150 group-open:rotate-90">&#9656;</span>
				<span>{hackerMode ? <>{'>'} decrypting&hellip;</> : 'Reasoning'}</span>
			</summary>
			<div
				ref={contentRef}
				onScroll={syncAutoScrollIntent}
				className={
					hackerMode
						? 'mt-1 max-h-[160px] min-h-[40px] resize-y overflow-y-auto rounded-md border border-ai-terminal/20 bg-ai-ink p-3 font-mono text-xs leading-[1.6] whitespace-pre-wrap text-ai-terminal shadow-ai-terminal-inset drop-shadow-ai-terminal-soft'
						: 'mt-1 max-h-[120px] min-h-[40px] resize-y overflow-y-auto pl-3 font-mono text-xs leading-[1.6] whitespace-pre-wrap text-ai-secondary'
				}
				style={hackerMode ? HACKER_THINKING_STYLE : undefined}
			>
				{thinking}
			</div>
		</details>
	)
}
