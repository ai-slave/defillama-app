import { useRef, type RefObject } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import {
	CHAT_RATIO_KEYBOARD_STEP,
	clampChatRatio,
	setTerminalChatCollapsed,
	setTerminalChatRatio
} from './terminalViewStore'

export function TerminalSplitter({
	ratio,
	collapsed,
	boundsRef
}: {
	ratio: number
	collapsed: boolean
	boundsRef: RefObject<HTMLDivElement | null>
}) {
	const draggingRef = useRef(false)

	if (collapsed) {
		return (
			<nav aria-label="Chat controls" className="hidden w-11 flex-none flex-col items-center gap-2 pt-2.5 lg:flex">
				<Tooltip
					content="Show chat"
					placement="left"
					render={
						<Button
							variant="ghost"
							size="sm"
							square
							id="terminal-chat-show"
							// The rail leaves with this button; the chat header's Hide chat takes its place.
							onClick={() =>
								keepFocus(
									() => setTerminalChatCollapsed(false),
									() => document.getElementById('terminal-chat-hide')
								)
							}
							data-umami-event="llamaai-terminal-chat-collapse"
							data-umami-event-action="expand"
						/>
					}
				>
					<Icon name="chevrons-left" className="size-4" />
					<span className="sr-only">Show chat</span>
				</Tooltip>
			</nav>
		)
	}

	const applyClientX = (clientX: number) => {
		const rect = boundsRef.current?.getBoundingClientRect()
		if (!rect || rect.width === 0) return
		setTerminalChatRatio(clampChatRatio((rect.right - clientX) / rect.width, rect.width))
	}

	const nudge = (direction: number) => {
		const width = boundsRef.current?.getBoundingClientRect().width ?? 0
		setTerminalChatRatio(clampChatRatio(ratio + direction * CHAT_RATIO_KEYBOARD_STEP, width))
	}

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize chat panel"
			aria-valuenow={Math.round(ratio * 100)}
			aria-valuemin={15}
			aria-valuemax={60}
			tabIndex={0}
			onPointerDown={(event) => {
				draggingRef.current = true
				event.currentTarget.setPointerCapture(event.pointerId)
			}}
			onPointerMove={(event) => {
				if (draggingRef.current) applyClientX(event.clientX)
			}}
			onPointerUp={() => {
				draggingRef.current = false
			}}
			onLostPointerCapture={() => {
				draggingRef.current = false
			}}
			onKeyDown={(event) => {
				const direction = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0
				if (!direction) return
				event.preventDefault()
				nudge(direction)
			}}
			// The brand tint on hover shows the drag handle is live; a splitter has no selected state.
			className="hidden w-3 flex-none cursor-col-resize touch-none items-center justify-center rounded-sm hover:bg-brand-muted lg:flex"
		>
			<Icon name="grip-vertical" className="size-3 text-tertiary" />
		</div>
	)
}
