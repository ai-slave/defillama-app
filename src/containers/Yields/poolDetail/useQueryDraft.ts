import { useState } from 'react'

type QueryDraftFocus = { onFocus: () => void; onBlur: () => void }

/**
 * Text for a number input bound to a debounced URL value. The local text is authoritative while
 * the user edits it; a changed URL can still replace it (back/forward navigation), and blur
 * normalizes partial input to the same value the URL parser will commit.
 */
export function useQueryDraft(
	committed: number,
	parse: (text: string) => number
): [string, (text: string) => void, QueryDraftFocus] {
	const [text, setText] = useState(() => String(committed))
	const [focused, setFocused] = useState(false)
	// Each URL change is handled once, when it lands: one that arrives while the field is focused is
	// dropped, not re-applied on blur. That is memory of the change, so it adjusts state during render.
	const [seenCommitted, setSeenCommitted] = useState(committed)
	if (seenCommitted !== committed) {
		setSeenCommitted(committed)
		// Preserve the user's spelling when this is the debounced commit of their own draft; replace
		// it only when the URL moved to a genuinely different value.
		if (!focused && parse(text) !== committed) setText(String(committed))
	}

	const onFocus = () => setFocused(true)
	const onBlur = () => {
		setFocused(false)
		setText((current) => String(parse(current)))
	}
	return [text, setText, { onFocus, onBlur }]
}
