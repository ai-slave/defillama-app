import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { Icon } from '~/ui/Icon'
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
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<p className="m-0 text-sm font-medium">Rate this response</p>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setSelectedRating('good')}
						disabled={isSubmittingFeedback}
						className={`flex flex-1 items-center justify-center gap-2 rounded-sm border p-3 transition-colors ${
							selectedRating === 'good'
								? 'border-success bg-success/12 text-success'
								: 'border-ai-line text-ai-tertiary hover:border-success hover:bg-success/5'
						}`}
					>
						<Icon name="thumbs-up" height={16} width={16} />
						<span className="text-sm font-medium">Good</span>
					</button>
					<button
						type="button"
						onClick={() => setSelectedRating('bad')}
						disabled={isSubmittingFeedback}
						className={`flex flex-1 items-center justify-center gap-2 rounded-sm border p-3 transition-colors ${
							selectedRating === 'bad'
								? 'border-error bg-error/12 text-error'
								: 'border-ai-line text-ai-tertiary hover:border-error hover:bg-error/5'
						}`}
					>
						<Icon name="thumbs-down" height={16} width={16} />
						<span className="text-sm font-medium">Bad</span>
					</button>
				</div>
			</div>
			<label className="flex flex-col gap-2">
				<span className="text-sm text-ai-tertiary">Additional feedback (optional)</span>
				<textarea
					placeholder="Share your thoughts..."
					className="w-full rounded-sm border border-ai-line bg-page p-3"
					rows={3}
					maxLength={500}
					value={feedbackText}
					disabled={isSubmittingFeedback}
					onChange={(e) => setFeedbackText(e.target.value)}
				/>
			</label>
			<div className="flex items-center justify-between">
				<p className="m-0 text-xs text-ai-tertiary">{finalFeedbackText.length}/500</p>
				<div className="flex gap-3">
					<Ariakit.DialogDismiss
						disabled={isSubmittingFeedback}
						className="rounded-sm px-3 py-2 text-xs text-ai-tertiary hover:bg-ai-surface-muted disabled:opacity-50"
					>
						Cancel
					</Ariakit.DialogDismiss>
					<button
						type="button"
						onClick={handleSubmitFeedback}
						disabled={isSubmittingFeedback || !selectedRating}
						className="rounded-sm bg-brand px-3 py-2 text-xs text-ai-white hover:opacity-90 disabled:opacity-50"
					>
						{isSubmittingFeedback ? 'Submitting...' : 'Submit'}
					</button>
				</div>
			</div>
		</div>
	)
}
