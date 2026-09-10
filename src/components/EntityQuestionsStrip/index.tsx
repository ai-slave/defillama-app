import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, Suspense, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setPendingPrompt, setPendingPageContext, setPendingSuggestedFlag } from '~/components/LlamaAIFloatingButton'
import { Button } from '~/ui/Button'
import { Skeleton } from '~/ui/Skeleton'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface Props {
	questions: Array<string>
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
			<div className="rounded-md border-l-2 border-l-ai-gold bg-ai-gold-tint py-2 pr-2 pl-3">
				<div className="flex scrollbar-none max-w-full touch-pan-x flex-nowrap items-center gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
					<div className="flex shrink-0 items-center gap-1.5">
						<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-4" />
						<span className="label-sm whitespace-nowrap text-ai-gold-deep dark:text-ai-gold-bright">
							Ask about {displayName}
						</span>
					</div>
					<div className="flex min-w-max flex-nowrap gap-2">
						{isLoading
							? [120, 160, 140, 180, 130].map((w, i) => (
									<Skeleton key={`skeleton-${i}`} className="h-8 shrink-0 rounded-lg" style={{ width: w }} />
								))
							: questions.map((question) => (
									<Button
										type="button"
										size="md"
										key={`q-string-${question}`}
										onClick={() => handleClick(question)}
										className="shrink-0 touch-pan-x"
									>
										{question}
									</Button>
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
