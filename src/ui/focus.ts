import { flushSync } from 'react-dom'

const FOCUSABLE = 'button, [href], input, select, textarea, summary, [tabindex]'

function firstFocusableIn(container: HTMLElement): HTMLElement {
	for (const element of container.querySelectorAll<HTMLElement>(FOCUSABLE)) {
		if (element.tabIndex >= 0 && !element.matches(':disabled') && element.checkVisibility()) return element
	}
	return container
}

/* ----------------------------------------------------------------------------
   catchLostFocus — the dialog surface's ref (Dialog, SideSheet, and raw
   Ariakit dialogs that cannot use them yet). When an update removes, disables
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
---------------------------------------------------------------------------- */

/** The control in the list row after `control`'s row, else the row before: where focus goes when that row leaves. */
export function neighbourRowControl(control: Element | null) {
	const row = control?.closest('li')
	return (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>('button, a[href], input')
}

export function keepFocus(commit: () => void, target: () => HTMLElement | null | undefined) {
	const from = document.activeElement
	flushSync(commit)
	if (from instanceof HTMLElement && from.isConnected && from.checkVisibility()) return
	target()?.focus()
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
    around the retry (`tabIndex={-1}`, such as a dashboard card or a list) takes focus, unless content that loaded in
    its place did. Inside a dialog the dialog's own net (catchLostFocus) catches it instead. */
export const focusRegionOnLeave = passFocusOnLeave((node) =>
	node.closest('[data-dialog]') ? null : node.parentElement?.closest<HTMLElement>('[tabindex]')
)

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
