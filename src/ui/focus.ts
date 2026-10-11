import { flushSync } from 'react-dom'

// a[href], not [href]: an icon's <use href> matches that too.
const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]'

function firstFocusableIn(container: HTMLElement): HTMLElement {
	for (const element of container.querySelectorAll<HTMLElement>(FOCUSABLE)) {
		if (element.tabIndex >= 0 && !element.matches(':disabled') && element.checkVisibility()) return element
	}
	return container
}

/* ----------------------------------------------------------------------------
   catchLostFocus — the dialog surface's ref (Dialog, SideSheet, and raw
   Ariakit dialogs the raw-dialog-surface rule lists). When an update removes, disables
   or hides the control that has focus, the browser drops focus to the page
   and fires no event, so a keyboard reader starts over from the top. This
   watches the dialog and hands focus to its first focusable control instead,
   as React Aria's FocusScope does for focus that leaves a modal. It also
   catches a dialog stacked over this one (a confirmation, a popover) that
   closes onto a trigger an update already removed.
   A dialog that knows a better target (the next row, a new step's field)
   moves focus there itself; the net only catches what nothing else handled.
---------------------------------------------------------------------------- */

const WATCHED_CHANGES: MutationObserverInit = {
	subtree: true,
	childList: true,
	attributes: true,
	attributeFilter: ['disabled', 'hidden', 'class', 'style']
}

export function catchLostFocus(dialog: HTMLElement | null) {
	if (!dialog) return
	// Ariakit renders a dialog stacked over this one (popovers are dialogs too) inside this dialog's portal, beside it.
	// It names the portal after the dialog mounts, so the region is looked up when focus moves, not once here.
	const region = () => document.getElementById(dialog.dataset.dialogPortal ?? '') ?? dialog
	// The dialog holding focus: this one, one stacked over it, or none. It stays set through the removal the net is
	// waiting for: Chrome blurs a control it removes or disables (focusout to nowhere), other browsers fire nothing.
	const holderOf = (target: EventTarget | null) =>
		target instanceof Element && region().contains(target) ? target.closest<HTMLElement>('[data-dialog]') : null
	let holder = holderOf(document.activeElement)
	let watched: Element = dialog
	const onFocusIn = (event: FocusEvent) => {
		holder = holderOf(event.target)
		// Watch the portal once it exists, so a stacked dialog leaving it is seen too.
		const current = region()
		if (holder && current !== watched) {
			observer.observe(current, WATCHED_CHANGES)
			watched = current
		}
	}
	const onFocusOut = (event: FocusEvent) => {
		// Focus moving to nowhere is the loss the net catches, not focus leaving the dialog.
		if (event.relatedTarget) holder = holderOf(event.relatedTarget)
	}
	// One microtask later than the mutation: handoffs the same commit queued (passFocusOnLeave, a row moving focus to
	// its neighbour) run first, so the net only catches what nothing else handled.
	const observer = new MutationObserver(() => queueMicrotask(checkFocus))
	const checkFocus = () => {
		if (!holder || !dialog.checkVisibility()) return
		const active = document.activeElement
		const onPage = active === null || active === document.body
		if (holder === dialog) {
			// A removal drops focus at once. Disabling or hiding the control drops it on the next render; catch it before.
			const lost =
				onPage ||
				(active instanceof HTMLElement &&
					active !== dialog &&
					dialog.contains(active) &&
					(active.matches(':disabled') || !active.checkVisibility()))
			if (lost) firstFocusableIn(dialog).focus()
			return
		}
		// A stacked dialog keeps its own focus while it is open. Once it is gone, Ariakit returns focus to its trigger,
		// retrying a frame later and then asking its autoFocusOnHide when the trigger is gone; it skips that when focus
		// already moved. So the net waits until after that frame and only catches focus still left on the page.
		if (!onPage || (holder.isConnected && holder.checkVisibility())) return
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				const stillOnPage = document.activeElement === null || document.activeElement === document.body
				if (stillOnPage && dialog.isConnected && dialog.checkVisibility()) firstFocusableIn(dialog).focus()
			})
		)
	}
	observer.observe(dialog, WATCHED_CHANGES)
	// On the document: focus moving into a stacked dialog happens outside this dialog's own element.
	document.addEventListener('focusin', onFocusIn)
	document.addEventListener('focusout', onFocusOut)
	return () => {
		observer.disconnect()
		document.removeEventListener('focusin', onFocusIn)
		document.removeEventListener('focusout', onFocusOut)
	}
}

/* ----------------------------------------------------------------------------
   Focus that survives a change. When an action removes, replaces or hides the
   control that had focus (a row that leaves its list, a step that swaps, a
   pane that hides below md), the browser drops focus to the page and a
   keyboard reader starts over from the top. Every such action hands focus on:

   - keepFocus(commit, target): the change is synchronous. It commits, then
     focuses `target()` unless the control that had focus is still on screen.
   - takeLostFocus: the change lands later (a request settles, data loads).
     Put it as the ref of what replaces the control; when it mounts, it takes
     focus if focus has fallen to the page, and leaves it alone otherwise.
   - passFocusOnLeave(target): data removes the control later and nothing
     takes its place (a dismissed row, a notice a retry clears). Put it as the
     control's ref; when it leaves holding focus, `target` takes focus.
   - focusNeighbourOnLeave(fallback): a row leaves its list, now (a ×) or
     when data drops it later (an unlink that refetches). Put it as the
     control's ref and mark each row `data-row`; focus moves to the neighbour
     row's control.
---------------------------------------------------------------------------- */

/** Where focus goes when `row` leaves its list: the control in the next row that sits where `control` sits in `row`,
    else the one in the previous row. Rows of one list share their layout, so the place picks the same control (the
    next row's ×). With `control` = `row`, the neighbour row itself. Call it before the change removes the row. */
export function neighbourRowControl(row: Element, control: Element) {
	const place = [...row.querySelectorAll(FOCUSABLE)].indexOf(control)
	const pick = (neighbour: Element | null) =>
		control === row ? neighbour : neighbour?.querySelectorAll<HTMLElement>(FOCUSABLE)[place]
	return (pick(row.nextElementSibling) ?? pick(row.previousElementSibling)) as HTMLElement | null | undefined
}

export function keepFocus(commit: () => void, target: () => HTMLElement | null | undefined) {
	const from = document.activeElement
	flushSync(commit)
	if (from instanceof HTMLElement && from.isConnected && from.checkVisibility()) return
	target()?.focus()
}

/** A submit that found invalid fields: `commit` shows the errors (usually `setSubmitted(true)`), then the first invalid
    Field or FieldGroup (./Field.tsx) inside `scope` (the form, or the region whose action checks it) takes focus, so a
    screen reader reads the field with its error. Rendering first matters: focus that lands before the error exists
    reads the field without it. */
export function showFieldErrors(scope: HTMLElement, commit: () => void) {
	flushSync(commit)
	// A pane or step the reader cannot see holds no focus target; the commit shows the pane that needs fixing.
	for (const field of scope.querySelectorAll<HTMLElement>('[data-invalid]')) {
		if (!field.checkVisibility()) continue
		const target = field.querySelector<HTMLElement>('[aria-invalid="true"]')
		;(target?.checkVisibility() ? target : firstFocusableIn(field)).focus()
		return
	}
}

/** A ref callback: focus this element when it mounts, if focus has fallen to the page. A non-control target needs
    `tabIndex={-1}`. */
export function takeLostFocus(node: HTMLElement | null) {
	if (node && (document.activeElement === null || document.activeElement === document.body)) node.focus()
}

/** The page's content, for focus whose control left with nothing nearer to take it: a dialog closed after its trigger
    went, such as a sign-in that removed its Sign in button. */
export function pageContent() {
	const main = document.querySelector<HTMLElement>('main')
	if (main) main.tabIndex = -1
	return main
}

/** A ref callback for a retry that data removes once it succeeds, outside a dialog: the closest focusable region
    around the retry (`tabIndex={-1}`, such as a dashboard card) takes focus, else the page content, unless content
    that loaded in its place did. Inside a dialog the dialog's own net (catchLostFocus) catches it instead. */
export const focusRegionOnLeave = passFocusOnLeave((node) =>
	node.closest('[data-dialog]') ? null : (node.parentElement?.closest<HTMLElement>('[tabindex]') ?? pageContent())
)

/** A ref callback for a control whose row leaves its list: a remove ×, an unpin, a chip that removes itself. The row
    is the control's closest `[data-row]`, which may be the control itself. When it leaves holding focus, the control at
    the same place in the next row takes focus, else the previous row's (neighbourRowControl), else `fallback` (the
    list's search field or Add button). A neighbour that is gone or disabled once the change lands gives way to the
    fallback. The removal may run now or when data drops the row later; either way the ref sees it, so the click
    handler only removes. Inside a dialog without a nearer fallback, the dialog's net (catchLostFocus) catches the
    last row. */
export function focusNeighbourOnLeave(fallback?: (node: HTMLElement) => HTMLElement | null | undefined) {
	return (node: HTMLElement | null) => {
		if (!node) return
		return () => {
			if (!node.contains(document.activeElement)) return
			// Both targets are read while the row is still on the page. The neighbour can leave or disable in the same commit
			// (a list that hides below two rows, a last row that cannot go); the fallback takes over then. Without one, a
			// disabled neighbour that stays focusable (`accessibleWhenDisabled`) still beats the page.
			const neighbour = neighbourRowControl(node.closest('[data-row]')!, node)
			const other = fallback?.(node) ?? null
			queueMicrotask(() => {
				const present = neighbour?.isConnected ? neighbour : null
				takeLostFocus(present?.matches(':disabled, [aria-disabled="true"]') ? (other ?? present) : (present ?? other))
			})
		}
	}
}

/** A ref callback for a control that data can remove while it has focus. When it leaves holding focus, `target` takes
    focus, unless content that mounted in the same commit already did (takeLostFocus). `target` runs while the control
    is still on the page, so it can pick a neighbour. */
export function passFocusOnLeave(target: (node: HTMLElement) => HTMLElement | null | undefined) {
	return (node: HTMLElement | null) => {
		if (!node) return
		return () => {
			if (!node.contains(document.activeElement)) return
			const next = target(node) ?? null
			// A ref cleanup runs before the commit attaches new refs; waiting lets new content claim focus first. A cleanup
			// for a re-render, with the control still focused, finds focus in place and does nothing.
			queueMicrotask(() => takeLostFocus(next))
		}
	}
}
