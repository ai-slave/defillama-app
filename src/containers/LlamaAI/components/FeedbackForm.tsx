import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { memo, useDeferredValue, useId, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { assertResponse } from '~/containers/LlamaAI/utils/assertResponse'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { textareaStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { trackUmamiEvent } from '~/utils/analytics/umami'
import { handleSimpleFetchResponse } from '~/utils/async'

type Rating = 'good' | 'bad' | null

interface FeedbackDialogProps {
	open: boolean
	setOpen: (value: boolean) => void
	messageId: string
	selectedRating: Rating
	setSelectedRating: (value: Rating) => void
	onRatingSubmitted: (value: Rating) => void
}

export const FeedbackDialog = memo(function FeedbackDialog(props: FeedbackDialogProps) {
	// Each opening starts without the last opening's text or error; the closing dialog keeps them through its fade.
	const openingKey = useOpeningKey(props.open)
	return <FeedbackDialogOpening key={openingKey} {...props} />
})

function FeedbackDialogOpening({
	open,
	setOpen,
	messageId,
	selectedRating,
	setSelectedRating,
	onRatingSubmitted
}: FeedbackDialogProps) {
	const id = useId()
	const { authorizedFetch } = useAuthContext()
	const submission = useMutation({
		mutationFn: async ({ rating, feedback }: { rating: Rating; feedback?: string }) => {
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
			setOpen(false)
			// After the dialog closes: nothing toasts over an open dialog.
			toast.success('Thank you for your feedback!')
		},
		onError: (error) => {
			console.error('Failed to submit feedback:', error)
		}
	})
	const pending = submission.isPending

	const [feedbackText, setFeedbackText] = useState('')
	const finalFeedbackText = useDeferredValue(feedbackText)
	const handleSubmitFeedback = () => {
		trackUmamiEvent('llamaai-feedback-text-submit')
		submission.mutate({ rating: selectedRating, feedback: feedbackText.trim() || undefined })
	}

	return (
		<Dialog size="sm" open={open} onClose={() => setOpen(false)} pending={pending} unmountOnHide portal>
			<DialogHeader title="Provide feedback" />
			<DialogBody>
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 label-sm text-secondary">Rate this response</legend>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setSelectedRating('good')}
							disabled={pending}
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
							disabled={pending}
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
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-feedback`} className="label-sm text-secondary">
						Additional feedback (optional)
					</label>
					{/* Ariakit's autoFocus, so the dialog starts in the text field instead of the header ×. */}
					<Ariakit.Focusable
						autoFocus
						render={
							<textarea
								id={`${id}-feedback`}
								placeholder="e.g. The TVL figure is out of date"
								className={`${textareaStyles} w-full resize-none`}
								rows={3}
								maxLength={500}
								value={feedbackText}
								readOnly={pending}
								aria-describedby={`${id}-count`}
								onChange={(e) => setFeedbackText(e.target.value)}
							/>
						}
					/>
					<p id={`${id}-count`} className="body-sm text-tertiary">
						{finalFeedbackText.length}/500
					</p>
				</div>
				{submission.error ? (
					<InlineStatus variant="error">Couldn&apos;t send your feedback. Try again.</InlineStatus>
				) : null}
			</DialogBody>
			<DialogFooter
				leading={selectedRating ? null : <p className="body-sm text-secondary">Choose Good or Bad to submit.</p>}
				dismiss={
					<Button type="button" size="md" onClick={() => setOpen(false)} disabled={pending}>
						Cancel
					</Button>
				}
			>
				<Button
					type="button"
					size="md"
					variant="primary"
					onClick={handleSubmitFeedback}
					disabled={!selectedRating}
					pendingLabel={pending ? 'Submitting…' : null}
				>
					Submit
				</Button>
			</DialogFooter>
		</Dialog>
	)
}
