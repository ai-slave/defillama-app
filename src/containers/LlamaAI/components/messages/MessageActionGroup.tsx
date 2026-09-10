import Router from 'next/router'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { sanitizeUrl } from '~/containers/LlamaAI/utils/markdownHelpers'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { trackUmamiEvent } from '~/utils/analytics/umami'

function getActionKey(action: { label: string; message: string }) {
	return `${action.label}:${action.message}`
}

function getIndexedActionKey(action: { label: string; message: string }, index: number) {
	return `${getActionKey(action)}-${index}`
}

function sanitizeExternalActionHref(href: string) {
	// Model-authored external actions must pass through the same URL sanitizer
	// as markdown links before they can open a new tab.
	const safeHref = sanitizeUrl(href)
	if (!safeHref) return null

	try {
		const parsed = new URL(safeHref)
		return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
	} catch {
		return null
	}
}

function sanitizeInternalActionHref(href: string) {
	const trimmed = href.trim()
	if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('\\')) return null
	if (Array.from(trimmed).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) return null
	return trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?') ? trimmed : null
}

function getActionHrefProps(href: string, label: string) {
	const safeHref = sanitizeExternalActionHref(href)
	if (safeHref) {
		return {
			href: safeHref,
			target: '_blank' as const,
			rel: 'noopener noreferrer',
			onClick: () => {
				trackUmamiEvent('llamaai-action-link-click', { label })
			}
		}
	}

	const safeInternalHref = sanitizeInternalActionHref(href)
	return {
		href: safeInternalHref ? `https://defillama.com${safeInternalHref}` : '#',
		onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => {
			event.preventDefault()
			if (!safeInternalHref) return
			trackUmamiEvent('llamaai-action-link-click', { label })
			void Router.push(safeInternalHref)
		}
	}
}

function extractActionUrl(message: string) {
	if (!message.startsWith('url:')) return null
	const href = message.slice(4).trim()
	return href.length > 0 ? href : null
}

function ActionLink({
	action,
	variant
}: {
	action: { label: string; message: string; compositeId: string }
	variant: 'decision' | 'suggestion'
}) {
	const href = extractActionUrl(action.message)

	if (!href) {
		return <span className="inline-flex items-center gap-1.5 text-inherit">{action.label}</span>
	}

	return (
		<Button
			as="a"
			{...getActionHrefProps(href, action.label)}
			variant={variant === 'decision' ? 'outline' : 'filter'}
			size="md"
		>
			{action.label}
			<Icon name="arrow-up-right" height={14} width={14} aria-hidden />
		</Button>
	)
}

/**
 * Model-authored follow-ups. A decision group (any `confirm:` action) is a primary button plus
 * secondary actions; anything else is a row of suggestion pills. The next user message
 * identifies the sent action when reading or restoring a conversation.
 */
export function ActionButtonGroup({
	actions,
	onActionClick,
	nextUserMessage
}: {
	actions: Array<{ label: string; message: string }>
	onActionClick?: (message: string) => void
	nextUserMessage?: string
}) {
	const isDecisionGroup = actions.some((action) => action.message.startsWith('confirm:'))
	const resolvedActions = actions.map((action, index) => {
		const resolvedAction = {
			label: action.label,
			message: action.message.startsWith('confirm:') ? action.message.slice(8) : action.message
		}
		return {
			...resolvedAction,
			compositeId: getIndexedActionKey(resolvedAction, index)
		}
	})
	const primaryActionKey = resolvedActions.find((action) => !action.message.startsWith('url:'))?.compositeId
	// The conversation is the receipt. A gated or rejected submission must never look sent.
	const sentActionKey = resolvedActions.find((action) => action.message === nextUserMessage)?.compositeId

	const handleActionClick = (action: { label: string; message: string }) => {
		if (!onActionClick) return
		trackUmamiEvent('llamaai-action-click', { label: action.label })
		onActionClick(action.message)
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{resolvedActions.map((action) => {
				const actionKey = action.compositeId
				if (action.message.startsWith('url:')) {
					return <ActionLink key={actionKey} action={action} variant={isDecisionGroup ? 'decision' : 'suggestion'} />
				}
				const sent = sentActionKey === actionKey
				const isPrimary = isDecisionGroup && actionKey === primaryActionKey
				return (
					<Button
						key={actionKey}
						type="button"
						size="md"
						variant={sent ? 'secondary' : isPrimary ? 'primary' : isDecisionGroup ? 'secondary' : 'filter'}
						disabled={!onActionClick}
						onClick={() => handleActionClick(action)}
					>
						{action.label}
						{sent ? (
							<span className="flex items-center gap-1 text-secondary">
								<Icon name="check" height={14} width={14} />
								Sent
							</span>
						) : null}
					</Button>
				)
			})}
		</div>
	)
}
