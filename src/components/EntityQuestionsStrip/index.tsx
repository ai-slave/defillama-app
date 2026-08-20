import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setPendingPrompt, setPendingPageContext, setPendingSuggestedFlag } from '~/components/LlamaAIFloatingButton'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface Props {
	questions: string[]
	entitySlug: string
	entityType: 'protocol' | 'chain' | 'page'
	entityName?: string
	isLoading?: boolean
}

const SignInDialog = lazy(() =>
	import('~/containers/Subscription/SignInDialog').then((module) => ({ default: module.SignInDialog }))
)

export function EntityQuestionsStrip({ questions, entitySlug, entityType, entityName, isLoading }: Props) {
	const router = useRouter()
	const { isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
	const [isOpen, setIsOpen] = useState(false)
	const signInDialogStore = Ariakit.useDialogStore({ open: isOpen, setOpen: setIsOpen })

	if (!isLoading && !questions?.length) return null

	const handleClick = (question: string) => {
		trackUmamiEvent('llamaai-entity-question-click', {
			entitySlug,
			entityType,
			question: question.slice(0, 50),
			page: router.asPath,
			hasSub: isAuthenticated && hasActiveSubscription
		})
		if (!loaders.userLoading && isAuthenticated) {
			setPendingPrompt(question)
			setPendingSuggestedFlag()
			setPendingPageContext({
				entitySlug,
				entityType,
				route: router.asPath
			})
			void router.push('/ai/chat')
		} else {
			setPendingPrompt(question)
			setPendingSuggestedFlag()
			setPendingPageContext({
				entitySlug,
				entityType,
				route: router.asPath
			})
			setPendingQuestion(question)
			signInDialogStore.show()
		}
	}

	const displayName = entityName || entitySlug

	return (
		<>
			<div className="rounded-md border-l-2 border-l-[#C99A4A] bg-ai-gold-bright/5 py-2 pr-2 pl-3 dark:border-l-[#FDE0A9] dark:bg-ai-gold-bright/5">
				<div className="flex scrollbar-none max-w-full touch-pan-x flex-nowrap items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
					<div className="flex shrink-0 items-center gap-1.5">
						<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-4" />
						<span className="text-xs font-medium whitespace-nowrap text-ai-gold-deep dark:text-ai-gold-bright">
							Ask about {displayName}
						</span>
					</div>
					<div className="flex min-w-max flex-nowrap gap-2">
						{isLoading
							? [120, 160, 140, 180, 130].map((w, i) => (
									<div
										key={`skeleton-${i}`}
										style={{ width: w }}
										className="relative isolate h-[30px] shrink-0 overflow-hidden rounded-md border border-ai-line bg-ai-surface-muted dark:bg-ai-surface-muted"
									>
										<div className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-shimmer bg-[linear-gradient(99.97deg,transparent,rgba(0,0,0,0.08),transparent)] dark:bg-[linear-gradient(99.97deg,transparent,rgba(255,255,255,0.08),transparent)]" />
									</div>
								))
							: questions.map((question) => (
									<button
										key={`q-string-${question}`}
										onClick={() => handleClick(question)}
										className="shrink-0 touch-pan-x rounded-md border border-ai-line bg-ai-white px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-ai-tertiary transition-all hover:border-ai-gold hover:bg-ai-gold-bright/20 hover:text-ai-gold-deep dark:bg-ai-surface-muted dark:hover:border-ai-gold-bright/50 dark:hover:bg-ai-gold-bright/10 dark:hover:text-ai-gold-bright"
									>
										{question}
									</button>
								))}
					</div>
				</div>
			</div>
			{isOpen ? (
				<Suspense fallback={null}>
					<SignInDialog
						store={signInDialogStore}
						prompt={
							pendingQuestion
								? `Sign in for 3 free AI answers per day and ask: “${pendingQuestion.slice(0, 100)}${pendingQuestion.length > 100 ? '…' : ''}”`
								: 'Sign in to get 3 free AI-answered questions per day'
						}
						onAuthenticated={() => void router.push('/ai/chat')}
					/>
				</Suspense>
			) : null}
		</>
	)
}
