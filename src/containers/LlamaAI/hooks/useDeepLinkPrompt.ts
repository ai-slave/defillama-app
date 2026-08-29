import { useCallback, useEffect, useRef, useState } from 'react'
import {
	consumePendingPageContext,
	consumePendingPrompt,
	consumePendingSuggestedFlag
} from '~/components/LlamaAIFloatingButton'
import type { ChatPageContext } from '~/containers/LlamaAI/streamState'
import { trackUmamiEvent } from '~/utils/analytics/umami'

export type PendingPromptSubmit = (prompt: string, pageContext?: ChatPageContext, isSuggestedQuestion?: boolean) => void

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
	const [confirmationPrompt, setConfirmationPrompt] = useState<string | null>(null)
	const consumedKeyRef = useRef<string | null>(null)
	const submitPromptRef = useRef(submitPrompt)
	submitPromptRef.current = submitPrompt
	const clearDeepLinkFromUrlRef = useRef(clearDeepLinkFromUrl)
	clearDeepLinkFromUrlRef.current = clearDeepLinkFromUrl

	useEffect(() => {
		if (!isNewChat || sharedSession) return

		const pendingPrompt = consumePendingPrompt()
		const pendingPageContext = consumePendingPageContext()
		const isSuggested = consumePendingSuggestedFlag()
		if (pendingPrompt) {
			if (deepLinkPrompt) {
				consumedKeyRef.current = deepLinkKey(deepLinkPrompt, utmSource, utmCampaign)
				setConfirmationPrompt(null)
				clearDeepLinkFromUrlRef.current()
			}
			submitPromptRef.current(pendingPrompt, pendingPageContext ?? undefined, isSuggested || undefined)
			return
		}

		if (deepLinkPrompt) {
			const nextKey = deepLinkKey(deepLinkPrompt, utmSource, utmCampaign)
			if (consumedKeyRef.current === nextKey) return
			consumedKeyRef.current = nextKey
			setConfirmationPrompt(deepLinkPrompt)
			trackUmamiEvent('llamaai-deeplink-view', deepLinkEventProps(deepLinkPrompt, utmSource, utmCampaign))
			return
		}

		consumedKeyRef.current = null
		setConfirmationPrompt(null)
	}, [isNewChat, deepLinkPrompt, utmSource, utmCampaign, sharedSession])

	const confirm = useCallback(() => {
		const prompt = confirmationPrompt?.trim()
		if (!prompt) return
		consumedKeyRef.current = deepLinkKey(prompt, utmSource, utmCampaign)
		setConfirmationPrompt(null)
		trackUmamiEvent('llamaai-deeplink-run', deepLinkEventProps(prompt, utmSource, utmCampaign))
		clearDeepLinkFromUrlRef.current()
		submitPromptRef.current(prompt)
	}, [confirmationPrompt, utmCampaign, utmSource])

	const dismiss = useCallback(() => {
		if (confirmationPrompt) {
			trackUmamiEvent('llamaai-deeplink-dismiss', deepLinkEventProps(confirmationPrompt, utmSource, utmCampaign))
		}
		setConfirmationPrompt(null)
		clearDeepLinkFromUrlRef.current()
	}, [confirmationPrompt, utmCampaign, utmSource])

	return { confirmationPrompt, confirm, dismiss }
}
