import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { SavedChangedNotice, sameValue, useSavedDraft } from '~/containers/Articles/admin/savedDraft'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { ArticleApiError, createTrustedLogo, listTrustedLogos, updateTrustedLogo } from '~/containers/Articles/api'
import type { TrustedLogo, TrustedLogoPayload } from '~/containers/Articles/types'
import { ImageUploadButton } from '~/containers/Articles/upload/ImageUploadButton'

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
	if (!state.name.trim()) errors.name = 'Name is required'
	const linkUrl = state.linkUrl.trim()
	if (!linkUrl) errors.linkUrl = 'Link URL is required'
	else if (!/^(https?:\/\/)/.test(linkUrl)) errors.linkUrl = 'Must start with http:// or https://'
	if (!state.imageUrl.trim()) errors.imageUrl = 'Image is required'
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

	const errors = validate(state)
	const hasError = Object.keys(errors).length > 0

	const saveMutation = useMutation({
		mutationFn: async (submitted: FormState) => {
			const payload = buildPayload(submitted)
			if (logo) return updateTrustedLogo(logo.id, payload, authorizedFetch)
			return createTrustedLogo(payload, authorizedFetch)
		},
		onSuccess: () => {
			revalidate()
			toast.success(logo ? 'Logo saved' : 'Logo created')
		},
		onError: (error) => {
			toast.error(error instanceof ArticleApiError ? error.message : 'Failed to save')
		}
	})

	const update = (patch: Partial<FormState>) => setState((prev) => ({ ...prev, ...patch }))

	if (logoId && logosQuery.isLoading) {
		return <div className="mx-auto py-24 text-center text-sm text-tertiary">Loading…</div>
	}

	if (logoId && !logo) {
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-error/30 bg-error/5 p-6">
				<h1 className="text-xl font-semibold text-primary">Couldn't find this logo</h1>
			</div>
		)
	}

	// The save happened whatever the reader did next, so the revalidation and the toast belong to the
	// mutation. Only the redirect is tied to this form still being on screen, and that goes on the
	// mutate call, which React Query drops if the form unmounted first.
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (hasError) return
		saveMutation.mutate(state, {
			onSuccess: (saved) => {
				acceptSaved(logoToForm(saved), state)
				router.push('/research/admin/trusted-by')
			}
		})
	}

	return (
		<form onSubmit={handleSubmit} className="mx-auto grid w-full max-w-2xl gap-6 px-1 pb-16">
			<label className="grid gap-1.5">
				<span className="text-sm font-medium text-primary">Name</span>
				<input
					type="text"
					value={state.name}
					onChange={(e) => update({ name: e.target.value })}
					placeholder="e.g. Coinbase"
					className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
				/>
				{errors.name ? <p className="text-xs text-error">{errors.name}</p> : null}
			</label>

			<label className="grid gap-1.5">
				<span className="text-sm font-medium text-primary">Link URL</span>
				<input
					type="url"
					value={state.linkUrl}
					onChange={(e) => update({ linkUrl: e.target.value })}
					placeholder="https://…"
					className="w-full rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary outline-hidden transition-colors focus:border-link/60"
				/>
				{errors.linkUrl ? <p className="text-xs text-error">{errors.linkUrl}</p> : null}
			</label>

			<div className="grid gap-1.5">
				<span className="text-sm font-medium text-primary">Logo image</span>
				<ImageUploadButton
					scope="trusted-logo"
					previewShape="wide"
					currentUrl={state.imageUrl || null}
					onUploaded={(result) => update({ imageUrl: result.url })}
					onCleared={() => update({ imageUrl: '' })}
					label="logo image"
					helperText="webp/png, transparent background, at least 400px wide"
				/>
				{errors.imageUrl ? <p className="text-xs text-error">{errors.imageUrl}</p> : null}
			</div>

			<div className="sticky bottom-0 -mx-1 mt-2 grid gap-2 border-t border-medium bg-page/90 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-page/70">
				{conflict ? <SavedChangedNotice noun="logo" onLoadSaved={loadSaved} /> : null}
				<div className="flex items-center justify-between gap-3">
					<span className="inline-flex items-center gap-2 text-xs text-tertiary">
						<span
							aria-hidden
							className={`size-1.5 rounded-full transition-colors ${dirty ? 'bg-warning' : 'bg-success'}`}
						/>
						{dirty ? 'Unsaved changes' : logo ? 'All changes saved' : 'New logo'}
					</span>
					<button
						type="submit"
						disabled={hasError || saveMutation.isPending || (!dirty && !!logo)}
						className="rounded-md bg-link px-4 py-2 text-sm font-medium text-on-brand transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
					>
						{saveMutation.isPending ? 'Saving…' : logo ? 'Save changes' : 'Create logo'}
					</button>
				</div>
			</div>
		</form>
	)
}
