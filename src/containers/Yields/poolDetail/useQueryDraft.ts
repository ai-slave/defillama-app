import { useCallback, useEffect, useRef, useState } from 'react'

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
	const previousCommitted = useRef(committed)
	const focused = useRef(false)

	useEffect(() => {
		if (previousCommitted.current === committed) return
		previousCommitted.current = committed
		if (focused.current) return
		// Preserve the user's spelling when this is the debounced commit of their own draft; replace
		// it only when the URL moved to a genuinely different value.
		setText((current) => (parse(current) === committed ? current : String(committed)))
	}, [committed, parse])

	const onFocus = useCallback(() => {
		focused.current = true
	}, [])
	const onBlur = useCallback(() => {
		focused.current = false
		setText((current) => String(parse(current)))
	}, [parse])
	return [text, setText, { onFocus, onBlur }]
}
