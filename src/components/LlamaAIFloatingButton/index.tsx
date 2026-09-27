import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useEntityQuestions } from '~/containers/LlamaAI/hooks/useEntityQuestions'
import { useSuggestedQuestions } from '~/containers/LlamaAI/hooks/useSuggestedQuestions'
import { notifyKeyChange, subscribeToStorageKey } from '~/contexts/localStorageStore'
import { useMedia } from '~/hooks/useMedia'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { DialogCloseButton, DialogHeading } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { textareaStyles } from '~/ui/Input'
import { tooltipSurfaceStyles } from '~/ui/Popover'
import { trackUmamiEvent } from '~/utils/analytics/umami'

const PENDING_PROMPT_KEY = 'llamaai-pending-prompt'
const PENDING_PAGE_CONTEXT_KEY = 'llamaai-pending-page-context'
const PENDING_PROJECT_ID_KEY = 'llamaai-pending-project-id'

export function setPendingProjectId(projectId: string | null) {
	if (typeof window === 'undefined') return
	if (projectId) {
		localStorage.setItem(PENDING_PROJECT_ID_KEY, projectId)
	} else {
		localStorage.removeItem(PENDING_PROJECT_ID_KEY)
	}
}

export function consumePendingProjectId(): string | null {
	if (typeof window === 'undefined') return null
	const id = localStorage.getItem(PENDING_PROJECT_ID_KEY)
	if (id) localStorage.removeItem(PENDING_PROJECT_ID_KEY)
	return id
}

const FALLBACK_SUGGESTIONS = [
	'Which protocols have growing TVL and revenue but declining token prices?',
	'What are the best stablecoin yields with at least $10M TVL?',
	'Chart Pump.fun percentage share of total revenue across all launchpads'
]

function useEntityContext() {
	const router = useRouter()
	const path = router.asPath

	if (path.startsWith('/protocol/')) {
		const slug = path.split('/protocol/')[1]?.split(/[?#]/)[0]
		return slug ? { entitySlug: slug, entityType: 'protocol' as const } : null
	}
	if (path.startsWith('/chain/') && !path.includes('/chain/All')) {
		const slug = path.split('/chain/')[1]?.split(/[?#]/)[0]
		return slug ? { entitySlug: slug, entityType: 'chain' as const } : null
	}
	const pageRoutes: Record<string, string> = {
		'/perps': 'perps',
		'/stablecoins': 'stablecoins',
		'/chains': 'chains',
		'/fees': 'fees',
		'/revenue': 'revenue'
	}
	for (const [route, slug] of Object.entries(pageRoutes)) {
		if (path === route || path.startsWith(`${route}?`) || path.startsWith(`${route}/`)) {
			return { entitySlug: slug, entityType: 'page' as const }
		}
	}
	return null
}

export function setPendingPrompt(prompt: string) {
	if (typeof window === 'undefined') return
	localStorage.setItem(PENDING_PROMPT_KEY, prompt)
	notifyKeyChange(PENDING_PROMPT_KEY)
}

/** Notifies on both handover and consumption, so a reader can defer to a waiting prompt reactively. */
export function subscribeToPendingPrompt(callback: () => void) {
	return subscribeToStorageKey(PENDING_PROMPT_KEY, callback)
}

/** Whether a prompt is waiting, without taking it. Lets a reader defer to it before it is consumed. */
export function hasPendingPrompt(): boolean {
	if (typeof window === 'undefined') return false
	return localStorage.getItem(PENDING_PROMPT_KEY) !== null
}

export function hasNoPendingPrompt(): boolean {
	return false
}

export function consumePendingPrompt(): string | null {
	if (typeof window === 'undefined') return null
	const prompt = localStorage.getItem(PENDING_PROMPT_KEY)
	if (prompt) {
		localStorage.removeItem(PENDING_PROMPT_KEY)
		notifyKeyChange(PENDING_PROMPT_KEY)
	}
	return prompt
}

const PENDING_SUGGESTED_KEY = 'llamaai-pending-suggested'

export function setPendingSuggestedFlag() {
	if (typeof window !== 'undefined') {
		localStorage.setItem(PENDING_SUGGESTED_KEY, 'true')
	}
}

export function consumePendingSuggestedFlag(): boolean {
	if (typeof window === 'undefined') return false
	const val = localStorage.getItem(PENDING_SUGGESTED_KEY)
	if (val) localStorage.removeItem(PENDING_SUGGESTED_KEY)
	return val === 'true'
}

export function setPendingPageContext(
	context: { entitySlug?: string; entityType?: 'protocol' | 'chain' | 'page'; route: string } | null
) {
	if (typeof window === 'undefined') return
	if (context) {
		localStorage.setItem(PENDING_PAGE_CONTEXT_KEY, JSON.stringify(context))
	} else {
		localStorage.removeItem(PENDING_PAGE_CONTEXT_KEY)
	}
}

export function consumePendingPageContext(): {
	entitySlug?: string
	entityType?: 'protocol' | 'chain' | 'page'
	route: string
} | null {
	if (typeof window === 'undefined') return null
	const raw = localStorage.getItem(PENDING_PAGE_CONTEXT_KEY)
	if (!raw) return null
	localStorage.removeItem(PENDING_PAGE_CONTEXT_KEY)
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}

export function LlamaAIFloatingButton() {
	const router = useRouter()
	const [isOpen, setIsOpen] = useState(false)
	const [value, setValue] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const isDesktop = useMedia('(min-width: 768px)')

	const entityContext = useEntityContext()
	const { data: entityData } = useEntityQuestions(
		entityContext?.entitySlug ?? null,
		entityContext?.entityType ?? null,
		isOpen && !!entityContext
	)
	const { data: suggestedData } = useSuggestedQuestions(isOpen && !entityContext)

	const suggestions = useMemo(() => {
		// Use entity questions if on protocol/chain page
		if (entityContext && entityData?.questions?.length) {
			return entityData.questions.slice(0, 4)
		}

		if (!suggestedData?.categories) return FALLBACK_SUGGESTIONS

		const allPrompts: Array<string> = []
		for (const prompts of Object.values(suggestedData.categories)) {
			if (Array.isArray(prompts)) {
				allPrompts.push(...prompts.slice(0, 2))
			}
		}

		return allPrompts.length > 0 ? allPrompts.slice(0, 4) : FALLBACK_SUGGESTIONS
	}, [entityContext, entityData, suggestedData])

	const handleSubmit = useCallback(
		(e?: FormSubmitEvent) => {
			e?.preventDefault()
			const prompt = value.trim()
			if (!prompt) return

			trackUmamiEvent('llamaai-fab-submit', { page: router.asPath })

			setPendingPrompt(prompt)
			setPendingPageContext({
				entitySlug: entityContext?.entitySlug,
				entityType: entityContext?.entityType,
				route: router.asPath
			})
			void router.push('/ai/chat')
			setIsOpen(false)
			setValue('')
		},
		[value, router, entityContext]
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
				e.preventDefault()
				handleSubmit()
			}
			if (e.key === 'Escape') {
				setIsOpen(false)
			}
		},
		[handleSubmit]
	)

	const handleButtonClick = useCallback(() => {
		trackUmamiEvent('llamaai-fab-click', { page: router.asPath })
		setIsOpen(true)
	}, [router.asPath])

	return (
		<>
			<Ariakit.TooltipProvider>
				<Ariakit.TooltipAnchor
					render={
						<button
							type="button"
							onClick={handleButtonClick}
							className="fixed right-6 bottom-6 z-50 flex size-14 items-center justify-center rounded-full bg-ai-gold-cta shadow-ai-gold-cta transition-transform duration-200 hover:scale-105 active:scale-95"
							aria-label="Ask LlamaAI"
						>
							<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-8 object-contain" />
						</button>
					}
				/>
				<Ariakit.Tooltip className={`${tooltipSurfaceStyles} px-3 py-2`}>Ask LlamaAI</Ariakit.Tooltip>
			</Ariakit.TooltipProvider>

			<Ariakit.DialogProvider open={isOpen} setOpen={setIsOpen}>
				<Ariakit.Dialog
					portal
					unmountOnHide
					autoFocusOnShow={() => {
						textareaRef.current?.focus()
						return false
					}}
					className={
						isDesktop
							? 'fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-l border-medium bg-overlay shadow-dialog dark:shadow-dialog-deep'
							: 'fixed right-0 bottom-0 left-0 z-50 flex max-h-[70dvh] flex-col rounded-t-xl border-t border-medium bg-overlay shadow-dialog dark:shadow-dialog-deep'
					}
				>
					<div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
						<div className="flex size-10 items-center justify-center rounded-full bg-ai-gold-cta">
							<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-6 object-contain" />
						</div>
						<div className="flex-1">
							<DialogHeading>Ask LlamaAI</DialogHeading>
							<p className="body-sm text-secondary">AI-powered DeFi insights</p>
						</div>
						<DialogCloseButton />
					</div>

					<div className="flex flex-1 flex-col overflow-hidden">
						<div className="flex-1 overflow-y-auto overscroll-contain p-5">
							<div className="mb-4">
								<p className="mb-3 body-sm text-secondary">
									{entityContext ? `Ask about ${entityContext.entitySlug}:` : 'Try one of these:'}
								</p>
								<div className="flex flex-col gap-2">
									{suggestions.map((suggestion) => (
										<button
											key={suggestion}
											type="button"
											onClick={() => setValue(suggestion)}
											className="rounded-lg border border-medium bg-page px-3 py-2 text-left body-sm text-secondary transition-colors hover:bg-hover-row hover:text-primary"
										>
											{suggestion}
										</button>
									))}
								</div>
							</div>
						</div>

						<form onSubmit={handleSubmit} className="border-t border-subtle p-4">
							<div className="relative">
								<textarea
									ref={textareaRef}
									value={value}
									onChange={(e) => setValue(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Ask LlamaAI about TVL, fees, revenue, protocols..."
									className={`${textareaStyles} min-h-[100px] w-full resize-none pr-12`}
									rows={4}
								/>
								<Button
									type="submit"
									size="md"
									variant="primary"
									square
									disabled={!value.trim()}
									aria-label="Send"
									className="absolute right-2 bottom-2"
								>
									<Icon name="arrow-up" height={16} width={16} />
								</Button>
							</div>
							<p className="mt-2 body-sm text-tertiary">
								Press <kbd className="rounded-sm border border-medium bg-surface-elevated-1 px-1 mono-sm">Enter</kbd> to
								submit
							</p>
						</form>
					</div>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
		</>
	)
}
