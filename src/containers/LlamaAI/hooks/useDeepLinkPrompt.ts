import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
	consumePendingEntrySource,
	consumePendingMode,
	consumePendingPageContext,
	consumePendingPrompt,
	consumePendingSuggestedFlag,
	hasNoPendingPrompt,
	hasPendingPrompt,
	subscribeToPendingPrompt
} from '~/containers/LlamaAI/pendingPrompt'
import type { ChatPageContext } from '~/containers/LlamaAI/streamState'
import type { AgenticAnswerMode } from '~/containers/LlamaAI/types'
import { trackUmamiEvent } from '~/utils/analytics/umami'

export type PendingPromptSubmit = (handoff: {
	prompt: string
	pageContext?: ChatPageContext
	isSuggestedQuestion?: boolean
	entrySource?: string
	mode?: AgenticAnswerMode
}) => void

function deepLinkKey(prompt: string, source: string | null, campaign: string | null) {
	return `${prompt}\n${source ?? ''}\n${campaign ?? ''}`
}

function deepLinkEventProps(prompt: string, source: string | null, campaign: string | null) {
	return {
		source,
		campaign,
		prompt: prompt.replace(/\s+/g, ' ').slice(0, 100)
	}
}

interface UseDeepLinkPromptOptions {
	isNewChat: boolean
	sharedSession: boolean
	deepLinkPrompt: string | undefined
	utmSource: string | null
	utmCampaign: string | null
	clearDeepLinkFromUrl: () => void
	submitPrompt: PendingPromptSubmit
}

export function useDeepLinkPrompt({
	isNewChat,
	sharedSession,
	deepLinkPrompt,
	utmSource,
	utmCampaign,
	clearDeepLinkFromUrl,
	submitPrompt
}: UseDeepLinkPromptOptions) {
	const submitPromptRef = useRef(submitPrompt)
	const clearDeepLinkFromUrlRef = useRef(clearDeepLinkFromUrl)
	// Written after commit rather than during render: a render-phase ref write costs the hook its
	// compiler optimization, and every reader here runs from a handler or an effect, after commit.
	useLayoutEffect(() => {
		submitPromptRef.current = submitPrompt
		clearDeepLinkFromUrlRef.current = clearDeepLinkFromUrl
	})

	const linkKey = deepLinkPrompt ? deepLinkKey(deepLinkPrompt, utmSource, utmCampaign) : null
	// Which link the user has already answered. The banner is the link itself until then, so arriving
	// at one writes no state at all.
	const [answeredKey, setAnsweredKey] = useState<string | null>(null)
	// Cleared as the link goes away, so pasting the same link again asks again. Done during render
	// because a committed answered key would suppress that second banner.
	if (!deepLinkPrompt && answeredKey !== null) setAnsweredKey(null)
	// A prompt waiting in the handover queue outranks the link, and the effect below only gets to say
	// so after a commit. Subscribed rather than read outright: the queue changes when the button hands
	// one over and again when the effect takes it, and a plain read would be cached against nothing and
	// answer the same way forever.
	const pendingQueued = useSyncExternalStore(subscribeToPendingPrompt, hasPendingPrompt, hasNoPendingPrompt)
	const confirmationPrompt =
		isNewChat && !sharedSession && !pendingQueued && deepLinkPrompt && linkKey !== answeredKey ? deepLinkPrompt : null
	// Read by nobody, so a ref: it only stops the view event firing twice for one link.
	const viewedKeyRef = useRef<string | null>(null)

	useEffect(() => {
		if (!isNewChat || sharedSession) return

		// Taken one task later, so a mount that is torn down at once (StrictMode's replay in dev) cancels the
		// timer and leaves the handover for the mount that stays. Sent from the first mount, the chat's unmount
		// cleanup would abort the request and the route reset would clear the new conversation.
		const timer = setTimeout(() => {
			const pendingPrompt = consumePendingPrompt()
			const pendingPageContext = consumePendingPageContext()
			const isSuggested = consumePendingSuggestedFlag()
			const entrySource = consumePendingEntrySource()
			const mode = consumePendingMode()
			if (pendingPrompt) {
				if (deepLinkPrompt) {
					// A pending prompt outranks the link, and the banner has to go before the url change lands, or it
					// flashes over the answer being submitted.
					setAnsweredKey(deepLinkKey(deepLinkPrompt, utmSource, utmCampaign))
					clearDeepLinkFromUrlRef.current()
				}
				submitPromptRef.current({
					prompt: pendingPrompt,
					pageContext: pendingPageContext ?? undefined,
					isSuggestedQuestion: isSuggested || undefined,
					entrySource,
					mode
				})
				return
			}

			if (deepLinkPrompt) {
				const nextKey = deepLinkKey(deepLinkPrompt, utmSource, utmCampaign)
				if (viewedKeyRef.current === nextKey) return
				viewedKeyRef.current = nextKey
				trackUmamiEvent('llamaai-deeplink-view', deepLinkEventProps(deepLinkPrompt, utmSource, utmCampaign))
			}
		})
		return () => clearTimeout(timer)
	}, [isNewChat, deepLinkPrompt, utmSource, utmCampaign, sharedSession])

	const confirm = useCallback(() => {
		const prompt = confirmationPrompt?.trim()
		if (!prompt) return
		// The link's own key, not the trimmed prompt's: they differ for a padded link, and the banner
		// closes by matching this key.
		setAnsweredKey(linkKey)
		trackUmamiEvent('llamaai-deeplink-run', deepLinkEventProps(prompt, utmSource, utmCampaign))
		clearDeepLinkFromUrlRef.current()
		submitPromptRef.current({ prompt, entrySource: utmSource ?? 'deep-link' })
	}, [confirmationPrompt, linkKey, utmCampaign, utmSource])

	const dismiss = useCallback(() => {
		if (confirmationPrompt) {
			trackUmamiEvent('llamaai-deeplink-dismiss', deepLinkEventProps(confirmationPrompt, utmSource, utmCampaign))
		}
		setAnsweredKey(linkKey)
		clearDeepLinkFromUrlRef.current()
	}, [confirmationPrompt, linkKey, utmCampaign, utmSource])

	return { confirmationPrompt, confirm, dismiss }
}
