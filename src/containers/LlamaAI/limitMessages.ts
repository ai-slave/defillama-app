import { getUsageLimitText } from '~/containers/LlamaAI/components/UsageLimit'
import type { FreeLimitError, UsageLimitError } from '~/containers/LlamaAI/runAgenticRequest'
import type { Message, UsageLimitOffer } from '~/containers/LlamaAI/types'

/**
 * The thread message for a free-plan limit. The server's wording leads, without its upsell paragraph: the offer card
 * under the message carries the upgrade. llama-mcp writes the countdown into every free-limit message that has a
 * reset time except FREE_DAILY_LIMIT's, so only that code and the chat's own fallback line get one here.
 */
export function buildFreeLimitMessage(err: FreeLimitError, nowMs: number): Message {
	// 'Upgrade required' is what the request layer throws when the server sent no wording.
	const serverText = err.message && err.message !== 'Upgrade required' ? err.message.split('\n\n')[0].trim() : ''
	let content =
		serverText ||
		(err.code === 'FREE_DAILY_LIMIT'
			? "You've reached today's free question limit."
			: "You've reached your free question limit.")
	const resetMs = err.details?.resetTime ? Date.parse(err.details.resetTime) - nowMs : 0
	if ((!serverText || err.code === 'FREE_DAILY_LIMIT') && resetMs > 0) {
		const hours = Math.floor(resetMs / 3_600_000)
		const minutes = Math.floor((resetMs % 3_600_000) / 60_000)
		content += ` Resets in ${hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`}.`
	}
	return {
		role: 'assistant',
		content,
		freeLimitOffer: { code: err.code, resetTime: err.details?.resetTime ?? null }
	}
}

/** The offer for a research or fact-checked limit, from the details the server sent with it. */
export function usageLimitOffer(details: UsageLimitError['details']): UsageLimitOffer {
	const period = details?.period
	return {
		feature: details?.feature === 'fact_checked' ? 'fact_checked' : 'research',
		// The server's details are untyped; a period the copy does not know reads as a plan-wide limit.
		period: period === 'daily' || period === 'biweekly' || period === 'blocked' ? period : 'lifetime',
		limit: details?.limit ?? 0,
		resetTime: details?.resetTime ?? null
	}
}

export function buildUsageLimitMessage(offer: UsageLimitOffer): Message {
	return { role: 'assistant', content: getUsageLimitText(offer), usageLimitOffer: offer }
}
