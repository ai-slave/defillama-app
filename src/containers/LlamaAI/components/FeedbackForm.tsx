import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { Button } from '~/ui/Button'
import { dialogScrollableBodyStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { handleSimpleFetchResponse } from '~/utils/async'

interface FeedbackFormProps {
	messageId?: string
	selectedRating: 'good' | 'bad' | null
	setSelectedRating: (rating: 'good' | 'bad' | null) => void
	setShowFeedback: (show: boolean) => void
	onRatingSubmitted: (rating: 'good' | 'bad' | null) => void
}

export function FeedbackForm({
	messageId,
	selectedRating,
	setSelectedRating,
	setShowFeedback,
	onRatingSubmitted
}: FeedbackFormProps) {
	const { authorizedFetch } = useAuthContext()
	const { mutate: submitFeedback, isPending: isSubmittingFeedback } = useMutation({
		mutationFn: async ({ rating, feedback }: { rating: 'good' | 'bad' | null; feedback?: string }) => {
			const res = await authorizedFetch(`${AI_SERVER}/user/messages/${messageId}/rate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rating, feedback })
			})
				.then((response) => assertResponse(response, 'Failed to submit feedback'))
				.then(handleSimpleFetchResponse)
				.then((res: Response) => res.json())

			return res
		},
		onSuccess: (_, variables) => {
			onRatingSubmitted(variables.rating)
			setShowFeedback(false)
			toast.success('Thank you for your feedback!')
		},
		onError: (error) => {
			console.error('Failed to submit feedback:', error)
			toast.error(error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.')
		}
	})

	const [feedbackText, setFeedbackText] = useState('')
	const finalFeedbackText = useDeferredValue(feedbackText)
	const handleSubmitFeedback = () => {
		trackUmamiEvent('llamaai-feedback-text-submit')
		submitFeedback({ rating: selectedRating, feedback: feedbackText.trim() || undefined })
	}

	return (
		<>
			<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-4`}>
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 label-sm text-secondary">Rate this response</legend>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setSelectedRating('good')}
							disabled={isSubmittingFeedback}
							aria-pressed={selectedRating === 'good'}
							className={`flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 label-sm ${
								selectedRating === 'good'
									? 'border-success bg-success/12 text-success'
									: 'border-medium text-secondary not-disabled:not-aria-disabled:hover:border-success not-disabled:not-aria-disabled:hover:text-success'
							}`}
						>
							<Icon name="thumbs-up" height={14} width={14} />
							Good
						</button>
						<button
							type="button"
							onClick={() => setSelectedRating('bad')}
							disabled={isSubmittingFeedback}
							aria-pressed={selectedRating === 'bad'}
							className={`flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 label-sm ${
								selectedRating === 'bad'
									? 'border-error bg-error/12 text-error'
									: 'border-medium text-secondary not-disabled:not-aria-disabled:hover:border-error not-disabled:not-aria-disabled:hover:text-error'
							}`}
						>
							<Icon name="thumbs-down" height={14} width={14} />
							Bad
						</button>
					</div>
				</fieldset>
				<label className="flex flex-col gap-1.5">
					<span className="label-sm text-secondary">Additional feedback (optional)</span>
					<textarea
						placeholder="Share your thoughts..."
						className={`${textareaStyles} w-full resize-none`}
						rows={3}
						maxLength={500}
						value={feedbackText}
						disabled={isSubmittingFeedback}
						onChange={(e) => setFeedbackText(e.target.value)}
					/>
					<span className="body-sm text-tertiary">{finalFeedbackText.length}/500</span>
				</label>
			</div>
			<div className="flex shrink-0 justify-end gap-2 border-t border-subtle px-4 py-3">
				<Ariakit.DialogDismiss disabled={isSubmittingFeedback} render={<Button size="md" />}>
					Cancel
				</Ariakit.DialogDismiss>
				<Button
					type="button"
					size="md"
					variant="primary"
					onClick={handleSubmitFeedback}
					disabled={isSubmittingFeedback || !selectedRating}
				>
					{isSubmittingFeedback ? <LoadingSpinner size={14} /> : null}
					{isSubmittingFeedback ? 'Submitting…' : 'Submit'}
				</Button>
			</div>
		</>
	)
}
