import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import {
	setPendingEntrySource,
	setPendingPageContext,
	setPendingPrompt,
	setPendingSuggestedFlag
} from '~/containers/LlamaAI/pendingPrompt'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { trackUmamiEvent } from '~/utils/analytics/umami'

interface Props {
	questions: Array<string>
	entitySlug: string
	entityType: 'protocol' | 'chain' | 'page'
	entityName?: string
	isLoading?: boolean
}

const tileStyles =
	'hover-wash-card flex min-h-8 shrink-0 snap-start touch-pan-x items-center rounded-lg border border-subtle bg-surface px-3 py-1.5 body-sm whitespace-nowrap text-secondary hover:text-primary focus-visible:text-primary'

const arrowStyles =
	'pointer-events-auto hidden size-7 place-items-center rounded-full border border-medium bg-surface text-secondary hover:text-primary focus-visible:text-primary sm:grid'

const SignInDialog = lazy(() =>
	import('~/containers/Subscription/SignInDialog').then((module) => ({ default: module.SignInDialog }))
)

export function EntityQuestionsStrip({ questions, entitySlug, entityType, entityName, isLoading }: Props) {
	const router = useRouter()
	const { isAuthenticated, hasActiveSubscription, loaders } = useAuthContext()
	const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
	const [isOpen, setIsOpen] = useState(false)
	const signInDialogStore = Ariakit.useDialogStore({ open: isOpen, setOpen: setIsOpen })
	const trackRef = useRef<HTMLDivElement>(null)
	const [edges, setEdges] = useState({ left: false, right: false })
	const displayName = entityName || entitySlug

	// Show an arrow only on the side the track can still scroll toward.
	const observeTrack = useCallback((el: HTMLDivElement | null) => {
		trackRef.current = el
		if (!el) return
		const update = () => {
			const left = el.scrollLeft > 1
			const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
			setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
		}
		update()
		el.addEventListener('scroll', update, { passive: true })
		const observer = new ResizeObserver(update)
		observer.observe(el)
		if (el.firstElementChild) observer.observe(el.firstElementChild)
		return () => {
			el.removeEventListener('scroll', update)
			observer.disconnect()
		}
	}, [])

	const scrollBy = (dir: -1 | 1) => {
		const el = trackRef.current
		if (!el) return
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduceMotion ? 'auto' : 'smooth' })
	}

	if (!isLoading && !questions?.length) return null

	const handleClick = (question: string) => {
		trackUmamiEvent('llamaai-entity-question-click', {
			entitySlug,
			entityType,
			question: question.slice(0, 50),
			page: router.asPath,
			hasSub: isAuthenticated && hasActiveSubscription
		})
		setPendingPrompt(question)
		setPendingSuggestedFlag()
		setPendingEntrySource('entity-strip')
		setPendingPageContext({
			entitySlug,
			entityType,
			route: router.asPath
		})
		if (!loaders.userLoading && isAuthenticated) {
			void router.push('/ai/chat')
		} else {
			setPendingQuestion(question)
			signInDialogStore.show()
		}
	}

	return (
		<>
			<div className="flex max-w-full items-stretch gap-2.5 rounded-md border-l-2 border-l-ai-gold py-2 pl-3">
				<div className="flex shrink-0 items-center gap-1.5">
					<img src="/assets/llamaai/llama-ai.svg" alt="" className="size-4" />
					<span className="label-sm whitespace-nowrap text-ai-gold-deep dark:text-ai-gold-bright">
						Ask about {displayName}
					</span>
				</div>
				<div className="relative min-w-0 flex-1">
					<div
						ref={observeTrack}
						className="flex scrollbar-none snap-x overflow-x-auto [-webkit-overflow-scrolling:touch]"
					>
						<div className="flex min-w-max flex-nowrap gap-2">
							{isLoading
								? [120, 160, 140, 180, 130].map((w, i) => (
										// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
										<Skeleton key={`skeleton-${i}`} className="h-8 shrink-0 rounded-lg" style={{ width: w }} />
									))
								: questions.map((question) => (
										<button
											type="button"
											key={`q-string-${question}`}
											onClick={() => handleClick(question)}
											className={tileStyles}
										>
											{question}
										</button>
									))}
						</div>
					</div>
					{edges.left ? (
						<div className="pointer-events-none absolute inset-y-0 left-0 flex w-16 items-center bg-linear-to-l from-transparent to-page">
							<button
								type="button"
								onClick={() => scrollBy(-1)}
								aria-label="Previous questions"
								className={arrowStyles}
							>
								<Icon name="chevron-left" height={14} width={14} />
							</button>
						</div>
					) : null}
					{edges.right ? (
						<div className="pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-end bg-linear-to-r from-transparent to-page">
							<button type="button" onClick={() => scrollBy(1)} aria-label="More questions" className={arrowStyles}>
								<Icon name="chevron-right" height={14} width={14} />
							</button>
						</div>
					) : null}
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
