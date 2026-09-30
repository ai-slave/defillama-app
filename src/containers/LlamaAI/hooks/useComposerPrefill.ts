import { useCallback, useRef, useState } from 'react'

export interface ComposerPrefillRequest {
	key: number
	text: string
}

/** A one-shot request for the composer to take `text` when it is empty. The composer consumes each key once. */
export function useComposerPrefill() {
	const [request, setRequest] = useState<ComposerPrefillRequest | null>(null)
	// Keys keep counting after a request is consumed: one derived from the cleared request would repeat a key
	// the composer has already used, and it would skip the new text.
	const lastKeyRef = useRef(0)
	const prefill = useCallback((text: string) => {
		lastKeyRef.current += 1
		setRequest({ key: lastKeyRef.current, text })
	}, [])
	const consume = useCallback(() => setRequest(null), [])
	return { request, prefill, consume }
}
