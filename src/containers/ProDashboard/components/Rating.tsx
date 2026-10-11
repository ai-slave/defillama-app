import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { FormSubmitEvent } from '~/types/forms'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Field } from '~/ui/Field'
import { pageContent, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Textarea } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { httpErrorMessage } from '~/utils/async'
import type { DashboardRatingDecision } from '../dashboardTypes'

interface RatingProps {
	sessionId: string
	mode: 'create' | 'iterate'
	prompt?: string
	onSubmit: (sessionId: string, decision: DashboardRatingDecision) => Promise<void>
}

// The banner leaves once the rating is saved or skipped; focus that was on it goes to the page, not the body.
const focusPageOnLeave = passFocusOnLeave(() => pageContent())

export function Rating(props: RatingProps) {
	return <RatingForm key={props.sessionId} {...props} />
}

function RatingForm({ sessionId, mode, prompt, onSubmit }: RatingProps) {
	const [rating, setRating] = useState(0)
	const formRef = useRef<HTMLFormElement>(null)
	// The last failure, not the mutation's error: that one clears as soon as a retry starts. Success removes the banner.
	const [error, setError] = useState<string | null>(null)
	const submission = useMutation({
		mutationFn: (decision: DashboardRatingDecision) => onSubmit(sessionId, decision),
		onError: (failure) => {
			const message = httpErrorMessage(failure, "Couldn't save your rating.")
			if (formRef.current?.isConnected) setError(message)
			else toast.error(message)
		}
	})
	const skipping = submission.isPending && 'skipped' in submission.variables
	const saving = submission.isPending && !skipping

	// Submit only renders once a rating is picked.
	const handleSubmit = (e: FormSubmitEvent) => {
		e.preventDefault()
		const feedback = (new FormData(e.currentTarget).get('feedback') as string | null)?.trim()
		submission.mutate({ rating, ...(feedback ? { feedback } : {}) })
	}

	const handleSkip = () => submission.mutate({ skipped: true })

	return (
		<Card
			ref={(node) => {
				formRef.current = node
				return focusPageOnLeave(node)
			}}
			noValidate
			onSubmit={handleSubmit}
			as="form"
			padding="md"
			className="relative isolate col-span-full flex animate-pro-glow flex-col gap-6"
		>
			<div className="flex flex-wrap items-center gap-4">
				<h3 className="heading-xs">
					{mode === 'create' ? 'Rate this AI-generated dashboard' : 'Rate this AI improvement'}
				</h3>
				<RatingStars value={rating} onChange={setRating} disabled={submission.isPending} />
				<Tooltip
					content="Dismiss rating"
					render={
						<Button
							size="md"
							type="button"
							variant="ghost"
							square
							className="ml-auto"
							onClick={handleSkip}
							disabled={submission.isPending}
							accessibleWhenDisabled
							aria-label="Dismiss rating"
						/>
					}
				>
					<Icon name="x" className="size-4" />
				</Tooltip>
			</div>

			<p className="body-md text-secondary">
				{mode === 'create'
					? 'How well did LlamaAI understand your requirements?'
					: 'How well did LlamaAI improve your dashboard?'}
			</p>

			{prompt ? (
				<div className="flex flex-col items-center gap-2 rounded-md border border-subtle bg-page p-3">
					<p className="body-sm text-secondary">Prompt used:</p>
					<p className="text-center body-md">{prompt}</p>
				</div>
			) : null}

			{rating > 0 ? (
				<Field label="Feedback (optional)">
					{(control) => (
						<Textarea
							{...control}
							name="feedback"
							placeholder="Share your thoughts about the AI-generated dashboard…"
							rows={3}
							className="w-full"
							readOnly={submission.isPending}
							aria-busy={submission.isPending || undefined}
						/>
					)}
				</Field>
			) : null}

			<div className="mt-6 flex items-center justify-center gap-3">
				<Button
					size="md"
					type="button"
					variant="ghost"
					onClick={handleSkip}
					pendingLabel="Skipping…"
					pending={skipping}
					disabled={saving}
				>
					Skip
				</Button>

				{rating > 0 ? (
					<Button
						size="md"
						type="submit"
						variant="primary"
						pendingLabel="Submitting…"
						pending={saving}
						disabled={skipping}
					>
						<Icon name="sparkles" className="size-3.5" />
						Submit Rating
					</Button>
				) : null}
			</div>
			<span role="status" className="sr-only">
				{submission.isPending ? (skipping ? 'Dismissing rating' : 'Saving rating') : ''}
			</span>
			{error ? <InlineStatus variant="error">{error}</InlineStatus> : null}
		</Card>
	)
}

const RATING_VALUES = [1, 2, 3, 4, 5] as const

function RatingStars({
	value,
	onChange,
	disabled
}: {
	value: number
	onChange: (value: number) => void
	disabled: boolean
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
						className={`relative rounded-sm p-1 has-focus-visible:focus-ring has-aria-disabled:text-disabled ${disabled ? '' : 'cursor-pointer'}`}
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
							aria-hidden="true"
							className={`size-5 ${star <= (hovered || value) ? 'fill-current text-warning' : 'text-secondary'} transition-colors`}
						/>
					</span>
				))}
			</Ariakit.RadioGroup>
		</Ariakit.RadioProvider>
	)
}
