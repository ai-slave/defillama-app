import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { type AuthorProfileUpdate, getMyAuthorProfile, updateMyAuthorProfile } from '~/containers/Articles/api'
import type { ArticleAuthorProfile } from '~/containers/Articles/types'
import { ImageUploadButton } from '~/containers/Articles/upload/ImageUploadButton'
import { Button } from '~/ui/Button'
import { Field } from '~/ui/Field'
import { keepFocus, neighbourRowControl, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatusDot } from '~/ui/StatusBadge'
import { Tooltip } from '~/ui/Tooltip'
import { httpErrorMessage } from '~/utils/async'
import { formatMonthYear } from '~/utils/dateFormat'
import { formatNumber } from '~/utils/numberFormat'
import { queryReadFailed } from '~/utils/query'

const DISPLAY_NAME_MAX = 120
const SLUG_MAX = 60
const BIO_MAX = 2000
const SOCIAL_VALUE_MAX = 300
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type SocialKind = {
	id: string
	label: string
	placeholder: string
}

const PRESET_SOCIALS: Array<SocialKind> = [
	{ id: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/yourhandle' },
	{ id: 'github', label: 'GitHub', placeholder: 'https://github.com/yourhandle' },
	{ id: 'farcaster', label: 'Farcaster', placeholder: 'https://warpcast.com/yourhandle' },
	{ id: 'bluesky', label: 'Bluesky', placeholder: 'https://bsky.app/profile/you.bsky.social' },
	{ id: 'mastodon', label: 'Mastodon', placeholder: 'https://mastodon.social/@you' },
	{ id: 'telegram', label: 'Telegram', placeholder: 'https://t.me/yourhandle' },
	{ id: 'discord', label: 'Discord', placeholder: 'username or invite URL' },
	{ id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
	{ id: 'website', label: 'Website', placeholder: 'https://yourdomain.com' }
]

type FormState = {
	displayName: string
	slug: string
	bio: string
	avatarUrl: string
	socials: Record<string, string>
	customSocials: Array<{ id: string; key: string; value: string }>
}

function profileToForm(profile: ArticleAuthorProfile): FormState {
	const presetIds = new Set(PRESET_SOCIALS.map((s) => s.id))
	const presetEntries: Record<string, string> = {}
	const custom: Array<{ id: string; key: string; value: string }> = []
	for (const [key, value] of Object.entries(profile.socials || {})) {
		if (!value) continue
		if (presetIds.has(key)) presetEntries[key] = value
		else custom.push({ id: key, key, value })
	}
	return {
		displayName: profile.displayName || '',
		slug: profile.slug || '',
		bio: profile.bio || '',
		avatarUrl: profile.avatarUrl || '',
		socials: presetEntries,
		customSocials: custom
	}
}

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, SLUG_MAX)
}

function formsEqual(a: FormState, b: FormState): boolean {
	if (a.displayName !== b.displayName) return false
	if (a.slug !== b.slug) return false
	if (a.bio !== b.bio) return false
	if (a.avatarUrl !== b.avatarUrl) return false
	const aKeys = Object.keys(a.socials).sort()
	const bKeys = Object.keys(b.socials).sort()
	if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false
	if (aKeys.some((k) => a.socials[k] !== b.socials[k])) return false
	if (a.customSocials.length !== b.customSocials.length) return false
	for (let i = 0; i < a.customSocials.length; i += 1) {
		if (a.customSocials[i].key !== b.customSocials[i].key) return false
		if (a.customSocials[i].value !== b.customSocials[i].value) return false
	}
	return true
}

/** A handle that cannot work, shown while typing; an empty one waits for the submit. */
function slugFormatError(value: string): string | null {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (trimmed.length > SLUG_MAX) return `Shorten the handle to ${SLUG_MAX} characters.`
	if (!SLUG_REGEX.test(trimmed)) return 'Enter a valid handle: lowercase letters, numbers and dashes.'
	return null
}

function buildPayload(state: FormState, initial: FormState): AuthorProfileUpdate {
	const payload: AuthorProfileUpdate = {}
	if (state.displayName.trim() !== initial.displayName.trim()) {
		payload.displayName = state.displayName.trim()
	}
	if (state.slug.trim() !== initial.slug.trim()) {
		payload.slug = state.slug.trim()
	}
	if (state.bio.trim() !== initial.bio.trim()) {
		payload.bio = state.bio.trim() || null
	}
	if (state.avatarUrl.trim() !== initial.avatarUrl.trim()) {
		payload.avatarUrl = state.avatarUrl.trim() || null
	}
	const socials: Record<string, string> = {}
	for (const [key, value] of Object.entries(state.socials)) {
		const trimmed = (value || '').trim()
		if (trimmed) socials[key] = trimmed
	}
	for (const { key, value } of state.customSocials) {
		const k = slugify(key)
		const v = (value || '').trim()
		if (k && v) socials[k] = v
	}
	const initialSocials: Record<string, string> = { ...initial.socials }
	for (const { key, value } of initial.customSocials) {
		const k = slugify(key)
		if (k && value) initialSocials[k] = value
	}
	const sameSocials =
		Object.keys(socials).length === Object.keys(initialSocials).length &&
		Object.entries(socials).every(([k, v]) => initialSocials[k] === v)
	if (!sameSocials) payload.socials = socials
	return payload
}

function CharCount({ value, max }: { value: string; max: number }) {
	const len = value.length
	const near = len >= Math.floor(max * 0.9)
	return (
		<span className={`body-sm tabular-nums ${near ? 'text-warning' : 'text-tertiary'}`}>
			{formatNumber(len)}/{formatNumber(max)}
		</span>
	)
}

function LivePreview({ state, createdAt }: { state: FormState; createdAt: string | null | undefined }) {
	const displayName = state.displayName.trim() || 'Your name'
	const slug = state.slug.trim() || 'your-handle'
	const initials = displayName.slice(0, 2).toUpperCase()
	const joined = formatMonthYear(createdAt) ?? ''
	const socialCount =
		Object.values(state.socials).filter((v) => v.trim()).length +
		state.customSocials.filter((c) => c.value.trim()).length

	return (
		<section className="grid gap-4 rounded-md border border-medium bg-surface p-5 md:p-6">
			<div className="flex items-center justify-between gap-2">
				<span className="label-xs tracking-[0.2em] text-tertiary uppercase">Live preview</span>
				<span className="body-sm text-tertiary">How readers see you</span>
			</div>
			<div className="flex items-start gap-4">
				{state.avatarUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={state.avatarUrl}
						alt=""
						className="size-20 shrink-0 rounded-full border border-medium object-cover"
					/>
				) : (
					<div className="flex size-20 shrink-0 items-center justify-center rounded-full border border-medium bg-page heading-sm text-secondary">
						{initials}
					</div>
				)}
				<div className="grid min-w-0 gap-1.5">
					<h2 className="heading-sm tracking-tight text-primary">{displayName}</h2>
					<p className="mono-sm text-tertiary">@{slug}</p>
					{state.bio.trim() ? (
						<p className="line-clamp-3 max-w-prose body-md text-secondary">{state.bio.trim()}</p>
					) : (
						<p className="max-w-prose body-md text-tertiary italic">Add a bio so readers know what you cover.</p>
					)}
					{joined || socialCount > 0 ? (
						<div className="mt-1 flex flex-wrap items-center gap-2 body-sm text-tertiary">
							{joined ? <span>Joined {joined}</span> : null}
							{joined && socialCount > 0 ? <span aria-hidden>·</span> : null}
							{socialCount > 0 ? (
								<span>
									{socialCount} {socialCount === 1 ? 'link' : 'links'}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			</div>
		</section>
	)
}

/** The key field of the custom link row just added: the last row's first input. */
function newCustomKeyInput(scope: HTMLElement) {
	const inputs = scope.querySelectorAll<HTMLInputElement>('input')
	return inputs[inputs.length - 2]
}

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
	return (
		<section className="grid gap-6 border-t border-medium py-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-x-12 md:py-10">
			<div>
				<h2 className="title-lg text-primary">{title}</h2>
				<p className="mt-1.5 body-md text-secondary">{description}</p>
			</div>
			{/* content-start: the description column can be taller, and a stretched grid would pad out every field. */}
			<div className="grid min-w-0 content-start gap-5">{children}</div>
		</section>
	)
}

export function AuthorProfileForm() {
	const { authorizedFetch, isAuthenticated, loaders } = useAuthContext()
	const profileQuery = useQuery({
		queryKey: ['research', 'author-profile'],
		queryFn: () => getMyAuthorProfile(authorizedFetch),
		enabled: !loaders.userLoading && isAuthenticated,
		retry: false,
		refetchOnWindowFocus: false
	})
	const loadedProfile = profileQuery.data

	// Only a load that produced nothing is an error here. A failed refetch keeps the editor, and its
	// unsaved draft, on screen.
	if (queryReadFailed(profileQuery)) {
		const { error } = profileQuery
		return (
			<PanelStatus variant="error" retry={profileQuery} className="mx-auto w-full max-w-4xl">
				{httpErrorMessage(error, "Couldn't load your profile.")}
			</PanelStatus>
		)
	}

	// The access gate renders this form only for a signed-in researcher, so no profile yet means the read is running.
	if (!loadedProfile) return <PanelLoadingStatus label="Loading profile" className="mx-auto w-full max-w-4xl" />

	// Keyed by the loaded profile, so the fields are seeded once at mount instead of being written into
	// place after the request lands.
	return <AuthorProfileEditor key={loadedProfile.id} loadedProfile={loadedProfile} />
}

function AuthorProfileEditor({ loadedProfile }: { loadedProfile: ArticleAuthorProfile }) {
	const { authorizedFetch } = useAuthContext()
	const [profile, setProfile] = useState(loadedProfile)
	const [initial, setInitial] = useState(() => profileToForm(loadedProfile))
	const [state, setState] = useState(initial)
	const [showCustom, setShowCustom] = useState(() => initial.customSocials.length > 0)
	const updateProfileMutation = useMutation({
		mutationFn: (payload: AuthorProfileUpdate) => updateMyAuthorProfile(payload, authorizedFetch)
	})

	const [submitted, setSubmitted] = useState(false)
	const dirty = !formsEqual(state, initial)
	const slugError = slugFormatError(state.slug) ?? (state.slug.trim() ? null : 'Enter a handle.')
	const displayNameError = state.displayName.trim() ? null : 'Enter a display name.'
	const shownSlugError = submitted ? slugError : slugFormatError(state.slug)

	const slugChanged = state.slug.trim() !== initial.slug.trim()

	const update = (patch: Partial<FormState>) => setState((current) => ({ ...current, ...patch }))
	const updateSocial = (key: string, value: string) =>
		setState((current) => ({ ...current, socials: { ...current.socials, [key]: value } }))
	const updateCustom = (index: number, patch: { key?: string; value?: string }) =>
		setState((current) => {
			const next = current.customSocials.slice()
			next[index] = { ...next[index], ...patch }
			return { ...current, customSocials: next }
		})
	const addCustom = () =>
		setState((current) => ({
			...current,
			customSocials: [...current.customSocials, { id: crypto.randomUUID(), key: '', value: '' }]
		}))
	const removeCustom = (index: number) =>
		setState((current) => ({ ...current, customSocials: current.customSocials.filter((_, i) => i !== index) }))

	const handleReset = () => {
		setState(initial)
		setSubmitted(false)
		setShowCustom(initial.customSocials.length > 0)
	}

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (displayNameError || slugError) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		const payload = buildPayload(state, initial)
		if (Object.keys(payload).length === 0) return
		// A logical test cannot be lowered inside a try, and this one needs the saved slug to compare.
		const isRenamed = (savedSlug: string) => Boolean(payload.slug) && savedSlug !== payload.slug
		try {
			const updated = await updateProfileMutation.mutateAsync(payload)
			const next = profileToForm(updated)
			setProfile(updated)
			setInitial(next)
			// The fields stay editable while the save runs. Edits made since submitting stay on screen, unsaved
			// against the new copy; otherwise the form shows what the server kept.
			setState((current) => (current === state ? next : current))
			if (isRenamed(next.slug)) {
				toast.success(`Saved as @${next.slug}`)
			} else {
				toast.success('Saved')
			}
		} catch (error) {
			toast.error(httpErrorMessage(error, "Couldn't save."))
		}
	}

	return (
		<form noValidate onSubmit={handleSubmit} className="mx-auto grid w-full max-w-4xl gap-0 px-1 pb-28">
			<header className="flex flex-wrap items-end justify-between gap-3 pt-2 pb-6">
				<div>
					<Link
						href="/research/mine"
						className="inline-flex items-center gap-1 body-sm text-tertiary transition-colors hover:text-primary"
					>
						<span aria-hidden>←</span> My articles
					</Link>
					<h1 className="mt-2 heading-lg tracking-tight text-primary">Profile</h1>
					<p className="mt-1 body-md text-secondary">How readers see you on research and author pages.</p>
				</div>
				<ExternalLinkButton href={`/research/authors/${profile.slug}`}>View public page</ExternalLinkButton>
			</header>

			<LivePreview state={state} createdAt={profile.createdAt} />

			<Section
				title="Identity"
				description="Photo and display name. Square avatars look best — anything else gets center-cropped."
			>
				<div className="flex flex-wrap items-start gap-5">
					<ImageUploadButton
						scope="avatar"
						currentUrl={state.avatarUrl || null}
						onUploaded={(result) => update({ avatarUrl: result.url })}
						onCleared={() => update({ avatarUrl: '' })}
						label="avatar"
						previewShape="square"
						helperText="PNG, JPEG, WebP, or GIF · up to 8 MB"
					/>
				</div>
				<Field
					label="Display name"
					action={<CharCount value={state.displayName} max={DISPLAY_NAME_MAX} />}
					error={submitted ? displayNameError : null}
				>
					{(control) => (
						<Input
							{...control}
							type="text"
							required
							maxLength={DISPLAY_NAME_MAX}
							value={state.displayName}
							onChange={(e) => update({ displayName: e.target.value })}
							className="w-full"
						/>
					)}
				</Field>
			</Section>

			<Section
				title="Handle"
				description={
					<>
						Your public URL on DefiLlama. Lowercase letters, numbers, and dashes.{' '}
						<span className="text-tertiary">Don't change it casually — old links break.</span>
					</>
				}
			>
				<Field
					label="Public URL"
					hint={
						slugChanged && !shownSlugError ? (
							<span className="inline-flex items-center gap-1.5 text-warning">
								<StatusDot status="caution" />
								Old links to <span className="mono-sm">/research/authors/{initial.slug}</span> will 404.
							</span>
						) : null
					}
					error={shownSlugError}
					live
				>
					{(control) => (
						<Input
							{...control}
							prefix="/research/authors/"
							type="text"
							required
							maxLength={SLUG_MAX}
							value={state.slug}
							onChange={(e) => update({ slug: e.target.value })}
							spellCheck={false}
							autoCapitalize="none"
							autoCorrect="off"
						/>
					)}
				</Field>
			</Section>

			<Section
				title="Bio"
				description="One or two sentences. Shown at the top of your author page and in research bylines."
			>
				<Field label="About you" action={<CharCount value={state.bio} max={BIO_MAX} />}>
					{(control) => (
						<Textarea
							{...control}
							rows={5}
							maxLength={BIO_MAX}
							value={state.bio}
							onChange={(e) => update({ bio: e.target.value })}
							placeholder="Researcher covering DeFi liquidity, MEV, and stablecoins."
							className="w-full resize-y"
						/>
					)}
				</Field>
			</Section>

			<Section title="Links" description="Shown as chips on your author page. Empty fields are dropped on save.">
				<div className="grid gap-3 sm:grid-cols-2">
					{PRESET_SOCIALS.map((kind) => (
						<Field key={kind.id} label={kind.label}>
							{(control) => (
								<Input
									{...control}
									type="text"
									maxLength={SOCIAL_VALUE_MAX}
									value={state.socials[kind.id] || ''}
									onChange={(e) => updateSocial(kind.id, e.target.value)}
									placeholder={kind.placeholder}
									className="w-full"
								/>
							)}
						</Field>
					))}
				</div>

				{showCustom ? (
					<div className="grid gap-3 border-t border-medium pt-4">
						<div className="flex items-center justify-between gap-2 label-sm">
							<h3 className="label-md text-primary">Custom links</h3>
							<Button variant="link" onClick={addCustom}>
								+ add another
							</Button>
						</div>
						{state.customSocials.length === 0 ? (
							<Button
								variant="secondary"
								size="md"
								onClick={(event) => {
									const list = event.currentTarget.parentElement!
									keepFocus(addCustom, () => newCustomKeyInput(list))
								}}
							>
								Add a custom link
							</Button>
						) : (
							state.customSocials.map((entry, index) => (
								<div key={entry.id} className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-start gap-2">
									<Input
										type="text"
										value={entry.key}
										onChange={(e) => updateCustom(index, { key: e.target.value })}
										placeholder="kind"
										maxLength={40}
										className="w-full"
									/>
									<Input
										type="text"
										value={entry.value}
										onChange={(e) => updateCustom(index, { value: e.target.value })}
										placeholder="https://…"
										maxLength={SOCIAL_VALUE_MAX}
										className="w-full"
									/>
									<Tooltip
										content="Remove link"
										render={
											<Button
												variant="ghost"
												size="md"
												square
												aria-label={`Remove custom link ${entry.key || index + 1}`}
												onClick={(event) => {
													// The row leaves with its button: the next row's takes focus, else Add a custom link.
													const row = event.currentTarget.parentElement!
													const list = row.parentElement!
													const next = neighbourRowControl(row, event.currentTarget)
													keepFocus(
														() => removeCustom(index),
														() => next ?? (list.lastElementChild as HTMLElement)
													)
												}}
											/>
										}
									>
										<Icon name="x" className="size-4" />
									</Tooltip>
								</div>
							))
						)}
					</div>
				) : (
					<div className="label-sm">
						<Button
							variant="link"
							onClick={(event) => {
								// The section, not this row: the row leaves once the custom links show.
								const section = event.currentTarget.parentElement!.parentElement!
								keepFocus(
									() => {
										setShowCustom(true)
										addCustom()
									},
									() => newCustomKeyInput(section)
								)
							}}
						>
							+ add custom link
						</Button>
					</div>
				)}
			</Section>

			<div className="sticky bottom-0 -mx-1 mt-2 border-t border-medium bg-page-glass px-2 py-3 backdrop-blur">
				<div className="flex items-center justify-between gap-3">
					<span className="inline-flex items-center gap-2 body-sm text-tertiary">
						<StatusDot status={dirty ? 'caution' : 'good'} />
						{dirty ? 'Unsaved changes' : 'All changes saved'}
					</span>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="md"
							onClick={handleReset}
							disabled={!dirty || updateProfileMutation.isPending}
							accessibleWhenDisabled
						>
							Discard
						</Button>
						{/* Disabled only with nothing to save, which the status beside it says. Focusable while disabled: a save
						    leaves nothing dirty, which disables the button that was pressed. */}
						<Button
							variant="primary"
							size="md"
							pendingLabel="Saving…"
							pending={updateProfileMutation.isPending}
							type="submit"
							disabled={!dirty}
							accessibleWhenDisabled
						>
							Save changes
						</Button>
					</div>
				</div>
			</div>
		</form>
	)
}
