import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { FormSubmitEvent } from '~/types/forms'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { DashboardRatingDecision } from '../dashboardTypes'

interface RatingProps {
	sessionId: string
	mode: 'create' | 'iterate'
	variant: 'banner' | 'inline'
	prompt?: string
	onSubmit: (sessionId: string, decision: DashboardRatingDecision) => Promise<void>
}

export function Rating(props: RatingProps) {
	return <RatingForm key={props.sessionId} {...props} />
}

function RatingForm({ sessionId, mode, variant, prompt, onSubmit }: RatingProps) {
	const [rating, setRating] = useState(0)
	const formRef = useRef<HTMLFormElement>(null)
	const submission = useMutation({
		mutationFn: (decision: DashboardRatingDecision) => onSubmit(sessionId, decision),
		onError: (error) => {
			if (!formRef.current?.isConnected) toast.error(error.message)
		}
	})
	const bannerFeedbackId = `${sessionId}-rating-feedback-banner`
	const inlineFeedbackId = `${sessionId}-rating-feedback-inline`

	const handleSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		if (rating === 0 || submission.isPending) return
		const feedback = (new FormData(e.currentTarget).get('feedback') as string | null)?.trim()
		submission.mutate({ rating, ...(feedback ? { feedback } : {}) })
	}

	const handleSkip = () => {
		if (!submission.isPending) submission.mutate({ skipped: true })
	}

	const texts = {
		banner: {
			title: mode === 'create' ? 'Rate this AI-generated dashboard' : 'Rate this AI improvement',
			subtitle:
				mode === 'create'
					? 'How well did LlamaAI understand your requirements?'
					: 'How well did LlamaAI improve your dashboard?'
		},
		inline: {
			title: mode === 'create' ? 'Rate AI Generation' : 'Rate AI Improvement',
			subtitle: mode === 'create' ? 'Help us improve dashboard generation' : 'Help us improve dashboard iterations'
		}
	}

	const currentTexts = texts[variant]

	if (variant === 'banner') {
		return (
			<form
				ref={formRef}
				onSubmit={handleSubmit}
				className="relative isolate col-span-full flex animate-pro-glow flex-col gap-6 rounded-md border border-pro-cards-border bg-pro-cards-bg p-4"
			>
				<div className="flex flex-wrap items-center gap-4">
					<h3 className="text-lg font-semibold">{currentTexts.title}</h3>
					<RatingStars value={rating} onChange={setRating} disabled={submission.isPending} size={20} />
					<Ariakit.Button
						accessibleWhenDisabled
						type="button"
						onClick={handleSkip}
						className="ml-auto rounded-md p-2 hover:bg-error/10 hover:text-error aria-disabled:opacity-50"
						disabled={submission.isPending}
						aria-label="Dismiss rating"
					>
						<Icon name="x" height={16} width={16} />
					</Ariakit.Button>
				</div>

				<p className="text-sm text-pro-text-label">{currentTexts.subtitle}</p>

				{prompt ? (
					<div className="flex flex-col items-center gap-2 rounded-md border border-pro-cards-border bg-pro-app-bg p-3">
						<p className="text-xs text-pro-text-label">Prompt used:</p>
						<p className="text-center text-sm">{prompt}</p>
					</div>
				) : null}

				{rating > 0 ? (
					<div className="flex w-full flex-col gap-1">
						<label
							htmlFor={bannerFeedbackId}
							className="text-xs font-semibold tracking-wide text-pro-text-label uppercase"
						>
							Your Feedback (Optional)
						</label>
						<textarea
							id={bannerFeedbackId}
							name="feedback"
							placeholder="Share your thoughts about the AI-generated dashboard..."
							rows={3}
							className="w-full rounded-md border border-pro-cards-border bg-white p-2 text-black read-only:opacity-50 dark:bg-black dark:text-pro-text-primary"
							readOnly={submission.isPending}
						/>
					</div>
				) : null}

				<div className="mt-6 flex items-center justify-center gap-3">
					<Ariakit.Button
						accessibleWhenDisabled
						type="button"
						onClick={handleSkip}
						disabled={submission.isPending}
						className="flex items-center gap-2 px-4 py-2 text-sm hover:text-link aria-disabled:opacity-50"
					>
						{submission.isPending && 'skipped' in submission.variables ? <LoadingSpinner size={16} /> : null}
						Skip
					</Ariakit.Button>

					{rating > 0 ? (
						<Ariakit.Button
							accessibleWhenDisabled
							type="submit"
							disabled={submission.isPending}
							className="flex items-center gap-2 rounded-md bg-pro-accent px-6 py-2 font-medium text-on-brand aria-disabled:opacity-50"
						>
							{submission.isPending && !('skipped' in submission.variables) ? (
								<LoadingSpinner size={16} />
							) : (
								<Icon name="sparkles" height={16} width={16} />
							)}
							Submit Rating
						</Ariakit.Button>
					) : null}
				</div>
				<span role="status" className="sr-only">
					{submission.isPending ? ('skipped' in submission.variables ? 'Dismissing rating' : 'Saving rating') : ''}
				</span>
				{submission.error ? (
					<p role="alert" className="text-sm text-error">
						{submission.error.message}
					</p>
				) : null}
			</form>
		)
	}

	return (
		<form ref={formRef} onSubmit={handleSubmit} className="contents">
			<Icon name="sparkles" height={24} width={24} className="shrink-0 text-pro-info-400 dark:text-pro-info-200" />

			<h3 className="-mt-5 text-xl font-semibold">{currentTexts.title}</h3>
			<p className="-mt-5 text-sm text-pro-text-label">{currentTexts.subtitle}</p>

			{prompt ? (
				<div className="flex w-full max-w-xl flex-col items-center gap-2 rounded-md border border-pro-cards-border bg-pro-app-bg p-3">
					<h4 className="text-xs text-pro-text-label">Prompt used:</h4>
					<p className="text-center text-sm">{prompt}</p>
				</div>
			) : null}

			<RatingStars value={rating} onChange={setRating} disabled={submission.isPending} size={24} />

			{rating > 0 ? (
				<div className="flex w-full max-w-xl flex-col items-center gap-6">
					<div className="flex w-full flex-col items-center gap-1">
						<label
							htmlFor={inlineFeedbackId}
							className="text-center text-xs font-semibold tracking-wide text-pro-text-label uppercase"
						>
							Your Feedback (Optional)
						</label>
						<textarea
							id={inlineFeedbackId}
							name="feedback"
							placeholder="Share your thoughts about the AI-generated dashboard..."
							rows={3}
							className="w-full rounded-md border border-pro-cards-border bg-white p-2 text-black read-only:opacity-50 dark:bg-black dark:text-pro-text-primary"
							readOnly={submission.isPending}
						/>
					</div>

					<div className="flex items-center justify-center gap-3">
						<Ariakit.Button
							accessibleWhenDisabled
							type="button"
							onClick={handleSkip}
							disabled={submission.isPending}
							className="flex items-center gap-2 px-4 py-2 text-sm text-pro-text-form hover:text-link aria-disabled:opacity-50"
						>
							{submission.isPending && 'skipped' in submission.variables ? <LoadingSpinner size={16} /> : null}
							Skip
						</Ariakit.Button>
						<Ariakit.Button
							accessibleWhenDisabled
							type="submit"
							disabled={submission.isPending}
							className="flex items-center gap-2 rounded-md bg-pro-accent px-6 py-2 font-medium text-on-brand aria-disabled:opacity-50"
						>
							{submission.isPending && !('skipped' in submission.variables) ? (
								<LoadingSpinner size={16} />
							) : (
								<Icon name="sparkles" height={16} width={16} />
							)}
							Submit Rating
						</Ariakit.Button>
					</div>
				</div>
			) : (
				<>
					<p className="-mt-5 text-center text-xs text-pro-text-form">Click the stars above to rate your experience</p>

					<Ariakit.Button
						accessibleWhenDisabled
						type="button"
						onClick={handleSkip}
						disabled={submission.isPending}
						className="flex items-center gap-2 px-4 py-2 text-sm hover:text-link aria-disabled:opacity-50"
					>
						{submission.isPending && 'skipped' in submission.variables ? <LoadingSpinner size={16} /> : null}
						Skip
					</Ariakit.Button>
				</>
			)}
			<span role="status" className="sr-only">
				{submission.isPending ? ('skipped' in submission.variables ? 'Dismissing rating' : 'Saving rating') : ''}
			</span>
			{submission.error ? (
				<p role="alert" className="text-sm text-error">
					{submission.error.message}
				</p>
			) : null}
		</form>
	)
}

const RATING_VALUES = [1, 2, 3, 4, 5] as const

function RatingStars({
	value,
	onChange,
	disabled,
	size
}: {
	value: number
	onChange: (value: number) => void
	disabled: boolean
	size: 20 | 24
}) {
	const [hovered, setHovered] = useState(0)
	return (
		<Ariakit.RadioProvider value={value} setValue={(next) => onChange(next as number)} orientation="horizontal">
			<Ariakit.RadioGroup
				aria-label="Dashboard rating"
				className="flex items-center justify-center gap-1"
				onMouseLeave={() => setHovered(0)}
			>
				{RATING_VALUES.map((star) => (
					<span
						key={star}
						className={`relative rounded-sm transition-transform has-focus-visible:focus-ring has-aria-disabled:opacity-50 ${size === 20 ? 'p-1' : 'p-2'} ${disabled ? '' : 'cursor-pointer hover:scale-110'}`}
					>
						<Ariakit.Radio
							accessibleWhenDisabled
							onMouseEnter={() => {
								if (!disabled) setHovered(star)
							}}
							value={star}
							aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
							disabled={disabled}
							className="cursor-inherit absolute inset-0 z-10 size-full opacity-0"
						/>
						<Icon
							name="star"
							height={size}
							width={size}
							aria-hidden="true"
							className={`${star <= (hovered || value) ? 'fill-current text-warning' : 'text-pro-text-form'} transition-colors`}
						/>
					</span>
				))}
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
	)
}
