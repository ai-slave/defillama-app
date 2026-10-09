import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { MentionSlotPreview } from '~/containers/Articles/admin/MentionSlotPreview'
import { SavedChangedNotice, sameValue, useSavedDraft } from '~/containers/Articles/admin/savedDraft'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import {
	ArticleApiError,
	createSocialMention,
	listSocialMentions,
	updateSocialMention
} from '~/containers/Articles/api'
import type { MentionQuote } from '~/containers/Articles/landing/ResearchSocialMediaMentions'
import type { SocialMention, SocialMentionPayload } from '~/containers/Articles/types'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input, Textarea } from '~/ui/Input'
import { queryReadFailed } from '~/utils/query'

type FormState = {
	quote: string
	username: string
	socialMediaName: string
	socialMediaLink: string
	xPostId: string
}

function mentionToForm(mention: SocialMention | null): FormState {
	if (!mention) {
		return { quote: '', username: '', socialMediaName: 'X', socialMediaLink: '', xPostId: '' }
	}
	return {
		quote: mention.quote ?? '',
		username: mention.username ?? '',
		socialMediaName: mention.socialMediaName || 'X',
		socialMediaLink: mention.socialMediaLink ?? '',
		xPostId: mention.xPostId ?? ''
	}
}

function buildPayload(state: FormState): SocialMentionPayload {
	return {
		quote: state.quote.trim() || null,
		username: state.username.trim() || null,
		socialMediaName: state.socialMediaName.trim() || 'X',
		socialMediaLink: state.socialMediaLink.trim() || null,
		xPostId: state.xPostId.trim() || null
	}
}

function validate(state: FormState) {
	return {
		quote: state.quote.trim() ? null : 'Enter the quote.',
		username: state.username.trim() ? null : 'Enter the username.',
		xPostId: state.xPostId.trim() ? null : 'Enter the X post id.'
	}
}

type Props = {
	mentionId?: string
}

export function SocialMentionForm({ mentionId }: Props) {
	const router = useRouter()
	const { authorizedFetch } = useAuthContext()
	const revalidate = useResearchLandingRevalidation()

	const mentionsQuery = useQuery<Array<SocialMention>>({
		queryKey: ['trusted-by-mentions'],
		queryFn: () => listSocialMentions(authorizedFetch),
		retry: false
	})

	const mention = mentionId ? ((mentionsQuery.data ?? []).find((item) => item.id === mentionId) ?? null) : null

	const {
		draft: state,
		setDraft: setState,
		dirty,
		conflict,
		loadSaved,
		acceptSaved
	} = useSavedDraft(mention, mention?.id ?? null, mentionToForm, sameValue)

	const [submitted, setSubmitted] = useState(false)
	const errors = validate(state)
	const shown = submitted ? errors : null

	const allMentions = mentionsQuery.data ?? []
	const previewSlotIndex = mentionId
		? allMentions.filter((item) => item.enabled || item.id === mentionId).findIndex((item) => item.id === mentionId) % 3
		: allMentions.filter((item) => item.enabled).length % 3
	const previewQuote: MentionQuote = {
		quote: state.quote.trim(),
		username: state.username.trim(),
		social_media_name: state.socialMediaName.trim() || 'X',
		social_media_link: '',
		x_post_id: state.xPostId.trim()
	}

	const saveMutation = useMutation({
		mutationFn: async (values: FormState) => {
			const payload = buildPayload(values)
			if (mention) return updateSocialMention(mention.id, payload, authorizedFetch)
			return createSocialMention(payload, authorizedFetch)
		},
		onSuccess: () => {
			revalidate()
			toast.success(mention ? 'Mention saved' : 'Mention created')
		},
		onError: (error) => {
			toast.error(error instanceof ArticleApiError ? error.message : 'Failed to save')
		}
	})

	const update = (patch: Partial<FormState>) => setState((prev) => ({ ...prev, ...patch }))

	// A failed list read is not a missing mention: say so and offer the retry.
	if (mentionId && queryReadFailed(mentionsQuery) && !mentionsQuery.data) {
		return (
			<div className="mx-auto grid max-w-xl justify-items-start gap-3 rounded-md border border-error-muted bg-error-faint p-6">
				<h1 className="heading-sm text-primary">Couldn't load the mentions</h1>
				<Button
					size="sm"
					onClick={() => void mentionsQuery.refetch()}
					pendingLabel={mentionsQuery.isFetching ? 'Retrying…' : null}
				>
					Try again
				</Button>
			</div>
		)
	}

	if (mentionId && mentionsQuery.isLoading) {
		return <div className="mx-auto py-24 text-center body-md text-tertiary">Loading…</div>
	}

	if (mentionId && !mention) {
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-error-muted bg-error-faint p-6">
				<h1 className="heading-sm text-primary">Couldn't find this mention</h1>
			</div>
		)
	}

	// The save happened whatever the reader did next, so the revalidation and the toast belong to the
	// mutation. Only the redirect is tied to this form still being on screen, and that goes on the
	// mutate call, which React Query drops if the form unmounted first.
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (errors.quote || errors.username || errors.xPostId) {
			return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		}
		saveMutation.mutate(state, {
			onSuccess: (saved) => {
				acceptSaved(mentionToForm(saved), state)
				router.push('/research/admin/trusted-by')
			}
		})
	}

	return (
		<form noValidate onSubmit={handleSubmit} className="mx-auto grid w-full max-w-2xl gap-6 px-1 pb-16">
			<Field label="Quote" error={shown?.quote}>
				{(control) => (
					<Textarea
						{...control}
						required
						value={state.quote}
						onChange={(e) => update({ quote: e.target.value })}
						rows={3}
						placeholder="What they said about DefiLlama"
						className="w-full resize-y"
					/>
				)}
			</Field>

			<Field label="Username" error={shown?.username}>
				{(control) => (
					<Input
						{...control}
						type="text"
						required
						value={state.username}
						onChange={(e) => update({ username: e.target.value })}
						placeholder="handle without @"
						className="w-full"
					/>
				)}
			</Field>

			<Field label="Social media name">
				{(control) => (
					<Input
						{...control}
						type="text"
						value={state.socialMediaName}
						onChange={(e) => update({ socialMediaName: e.target.value })}
						placeholder="X"
						className="w-full"
					/>
				)}
			</Field>

			<Field
				label={
					<>
						Social media link <span className="font-normal text-tertiary">(optional)</span>
					</>
				}
			>
				{(control) => (
					<Input
						{...control}
						type="url"
						value={state.socialMediaLink}
						onChange={(e) => update({ socialMediaLink: e.target.value })}
						placeholder="https://x.com/…"
						className="w-full"
					/>
				)}
			</Field>

			<Field
				label="X post id"
				hint="The numeric id from the X post URL, e.g. 2020885843125178639."
				error={shown?.xPostId}
			>
				{(control) => (
					<Input
						{...control}
						type="text"
						required
						inputMode="numeric"
						value={state.xPostId}
						onChange={(e) => update({ xPostId: e.target.value })}
						placeholder="2020885843125178639"
						className="w-full"
					/>
				)}
			</Field>

			<div className="grid gap-1.5">
				<span className="label-md text-primary">Slot previews</span>
				<div className="flex flex-wrap items-start gap-3">
					{[0, 1, 2].map((slotIndex) => {
						const isCurrent = slotIndex === (previewSlotIndex < 0 ? 0 : previewSlotIndex)
						return (
							<div key={slotIndex} className={`grid gap-1 rounded-md p-1.5 ${isCurrent ? 'ring-2 ring-link' : ''}`}>
								<MentionSlotPreview quote={previewQuote} slotIndex={slotIndex} scale={0.55} />
								{isCurrent ? (
									<span className="label-xs tracking-[0.18em] text-link uppercase">current position</span>
								) : null}
							</div>
						)
					})}
				</div>
				<p className="body-sm text-tertiary">
					The highlighted slot matches this mention's position in the list — reordering or toggling other mentions
					changes it. The other two show how the text fits if it moves.
				</p>
			</div>

			<div className="sticky bottom-0 -mx-1 mt-2 grid gap-2 border-t border-medium bg-page-glass px-2 py-3 backdrop-blur">
				{conflict ? <SavedChangedNotice noun="mention" onLoadSaved={loadSaved} /> : null}
				<div className="flex items-center justify-between gap-3">
					<span className="inline-flex items-center gap-2 body-sm text-tertiary">
						<span
							aria-hidden
							className={`size-1.5 rounded-full transition-colors ${dirty ? 'bg-warning' : 'bg-success'}`}
						/>
						{dirty ? 'Unsaved changes' : mention ? 'All changes saved' : 'New mention'}
					</span>
					{/* Disabled only with nothing to save, which the status beside it says. Focusable while disabled: a save
					    leaves nothing dirty, which disables the button that was pressed. */}
					<Button
						variant="primary"
						size="md"
						pendingLabel={saveMutation.isPending ? 'Saving…' : null}
						type="submit"
						disabled={!dirty && !!mention}
						accessibleWhenDisabled
					>
						{mention ? 'Save changes' : 'Create mention'}
					</Button>
				</div>
			</div>
		</form>
	)
}
