import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { SavedChangedNotice, sameValue, useSavedDraft } from '~/containers/Articles/admin/savedDraft'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { ArticleApiError, createTrustedLogo, listTrustedLogos, updateTrustedLogo } from '~/containers/Articles/api'
import type { TrustedLogo, TrustedLogoPayload } from '~/containers/Articles/types'
import { ImageUploadButton } from '~/containers/Articles/upload/ImageUploadButton'
import { Button } from '~/ui/Button'
import { Field, FieldGroup } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input } from '~/ui/Input'
import { EmptyState, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'

type FormState = {
	name: string
	linkUrl: string
	imageUrl: string
}

function logoToForm(logo: TrustedLogo | null): FormState {
	if (!logo) return { name: '', linkUrl: '', imageUrl: '' }
	return { name: logo.name, linkUrl: logo.linkUrl, imageUrl: logo.imageUrl }
}

function buildPayload(state: FormState): TrustedLogoPayload {
	return {
		name: state.name.trim(),
		linkUrl: state.linkUrl.trim(),
		imageUrl: state.imageUrl.trim()
	}
}

type FormErrors = {
	name?: string
	linkUrl?: string
	imageUrl?: string
}

function validate(state: FormState): FormErrors {
	const errors: FormErrors = {}
	if (!state.name.trim()) errors.name = 'Enter a name.'
	const linkUrl = state.linkUrl.trim()
	if (!linkUrl) errors.linkUrl = 'Enter the link URL.'
	else if (!/^(https?:\/\/)/.test(linkUrl)) errors.linkUrl = 'Enter a valid URL starting with http:// or https://.'
	if (!state.imageUrl.trim()) errors.imageUrl = 'Upload a logo image.'
	return errors
}

type Props = {
	logoId?: string
}

export function TrustedLogoForm({ logoId }: Props) {
	const router = useRouter()
	const { authorizedFetch } = useAuthContext()
	const revalidate = useResearchLandingRevalidation()

	const logosQuery = useQuery<Array<TrustedLogo>>({
		queryKey: ['trusted-by-logos'],
		queryFn: () => listTrustedLogos(authorizedFetch),
		retry: false
	})

	const logo = logoId ? ((logosQuery.data ?? []).find((item) => item.id === logoId) ?? null) : null

	const {
		draft: state,
		setDraft: setState,
		dirty,
		conflict,
		loadSaved,
		acceptSaved
	} = useSavedDraft(logo, logo?.id ?? null, logoToForm, sameValue)

	const [submitted, setSubmitted] = useState(false)
	const errors = validate(state)
	const hasError = Object.keys(errors).length > 0
	const shown = submitted ? errors : {}

	const saveMutation = useMutation({
		mutationFn: async (values: FormState) => {
			const payload = buildPayload(values)
			if (logo) return updateTrustedLogo(logo.id, payload, authorizedFetch)
			return createTrustedLogo(payload, authorizedFetch)
		},
		onSuccess: () => {
			revalidate()
			toast.success(logo ? 'Logo saved' : 'Logo created')
		},
		onError: (error) => {
			toast.error(error instanceof ArticleApiError ? error.message : "Couldn't save.")
		}
	})

	const update = (patch: Partial<FormState>) => setState((prev) => ({ ...prev, ...patch }))

	// A failed list read is not a missing logo: say so and offer the retry.
	if (logoId && queryReadFailed(logosQuery)) {
		return (
			<PanelStatus variant="error" retry={logosQuery} className="mx-auto w-full max-w-2xl">
				Couldn&apos;t load the logos.
			</PanelStatus>
		)
	}

	if (logoId && logosQuery.isLoading) {
		return <PanelLoadingStatus label="Loading logo" className="mx-auto w-full max-w-2xl" />
	}

	// The page header holds the h1 ("Edit logo"), so the empty state's title is the next level down.
	if (logoId && !logo) {
		return (
			<EmptyState
				size="lg"
				headingAs="h2"
				title="Logo not found"
				actions={
					<Button as={BasicLink} href="/research/admin/trusted-by" size="md">
						Back to Trusted By
					</Button>
				}
			/>
		)
	}

	// The save happened whatever the reader did next, so the revalidation and the toast belong to the
	// mutation. Only the redirect is tied to this form still being on screen, and that goes on the
	// mutate call, which React Query drops if the form unmounted first.
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (hasError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		saveMutation.mutate(state, {
			onSuccess: (saved) => {
				acceptSaved(logoToForm(saved), state)
				router.push('/research/admin/trusted-by')
			}
		})
	}

	return (
		<form noValidate onSubmit={handleSubmit} className="mx-auto grid w-full max-w-2xl gap-6 px-1 pb-16">
			<Field label="Name" error={shown.name}>
				{(control) => (
					<Input
						{...control}
						type="text"
						required
						value={state.name}
						onChange={(e) => update({ name: e.target.value })}
						placeholder="e.g. Coinbase"
						className="w-full"
					/>
				)}
			</Field>

			<Field label="Link URL" error={shown.linkUrl}>
				{(control) => (
					<Input
						{...control}
						type="url"
						required
						value={state.linkUrl}
						onChange={(e) => update({ linkUrl: e.target.value })}
						placeholder="https://…"
						className="w-full"
					/>
				)}
			</Field>

			<FieldGroup label="Logo image" error={shown.imageUrl}>
				<ImageUploadButton
					scope="trusted-logo"
					previewShape="wide"
					currentUrl={state.imageUrl || null}
					onUploaded={(result) => update({ imageUrl: result.url })}
					onCleared={() => update({ imageUrl: '' })}
					label="logo image"
					helperText="webp/png, transparent background, at least 400px wide"
				/>
			</FieldGroup>

			<div className="sticky bottom-0 -mx-1 mt-2 grid gap-2 border-t border-medium bg-page-glass px-2 py-3 backdrop-blur">
				{conflict ? <SavedChangedNotice noun="logo" onLoadSaved={loadSaved} /> : null}
				<div className="flex items-center justify-between gap-3">
					<span className="inline-flex items-center gap-2 body-sm text-tertiary">
						<span
							aria-hidden
							className={`size-1.5 rounded-full transition-colors ${dirty ? 'bg-warning' : 'bg-success'}`}
						/>
						{dirty ? 'Unsaved changes' : logo ? 'All changes saved' : 'New logo'}
					</span>
					{/* Disabled only with nothing to save, which the status beside it says. Focusable while disabled: a save
					    leaves nothing dirty, which disables the button that was pressed. */}
					<Button
						variant="primary"
						size="md"
						pendingLabel="Saving…"
						pending={saveMutation.isPending}
						type="submit"
						disabled={!dirty && !!logo}
						accessibleWhenDisabled
					>
						{logo ? 'Save changes' : 'Create logo'}
					</Button>
				</div>
			</div>
		</form>
	)
}
