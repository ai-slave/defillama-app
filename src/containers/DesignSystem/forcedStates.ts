/* Forced interaction states for the gallery. A browser applies :hover, :focus and :active to one element at a time,
   so a page cannot show every button hovered at once. This copies each stylesheet rule that uses one of those
   pseudo-classes, with the pseudo-class swapped for "inside a wrapper marked data-force", into the same @layer and
   @media blocks, so the copy wins exactly where the real state would. A demo wrapped in
   <div data-force="hover"> then renders its direct child as hovered (a direct child, so the focus ring does not
   land on every element inside the control). */

// A label that styles its hidden input's focus (`:has(:focus-visible)`) and a field frame (`:focus-within`) take the
// state on themselves, since they are the wrapper's direct child. `(?<!\\)` skips the escaped colon inside a
// Tailwind class name (`.hover\:bg-x`), which is part of the name, not a pseudo-class.
const STATES = [
	['hover', /(?<!\\):hover/g],
	['focus-visible', /(?<!\\):has\(:focus-visible\)|(?<!\\):focus-visible/g],
	['focus', /(?<!\\):focus-within|(?<!\\):focus(?![-\w])/g],
	['active', /(?<!\\):active(?![-\w])/g]
] as const

const ANY_STATE = /(?<!\\):(hover|focus|active(?![-\w]))/

function forcedRule(rule: CSSRule): string {
	if (rule instanceof CSSStyleRule) {
		const text = rule.cssText
		if (!ANY_STATE.test(text)) return ''
		let out = ''
		for (const [state, pattern] of STATES) {
			if (!new RegExp(pattern.source).test(text)) continue
			out += text.replace(pattern, `:is([data-force~="${state}"] > *)`)
		}
		return out
	}
	if (rule instanceof CSSGroupingRule) {
		let body = ''
		for (const child of rule.cssRules) body += forcedRule(child)
		if (!body) return ''
		if (rule instanceof CSSMediaRule) return `@media ${rule.conditionText}{${body}}`
		if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}{${body}}`
		if (rule instanceof CSSLayerBlockRule) return `@layer ${rule.name}{${body}}`
		if (rule instanceof CSSContainerRule) return `@container ${rule.containerName} ${rule.containerQuery}{${body}}`
	}
	return ''
}

function buildForcedCss(): string {
	let css = ''
	for (const sheet of document.styleSheets) {
		if (sheet.ownerNode instanceof HTMLStyleElement && sheet.ownerNode.dataset.galleryForced !== undefined) continue
		for (const rule of sheet.cssRules) css += forcedRule(rule)
	}
	return css
}

/** Ref callback for the gallery root: installs the forced-state sheet and rebuilds it when a stylesheet loads or reloads. */
export function mountForcedStates(root: HTMLElement | null) {
	if (!root) return
	const style = document.createElement('style')
	style.dataset.galleryForced = ''
	let frame = 0
	const rebuild = () => {
		cancelAnimationFrame(frame)
		frame = requestAnimationFrame(() => {
			style.textContent = buildForcedCss()
		})
	}
	document.head.append(style)
	rebuild()
	const observer = new MutationObserver((records) => {
		if (records.every((record) => record.target === style)) return
		rebuild()
	})
	observer.observe(document.head, { childList: true, subtree: true, characterData: true })
	// A <link> stylesheet can finish loading after the gallery mounts, and loading changes no DOM node, so its rules
	// arrive only with its load event (captured: load does not bubble).
	const onLoad = (event: Event) => {
		if (event.target instanceof HTMLLinkElement) rebuild()
	}
	document.addEventListener('load', onLoad, true)
	return () => {
		cancelAnimationFrame(frame)
		observer.disconnect()
		document.removeEventListener('load', onLoad, true)
		style.remove()
	}
}
