import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '~/components/Icon'

interface PopupPosition {
	top: number
	left: number
}

function getElementFromNode(node: Node | null) {
	if (!node) return null
	return node instanceof Element ? node : node.parentElement
}

// Messages render one .llamaai-prose block PER markdown segment, with charts,
// logos, and other widgets between them — so drags routinely start in prose and
// end on a non-prose element (or span several prose blocks). A selection
// qualifies when AT LEAST ONE endpoint is in prose and neither endpoint is in
// an editable surface; the export scrubber handles any non-prose content swept in.
export function isSelectionInLlamaProse(selection: Selection | null): boolean {
	if (!selection || selection.rangeCount === 0) return false
	const anchor = getElementFromNode(selection.anchorNode)
	const focus = getElementFromNode(selection.focusNode)
	if (!anchor || !focus) return false
	const editable = 'textarea, input, [contenteditable]'
	if (anchor.closest(editable) || focus.closest(editable)) return false
	if (anchor.closest('.llamaai-prose') || focus.closest('.llamaai-prose')) return true
	// Both endpoints can land on widgets (charts, controls) while the drag sweeps
	// prose between them — qualify if the range intersects any prose block.
	const range = selection.getRangeAt(0)
	for (const prose of Array.from(document.querySelectorAll('.llamaai-prose'))) {
		try {
			if (range.intersectsNode(prose)) return true
		} catch {
			// intersectsNode unavailable — endpoint checks above are the only signal
		}
	}
	return false
}

export function TextSelectionPopup({
	onSelect,
	onAddToArticle
}: {
	onSelect: (text: string) => void
	onAddToArticle?: (html: string) => void
}) {
	const [selectedText, setSelectedText] = useState('')
	const [position, setPosition] = useState<PopupPosition | null>(null)
	const popupRef = useRef<HTMLDivElement>(null)
	const selectionTimeoutRef = useRef<number | null>(null)

	useEffect(() => {
		const POPUP_OFFSET = 36
		const VIEWPORT_MARGIN = 8
		const clearScheduledSelectionCheck = () => {
			if (selectionTimeoutRef.current === null) return
			window.clearTimeout(selectionTimeoutRef.current)
			selectionTimeoutRef.current = null
		}

		const showPopupForSelection = () => {
			const selection = window.getSelection()
			const text = selection?.toString().trim() || ''

			if (text.length < 3) {
				setSelectedText('')
				setPosition(null)
				return
			}

			if (!selection || selection.rangeCount === 0) {
				setSelectedText('')
				setPosition(null)
				return
			}

			if (!isSelectionInLlamaProse(selection)) {
				setSelectedText('')
				setPosition(null)
				return
			}

			const range = selection.getRangeAt(0)
			const rect = range.getBoundingClientRect()
			const centeredLeft = rect.left + window.scrollX + rect.width / 2

			const aboveTop = rect.top + window.scrollY - POPUP_OFFSET
			const fitsAbove = rect.top - POPUP_OFFSET >= VIEWPORT_MARGIN
			const top = fitsAbove ? aboveTop : rect.bottom + window.scrollY + VIEWPORT_MARGIN

			setSelectedText(text.slice(0, 2000))
			setPosition({ top, left: centeredLeft })
		}

		const schedulePopupForSelection = (delay = 0) => {
			clearScheduledSelectionCheck()
			selectionTimeoutRef.current = window.setTimeout(() => {
				selectionTimeoutRef.current = null
				showPopupForSelection()
			}, delay)
		}

		const handleMouseDown = (e: MouseEvent) => {
			if (popupRef.current?.contains(e.target as Node)) return
			clearScheduledSelectionCheck()
			setSelectedText('')
			setPosition(null)
		}

		const handlePointerSelectionEnd = () => schedulePopupForSelection(20)
		const handleDoubleClick = () => schedulePopupForSelection(40)
		const handleSelectionChange = () => schedulePopupForSelection()

		document.addEventListener('pointerup', handlePointerSelectionEnd)
		document.addEventListener('dblclick', handleDoubleClick)
		document.addEventListener('mousedown', handleMouseDown)
		document.addEventListener('selectionchange', handleSelectionChange)
		return () => {
			clearScheduledSelectionCheck()
			document.removeEventListener('pointerup', handlePointerSelectionEnd)
			document.removeEventListener('dblclick', handleDoubleClick)
			document.removeEventListener('mousedown', handleMouseDown)
			document.removeEventListener('selectionchange', handleSelectionChange)
		}
	}, [])

	const dismiss = () => {
		setSelectedText('')
		setPosition(null)
		window.getSelection()?.removeAllRanges()
	}

	const handleClick = () => {
		onSelect(selectedText)
		dismiss()
	}

	// Rich capture for article export: the rendered DOM slice, not the plain text —
	// formatting, links, tables, and chart containers survive.
	const handleAddToArticle = () => {
		if (!onAddToArticle) return
		const selection = window.getSelection()
		if (!selection || selection.rangeCount === 0) return
		const container = document.createElement('div')
		container.appendChild(selection.getRangeAt(0).cloneContents())
		onAddToArticle(container.innerHTML)
		dismiss()
	}

	if (!selectedText || !position) return null

	// Same surface recipe as the app's popover menus (ui/Popover), laid out
	// horizontally — the popup should read as native chrome, not a foreign pill.
	const actionButton =
		'flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 body-sm text-primary hover:bg-hover-row focus-visible:bg-hover-row focus-visible:outline-hidden'

	return createPortal(
		<div
			ref={popupRef}
			style={{
				position: 'absolute',
				top: position.top,
				left: position.left,
				transform: 'translateX(-50%)',
				zIndex: 9999,
				animation: 'llama-popup-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
			}}
			className="flex items-stretch overflow-hidden rounded-xl border border-medium bg-overlay shadow-overlay-sm"
		>
			<button type="button" onClick={handleClick} className={actionButton}>
				<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-3.5" />
				Ask LlamaAI
			</button>
			{onAddToArticle ? (
				<button type="button" onClick={handleAddToArticle} className={`${actionButton} border-l border-medium`}>
					<Icon name="file-plus" height={13} width={13} className="opacity-70" />
					Add to article
				</button>
			) : null}
		</div>,
		document.body
	)
}
