import Router from 'next/router'
import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { sanitizeUrl } from '~/containers/LlamaAI/utils/markdownHelpers'
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
		<a
			{...getActionHrefProps(href, action.label)}
			className={
				variant === 'decision'
					? 'inline-flex items-center gap-1.5 rounded-full border border-ai-action/15 bg-ai-action/3 px-4 py-2 text-sm font-medium text-ai-action transition-all duration-150 hover:border-ai-action/35 hover:bg-ai-action/8 active:scale-[0.97]'
					: 'inline-flex items-center gap-1.5 rounded-full border border-ai-action/10 bg-ai-action/4 px-3 py-1.5 text-xs font-medium text-ai-action/55 transition-all duration-150 hover:border-ai-action/20 hover:bg-ai-action/8 hover:text-ai-action/75 active:scale-[0.97]'
			}
		>
			{action.label}
			<svg
				width={variant === 'decision' ? '12' : '10'}
				height={variant === 'decision' ? '12' : '10'}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className={variant === 'decision' ? undefined : 'opacity-60'}
			>
				<path d="M7 17L17 7" />
				<path d="M7 7h10v10" />
			</svg>
		</a>
	)
}

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
	const actionSignature = resolvedActions.map((action) => action.compositeId).join('|')
	const primaryActionKey = (resolvedActions.find((action) => !action.message.startsWith('url:')) || resolvedActions[0])
		?.compositeId
	// Scope optimistic clicked state to the rendered action set plus the next user
	// message so branch restores or regenerated suggestions do not inherit old clicks.
	const optimisticScope = `${actionSignature}:${nextUserMessage ?? ''}`
	const alreadyClicked = nextUserMessage
		? (resolvedActions.find((action) => !action.message.startsWith('url:') && action.message === nextUserMessage)
				?.compositeId ?? null)
		: null
	const [optimisticClickedIds, setOptimisticClickedIds] = useState<{ ids: Set<string>; scope: string } | null>(null)
	const clickedIds = new Set<string>()
	if (alreadyClicked) clickedIds.add(alreadyClicked)
	if (optimisticClickedIds?.scope === optimisticScope) {
		for (const id of optimisticClickedIds.ids) {
			clickedIds.add(id)
		}
	}

	const handleActionClick = (action: { label: string; message: string; compositeId: string }) => {
		if (!onActionClick) return
		trackUmamiEvent('llamaai-action-click', { label: action.label })
		setOptimisticClickedIds((current) => {
			const ids = current?.scope === optimisticScope ? new Set(current.ids) : new Set<string>()
			ids.add(action.compositeId)
			return { ids, scope: optimisticScope }
		})
		onActionClick(action.message)
	}

	if (isDecisionGroup) {
		return (
			<div className="flex flex-wrap items-center gap-2.5">
				{resolvedActions.map((action) => {
					const isUrl = action.message.startsWith('url:')
					const actionKey = action.compositeId
					const isPrimary = !isUrl && actionKey === primaryActionKey

					if (isUrl) {
						return <ActionLink key={actionKey} action={action} variant="decision" />
					}

					if (isPrimary) {
						return (
							<button
								key={actionKey}
								type="button"
								disabled={!onActionClick}
								onClick={() => handleActionClick(action)}
								className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-150 ${
									!clickedIds.has(action.compositeId)
										? onActionClick
											? 'bg-ai-action text-ai-white hover:bg-ai-action-hover active:scale-[0.97] dark:bg-ai-action dark:hover:bg-ai-action-hover'
											: 'bg-ai-surface-muted text-ai-muted dark:bg-ai-surface-muted'
										: 'bg-ai-action text-ai-white dark:bg-ai-action'
								}`}
							>
								{action.label}
							</button>
						)
					}

					return (
						<button
							key={actionKey}
							type="button"
							disabled={!onActionClick}
							onClick={() => handleActionClick(action)}
							className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-all duration-150 ${
								!clickedIds.has(action.compositeId)
									? onActionClick
										? 'border-ai-action/20 text-ai-action hover:border-ai-action/40 hover:bg-ai-action/6 active:scale-[0.97] dark:hover:bg-ai-action/6'
										: 'border-ai-line text-ai-muted'
									: 'border-ai-action bg-ai-action/10 text-ai-action dark:border-ai-action'
							}`}
						>
							{action.label}
						</button>
					)
				})}
			</div>
		)
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{resolvedActions.map((action) => {
				const isUrl = action.message.startsWith('url:')
				const actionKey = action.compositeId

				if (isUrl) {
					return <ActionLink key={actionKey} action={action} variant="suggestion" />
				}

				return (
					<button
						key={actionKey}
						type="button"
						disabled={!onActionClick}
						onClick={() => handleActionClick(action)}
						className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
							!clickedIds.has(action.compositeId)
								? onActionClick
									? 'border-ai-action/10 bg-ai-action/4 text-ai-action/55 hover:border-ai-action/20 hover:bg-ai-action/8 hover:text-ai-action/75 active:scale-[0.97]'
									: 'border-ai-action/5 bg-ai-action/2 text-ai-action/30 dark:border-ai-action/5 dark:text-ai-action/25'
								: 'border-ai-action/25 bg-ai-action/8 text-ai-action/70 dark:border-ai-action/25 dark:text-ai-action/70'
						}`}
					>
						{action.label}
					</button>
				)
			})}
		</div>
	)
}
