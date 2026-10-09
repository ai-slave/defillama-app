import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { ImageUploadButton } from '~/containers/Articles/upload/ImageUploadButton'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { formatNumber, formatPercent } from '~/utils/numberFormat'
import { getMyDashboardAuthorProfile, TOP_AUTHORS_QUERY_KEY, updateMyDashboardAuthorProfile } from './api'
import { avatarColorStyle } from './avatarColor'
import { DEFAULT_AUTHOR_NAME_RE, DEFAULT_AUTHOR_SLUG_RE } from './profileDefaults'
import type { AuthorProfileUpdate, PublicDashboardAuthor } from './types'

const DISPLAY_NAME_MAX = 120
const SLUG_MAX = 60
const BIO_MAX = 2000
const SOCIAL_VALUE_MAX = 300
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const SOCIALS = [
	{ id: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/yourhandle' },
	{ id: 'github', label: 'GitHub', placeholder: 'https://github.com/yourhandle' },
	{ id: 'farcaster', label: 'Farcaster', placeholder: 'https://warpcast.com/yourhandle' },
	{ id: 'bluesky', label: 'Bluesky', placeholder: 'https://bsky.app/profile/you.bsky.social' },
	{ id: 'mastodon', label: 'Mastodon', placeholder: 'https://mastodon.social/@you' },
	{ id: 'telegram', label: 'Telegram', placeholder: 'https://t.me/yourhandle' },
	{ id: 'discord', label: 'Discord', placeholder: 'https://discord.gg/yourinvite' },
	{ id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you' },
	{ id: 'website', label: 'Website', placeholder: 'https://yourdomain.com' }
] as const

type FormState = {
	displayName: string
	slug: string
	bio: string
	avatarUrl: string
	socials: Record<string, string>
}

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, SLUG_MAX)
}

// Typing a handle turns anything but letters and digits into one dash. A trailing dash stays while the reader types
// on; profileErrors refuses it on save.
function typedSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+/, '')
		.slice(0, SLUG_MAX)
}

function isHttpsUrl(value: string): boolean {
	if (!value.trim()) return true
	try {
		const url = new URL(value)
		return url.protocol === 'https:' && !url.username && !url.password
	} catch {
		return false
	}
}

function profileToForm(profile: PublicDashboardAuthor): FormState {
	const socials: Record<string, string> = {}
	for (const social of SOCIALS) {
		const value = profile.socials?.[social.id]
		if (value) socials[social.id] = value
	}
	return {
		displayName: profile.displayName || '',
		slug: profile.slug || '',
		bio: profile.bio || '',
		avatarUrl: profile.avatarUrl || '',
		socials
	}
}

function buildPayload(state: FormState, initial: FormState): AuthorProfileUpdate {
	const payload: AuthorProfileUpdate = {}
	if (state.displayName.trim() !== initial.displayName.trim()) payload.displayName = state.displayName.trim()
	if (state.slug.trim() !== initial.slug.trim()) payload.slug = state.slug.trim()
	if (state.bio.trim() !== initial.bio.trim()) payload.bio = state.bio.trim() || null
	if (state.avatarUrl.trim() !== initial.avatarUrl.trim()) payload.avatarUrl = state.avatarUrl.trim() || null

	const socials = Object.fromEntries(
		Object.entries(state.socials)
			.map(([key, value]) => [key, value.trim()])
			.filter(([, value]) => value)
	)
	const initialSocials = Object.fromEntries(
		Object.entries(initial.socials)
			.map(([key, value]) => [key, value.trim()])
			.filter(([, value]) => value)
	)
	const sameSocials =
		Object.keys(socials).length === Object.keys(initialSocials).length &&
		Object.entries(socials).every(([key, value]) => initialSocials[key] === value)
	if (!sameSocials) payload.socials = socials
	return payload
}

function formsEqual(a: FormState, b: FormState): boolean {
	return JSON.stringify(buildPayload(a, b)) === '{}'
}

type CompletenessCheck = { label: string; done: boolean }

function profileCompleteness(state: FormState): { percent: number; missing: Array<string> } {
	const checks: Array<CompletenessCheck> = [
		{
			label: 'Add your name',
			done: !!state.displayName.trim() && !DEFAULT_AUTHOR_NAME_RE.test(state.displayName.trim())
		},
		{ label: 'Pick a custom handle', done: !!state.slug.trim() && !DEFAULT_AUTHOR_SLUG_RE.test(state.slug.trim()) },
		{ label: 'Write a short bio', done: !!state.bio.trim() },
		{ label: 'Upload an avatar', done: !!state.avatarUrl.trim() },
		{ label: 'Link a social account', done: Object.values(state.socials).some((value) => value.trim()) }
	]
	const completed = checks.filter((check) => check.done).length
	return {
		percent: Math.round((completed / checks.length) * 100),
		missing: checks.filter((check) => !check.done).map((check) => check.label)
	}
}

function ProfileCompletenessMeter({ state }: { state: FormState }) {
	const { percent, missing } = profileCompleteness(state)
	return (
		<div className="mt-4 grid gap-2 border-t border-subtle pt-4">
			<div className="flex items-center justify-between gap-2">
				<span className="label-sm text-primary">Profile completeness</span>
				<span className="title-sm text-link tabular-nums">
					{formatPercent(percent, { input: 'percent', maximumFractionDigits: 0 })}
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated-2">
				<div
					className="h-full rounded-full bg-brand transition-[width] duration-300"
					style={{ width: `${percent}%` }}
				/>
			</div>
			{missing.length > 0 ? (
				<ul className="grid gap-1">
					{missing.map((label) => (
						<li key={label} className="flex items-start gap-1.5 body-sm text-secondary">
							<span className="flex h-lh shrink-0 items-center">
								<Icon name="plus" height={12} width={12} />
							</span>
							{label}
						</li>
					))}
				</ul>
			) : (
				<p className="body-sm text-secondary">Your profile is complete and ready to gain followers.</p>
			)}
		</div>
	)
}

function CharCount({ value, max }: { value: string; max: number }) {
	const near = value.length >= Math.floor(max * 0.9)
	return (
		<span className={`body-sm tabular-nums ${near ? 'text-warning' : 'text-tertiary'}`}>
			{formatNumber(value.length)}/{formatNumber(max)}
		</span>
	)
}

// Each invalid field's error, keyed by `displayName`, `slug` or a social's id. Every input's maxLength caps its length.
function profileErrors(state: FormState): Record<string, string> {
	const errors: Record<string, string> = {}
	if (!state.displayName.trim()) errors.displayName = 'Enter a display name.'
	if (!state.slug) errors.slug = 'Enter a handle.'
	else if (!SLUG_REGEX.test(state.slug)) errors.slug = 'Enter a handle that ends with a letter or number.'
	for (const social of SOCIALS) {
		if (!isHttpsUrl(state.socials[social.id] ?? '')) errors[social.id] = 'Enter a valid https:// link.'
	}
	return errors
}

export function DashboardAuthorProfileCard() {
	const { authorizedFetch, isAuthenticated, loaders } = useAuthContext()
	const { data: loadedProfile, error: profileError } = useQuery({
		queryKey: ['dashboard-author-profile'],
		queryFn: () => getMyDashboardAuthorProfile(authorizedFetch),
		enabled: isAuthenticated && !loaders.userLoading,
		retry: false,
		refetchOnWindowFocus: false
	})

	// Only a load that produced nothing gets the error card. A failed background refetch keeps the last
	// profile in the cache, and unmounting the editor over it would throw away an unsaved draft.
	if (!loadedProfile) {
		if (profileError) {
			return <PanelStatus variant="error">Profile could not be loaded.</PanelStatus>
		}
		return <PanelLoadingStatus label="Loading profile" />
	}

	// Keyed by the saved profile: a successful save writes the new one into the cache, which rebuilds the
	// form on the saved values rather than re-seeding the fields by hand.
	return (
		<DashboardAuthorProfileEditor key={`${loadedProfile.slug}:${loadedProfile.updatedAt}`} profile={loadedProfile} />
	)
}

function DashboardAuthorProfileEditor({ profile }: { profile: PublicDashboardAuthor }) {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const initial = useMemo(() => profileToForm(profile), [profile])
	const [state, setState] = useState<FormState>(initial)
	const updateMutation = useMutation({
		mutationFn: (payload: AuthorProfileUpdate) => updateMyDashboardAuthorProfile(payload, authorizedFetch),
		onSuccess: (nextProfile) => {
			queryClient.setQueryData(['dashboard-author-profile'], nextProfile)
			queryClient.invalidateQueries({ queryKey: TOP_AUTHORS_QUERY_KEY })
			queryClient.invalidateQueries({ queryKey: ['author-page', nextProfile.slug] })
		}
	})

	const [submitted, setSubmitted] = useState(false)
	const errors = profileErrors(state)
	const shownErrors: Record<string, string> = submitted ? errors : {}
	const isDirty = !formsEqual(state, initial)

	const save = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (Object.keys(errors).length > 0) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		const payload = buildPayload(state, initial)
		try {
			// The mutation writes the saved profile into the cache, which changes this editor's key and
			// rebuilds it on the saved values.
			await toast.promise(updateMutation.mutateAsync(payload), {
				loading: 'Saving profile…',
				success: 'Profile saved',
				error: (err) => (err instanceof Error ? err.message : 'Failed to save profile')
			})
		} catch {
			// toast.promise already showed the error; the form keeps the unsaved draft.
		}
	}

	const displayName = state.displayName.trim() || 'Your name'
	const publicHref = `/authors/${state.slug || profile.slug}`

	return (
		<Card as="form" noValidate onSubmit={save} padding="md" className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Icon name="users" height={24} width={24} className="text-primary" />
					<span className="label-lg text-primary">Public Profile</span>
				</div>
				{profile.slug ? (
					<BasicLink href={publicHref} className="label-md text-link hover:underline">
						View profile
					</BasicLink>
				) : null}
			</div>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
				<div className="grid gap-4">
					<ImageUploadButton
						scope="avatar"
						currentUrl={state.avatarUrl}
						label="Avatar"
						previewShape="square"
						helperText="Shown on your public dashboard profile and dashboard bylines."
						onUploaded={(result) => setState((prev) => ({ ...prev, avatarUrl: result.url }))}
						onCleared={() => setState((prev) => ({ ...prev, avatarUrl: '' }))}
					/>

					<Field label="Display name" error={shownErrors.displayName}>
						{(control) => (
							<Input
								{...control}
								required
								value={state.displayName}
								maxLength={DISPLAY_NAME_MAX}
								onChange={(e) => {
									const nextDisplayName = e.target.value
									setState((prev) => ({
										...prev,
										displayName: nextDisplayName,
										slug: prev.slug === slugify(prev.displayName) ? slugify(nextDisplayName) : prev.slug
									}))
								}}
							/>
						)}
					</Field>

					<Field label="Handle" action={<CharCount value={state.slug} max={SLUG_MAX} />} error={shownErrors.slug}>
						{(control) => (
							<Input
								{...control}
								required
								value={state.slug}
								maxLength={SLUG_MAX}
								onChange={(e) => setState((prev) => ({ ...prev, slug: typedSlug(e.target.value) }))}
							/>
						)}
					</Field>

					<Field label="Bio" action={<CharCount value={state.bio} max={BIO_MAX} />}>
						{(control) => (
							<Textarea
								{...control}
								value={state.bio}
								maxLength={BIO_MAX}
								rows={4}
								onChange={(e) => setState((prev) => ({ ...prev, bio: e.target.value }))}
								className="resize-y"
							/>
						)}
					</Field>

					<div className="grid gap-3">
						<span className="label-md text-primary">Links</span>
						<div className="grid gap-3 md:grid-cols-2">
							{SOCIALS.map((social) => (
								<Field key={social.id} label={social.label} error={shownErrors[social.id]}>
									{(control) => (
										<Input
											{...control}
											type="url"
											value={state.socials[social.id] || ''}
											maxLength={SOCIAL_VALUE_MAX}
											placeholder={social.placeholder}
											onChange={(e) =>
												setState((prev) => ({
													...prev,
													socials: { ...prev.socials, [social.id]: e.target.value }
												}))
											}
										/>
									)}
								</Field>
							))}
						</div>
					</div>
				</div>

				<aside className="h-fit rounded-lg border border-subtle bg-surface-elevated-1 p-4">
					<div className="flex items-start gap-3">
						{state.avatarUrl ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img src={state.avatarUrl} alt="" className="size-14 rounded-full object-cover" />
						) : (
							<div
								className="flex size-14 items-center justify-center rounded-full body-xl"
								style={avatarColorStyle(state.slug || displayName)}
							>
								🦙
							</div>
						)}
						<div className="min-w-0">
							<p className="truncate title-md text-primary">{displayName}</p>
							<p className="truncate body-sm text-secondary">@{state.slug || 'handle'}</p>
						</div>
					</div>
					{state.bio.trim() ? <p className="mt-3 line-clamp-4 body-md text-secondary">{state.bio.trim()}</p> : null}
					<ProfileCompletenessMeter state={state} />
				</aside>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-4">
				<p className="body-sm text-secondary">
					{isDirty
						? 'Profile changes appear on public dashboard pages after saving.'
						: 'Change a field to save your profile.'}
				</p>
				<Button
					type="submit"
					variant="primary"
					size="md"
					// Nothing to save until a field changes; the line beside it says so.
					disabled={!isDirty}
					accessibleWhenDisabled
					pendingLabel={updateMutation.isPending ? 'Saving…' : null}
				>
					Save profile
				</Button>
			</div>
		</Card>
	)
}
