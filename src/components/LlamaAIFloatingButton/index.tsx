import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useEntityQuestions } from '~/containers/LlamaAI/hooks/useEntityQuestions'
import { useSuggestedQuestions } from '~/containers/LlamaAI/hooks/useSuggestedQuestions'
import { notifyKeyChange, subscribeToStorageKey } from '~/contexts/localStorageStore'
import { useMedia } from '~/hooks/useMedia'
import type { FormSubmitEvent } from '~/types/forms'
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
							className="fixed right-6 bottom-6 z-50 flex size-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
							style={{
								background: 'linear-gradient(135deg, #FDE0A9 0%, #FBEDCB 50%, #FDE0A9 100%)',
								boxShadow: '0 4px 20px rgba(253, 224, 169, 0.5), 0 2px 8px rgba(0, 0, 0, 0.1)'
							}}
							aria-label="Ask LlamaAI"
						>
							<img
								src="/assets/llamaai/llama-ai.svg"
								alt=""
								className="size-8 object-contain"
								style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
							/>
						</button>
					}
				/>
				<Ariakit.Tooltip className="z-50 rounded-lg bg-ai-inverse px-3 py-2 text-sm text-ai-on-inverse shadow-lg">
					Ask LlamaAI
				</Ariakit.Tooltip>
			</Ariakit.TooltipProvider>

			<Ariakit.DialogProvider open={isOpen} setOpen={setIsOpen}>
				<Ariakit.Dialog
					portal
					unmountOnHide
					autoFocusOnShow={() => {
						textareaRef.current?.focus()
						return false
					}}
					backdrop={<div className="fixed inset-0 z-40 bg-ai-inverse/30" />}
					className={
						isDesktop
							? 'fixed top-0 right-0 z-50 flex h-full w-[400px] flex-col border-l border-ai-line bg-ai-white shadow-2xl dark:bg-ai-surface-muted'
							: 'fixed right-0 bottom-0 left-0 z-50 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-ai-line bg-ai-white shadow-2xl dark:bg-ai-surface-muted'
					}
				>
					<div className="flex items-center gap-3 border-b border-ai-line px-5 py-4">
						<div
							className="flex size-10 items-center justify-center rounded-full"
							style={{ background: 'linear-gradient(135deg, #FDE0A9 0%, #FBEDCB 100%)' }}
						>
							<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-6 object-contain" />
						</div>
						<div className="flex-1">
							<h3 className="text-base font-semibold text-ai-primary">Ask LlamaAI</h3>
							<p className="text-sm text-ai-tertiary">AI-powered DeFi insights</p>
						</div>
						<Ariakit.DialogDismiss className="rounded-full p-2 text-ai-tertiary transition-colors hover:bg-ai-surface-muted hover:text-ai-primary">
							<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</Ariakit.DialogDismiss>
					</div>

					<div className="flex flex-1 flex-col overflow-hidden">
						<div className="flex-1 overflow-y-auto overscroll-contain p-5">
							<div className="mb-4">
								<p className="mb-3 text-sm text-ai-tertiary">
									{entityContext ? `Ask about ${entityContext.entitySlug}:` : 'Try one of these:'}
								</p>
								<div className="flex flex-col gap-2">
									{suggestions.map((suggestion) => (
										<button
											key={suggestion}
											type="button"
											onClick={() => setValue(suggestion)}
											className="rounded-lg border border-ai-line bg-ai-surface px-3 py-2 text-left text-xs text-ai-tertiary transition-colors hover:border-ai-handle hover:bg-ai-surface-muted dark:bg-ai-surface dark:hover:bg-ai-surface-muted"
										>
											{suggestion}
										</button>
									))}
								</div>
							</div>
						</div>

						<form onSubmit={handleSubmit} className="border-t border-ai-line p-4">
							<div className="relative">
								<textarea
									ref={textareaRef}
									value={value}
									onChange={(e) => setValue(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Ask LlamaAI about TVL, fees, revenue, protocols..."
									className="min-h-[100px] w-full resize-none rounded-lg border border-ai-line bg-ai-surface p-3 pr-12 text-sm text-ai-primary placeholder-ai-muted outline-hidden transition-colors focus:border-ai-action dark:bg-ai-surface"
									rows={4}
								/>
								<button
									type="submit"
									disabled={!value.trim()}
									className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-lg transition-all disabled:opacity-40"
									style={{
										background: value.trim() ? 'linear-gradient(135deg, #FDE0A9 0%, #FBEDCB 100%)' : 'transparent'
									}}
								>
									<svg
										className="size-5 text-ai-black"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
									>
										<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
									</svg>
								</button>
							</div>
							<p className="mt-2 text-xs text-ai-muted">
								Press{' '}
								<kbd className="rounded-sm bg-ai-surface-muted px-1 font-mono dark:bg-ai-surface-muted">Enter</kbd> to
								submit
							</p>
						</form>
					</div>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
		</>
	)
}
