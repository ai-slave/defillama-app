import * as Ariakit from '@ariakit/react'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'

function getElementFromNode(node: Node | null) {
	if (!node) return null
	return node instanceof Element ? node : node.parentElement
}

// Messages render one data-llamaai-prose block PER markdown segment, with charts,
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
	if (anchor.closest('[data-llamaai-prose]') || focus.closest('[data-llamaai-prose]')) return true
	// Both endpoints can land on widgets (charts, controls) while the drag sweeps
	// prose between them — qualify if the range intersects any prose block.
	const range = selection.getRangeAt(0)
	for (const prose of Array.from(document.querySelectorAll('[data-llamaai-prose]'))) {
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
	// Keep the range when keyboard focus moves to an action and the browser collapses its selection.
	const [selectionRange, setSelectionRange] = useState<Range | null>(null)
	const popupRef = useRef<HTMLDivElement>(null)
	const popover = Ariakit.usePopoverStore({
		placement: 'top',
		open: selectionRange !== null,
		setOpen: (open) => {
			if (!open) setSelectionRange(null)
		}
	})

	useEffect(() => {
		let timer: number | undefined
		const clearScheduledCheck = () => window.clearTimeout(timer)
		const updateSelection = () => {
			if (popupRef.current?.contains(document.activeElement)) return
			const selection = window.getSelection()
			if (!selection || selection.toString().trim().length < 3 || !isSelectionInLlamaProse(selection)) {
				setSelectionRange(null)
				return
			}
			setSelectionRange(selection.getRangeAt(0).cloneRange())
		}
		const onSelectionChange = () => {
			clearScheduledCheck()
			timer = window.setTimeout(updateSelection, 0)
		}
		const onMouseDown = (event: MouseEvent) => {
			if (popupRef.current?.contains(event.target as Node)) return
			clearScheduledCheck()
			setSelectionRange(null)
		}
		document.addEventListener('selectionchange', onSelectionChange)
		document.addEventListener('mousedown', onMouseDown)
		return () => {
			clearScheduledCheck()
			document.removeEventListener('selectionchange', onSelectionChange)
			document.removeEventListener('mousedown', onMouseDown)
		}
	}, [])

	const dismiss = () => {
		setSelectionRange(null)
		window.getSelection()?.removeAllRanges()
	}
	// Dismiss before handing the text on: clearing the page selection resets the caret of a field the callback has
	// just focused, so a quote would leave the composer's caret at the start of its draft.
	const handleClick = () => {
		if (!selectionRange) return
		const text = selectionRange.toString().trim().slice(0, 2000)
		dismiss()
		onSelect(text)
	}
	const handleAddToArticle = () => {
		if (!onAddToArticle || !selectionRange) return
		const container = document.createElement('div')
		container.appendChild(selectionRange.cloneContents())
		dismiss()
		onAddToArticle(container.innerHTML)
	}
	const anchor = selectionRange
		? getElementFromNode(selectionRange.endContainer)?.closest<HTMLElement>(
				'p, li, pre, h1, h2, h3, h4, h5, h6, [data-llamaai-prose]'
			)
		: null
	useEffect(() => {
		popover.setAnchorElement(anchor)
		// A virtual range can move without resizing its element or reopening the popup.
		if (selectionRange) popover.render()
	}, [popover, anchor, selectionRange])

	const actionButton =
		'flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2 body-sm text-primary not-disabled:not-aria-disabled:hover:bg-hover-row focus-visible:bg-hover-row'

	return (
		<Ariakit.Popover
			store={popover}
			ref={popupRef}
			aria-label="Selected text actions"
			portal
			unmountOnHide
			fixed
			gutter={8}
			overflowPadding={8}
			fitViewport
			autoFocusOnShow={false}
			hideOnInteractOutside={() => !isSelectionInLlamaProse(window.getSelection())}
			autoFocusOnHide={false}
			preserveTabOrderAnchor={anchor}
			getAnchorRect={() => selectionRange?.getBoundingClientRect() ?? null}
			className="z-9999 flex max-w-[calc(100vw-16px)] flex-wrap items-stretch overflow-hidden rounded-xl border border-medium bg-overlay shadow-overlay"
		>
			<Ariakit.Button onClick={handleClick} className={actionButton}>
				<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-3.5" />
				Ask LlamaAI
			</Ariakit.Button>
			{onAddToArticle ? (
				<Ariakit.Button onClick={handleAddToArticle} className={`${actionButton} border-l border-medium`}>
					<Icon name="file-plus" height={14} width={14} className="text-secondary" />
					Add to article
				</Ariakit.Button>
			) : null}
		</Ariakit.Popover>
	)
}
