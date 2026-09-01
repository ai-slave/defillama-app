import { recordRouteRuntimeError } from '~/utils/telemetry'

const DISCORD_TIMEOUT_MS = 2_000
const DISCORD_FIELD_VALUE_LIMIT = 1_024
const SUCCESS_COLOR = 0x22c55e
const FAILURE_COLOR = 0xef4444

type ClaimPayload = Record<string, unknown>

export type ClaimSubmissionSource = 'utr' | 'market-maker'

export type ClaimSubmissionOutcome = { ok: true; requestId?: string | null } | { ok: false; reason: 'forgd_failed' }

function safeString(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	if (!trimmed) return null
	return trimmed
		.replace(/\\/g, '\\\\')
		.replace(/([`*_~|>[\]()])/g, '\\$1')
		.slice(0, DISCORD_FIELD_VALUE_LIMIT)
}

function field(name: string, value: unknown, inline = false) {
	const safeValue = safeString(value)
	return safeValue ? { name, value: safeValue, inline } : null
}

function webhookUrl(raw: string): URL | null {
	try {
		const url = new URL(raw)
		const allowedHost = ['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com'].includes(
			url.hostname
		)
		if (url.protocol !== 'https:' || !allowedHost || !url.pathname.startsWith('/api/webhooks/')) return null
		url.searchParams.set('wait', 'true')
		return url
	} catch {
		return null
	}
}

export async function sendClaimToDiscord(
	payload: ClaimPayload,
	source: ClaimSubmissionSource,
	outcome: ClaimSubmissionOutcome
): Promise<void> {
	const configuredUrl = process.env.UTR_DISCORD_WEBHOOK_URL?.trim()
	if (!configuredUrl) return

	const url = webhookUrl(configuredUrl)
	if (!url) {
		recordRouteRuntimeError(new Error('UTR Discord webhook URL is invalid'), 'apiRoute')
		return
	}

	const sourceLabel = source === 'utr' ? 'UTR' : 'Market Maker'
	const fields = [
		{ name: 'Result', value: outcome.ok ? 'Successful' : 'Unsuccessful', inline: true },
		{ name: 'Form', value: sourceLabel, inline: true },
		field(source === 'utr' ? 'Project' : 'Market Maker', payload.market_maker_name),
		field('Name', payload.full_name, true),
		field('Position', payload.position, true),
		field('Organization Email', payload.organization_email),
		field('Social Profile', payload.social_profile_url),
		field('Telegram', payload.telegram, true),
		field('Source URL', payload.source_url),
		payload.has_forgd_contact === true ? field('Forgd Contact', payload.forgd_contact_name ?? 'Yes') : null,
		outcome.ok ? field('Request ID', outcome.requestId) : null,
		outcome.ok ? null : { name: 'Failure', value: 'Forgd submission failed', inline: false }
	].filter((item): item is NonNullable<typeof item> => item != null)

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				allowed_mentions: { parse: [] },
				embeds: [
					{
						title: `${sourceLabel} claim submission ${outcome.ok ? 'succeeded' : 'failed'}`,
						color: outcome.ok ? SUCCESS_COLOR : FAILURE_COLOR,
						fields,
						timestamp: new Date().toISOString()
					}
				]
			}),
			signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS)
		})
		if (!response.ok) throw new Error(`Discord webhook returned HTTP ${response.status}`)
	} catch {
		recordRouteRuntimeError(new Error('UTR Discord webhook request failed'), 'apiRoute')
	}
}
