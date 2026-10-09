import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { ArticleApiError, deleteBanner, listBanners, updateBanner } from '~/containers/Articles/api'
import { bannerAudienceLabel } from '~/containers/Articles/bannerCountryGroups'
import type { Banner } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS, BANNER_KIND_LABELS, BANNER_SCOPE_LABELS } from '~/containers/Articles/types'
import { Button, StableLabel } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { neighbourRowControl } from '~/ui/focus'

export function BannersListView() {
	// The neighbour row's Delete is read when the confirm opens: once the delete succeeds, the refetched list has dropped the row.
	const [deleteTarget, setDeleteTarget] = useState<{
		banner: Banner
		neighbour: HTMLElement | null | undefined
	} | null>(null)
	const returnFocusRef = useRef<HTMLElement | null>(null)
	const newBannerRef = useRef<HTMLAnchorElement>(null)
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const revalidateLanding = useResearchLandingRevalidation()

	const {
		data: banners,
		isLoading,
		error
	} = useQuery<Array<Banner>>({
		queryKey: ['research', 'admin', 'banners'],
		queryFn: () => listBanners(authorizedFetch),
		retry: false
	})

	const toggleMutation = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateBanner(id, { enabled }, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['research', 'admin', 'banners'] })
			queryClient.invalidateQueries({ queryKey: ['research', 'banner'] })
			revalidateLanding()
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to update')
		}
	})

	const deleteBannerMutation = useMutation({
		mutationFn: (id: string) => deleteBanner(id, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['research', 'banner'] })
			revalidateLanding()
			return queryClient.invalidateQueries({ queryKey: ['research', 'admin', 'banners'] })
		}
	})

	if (isLoading) {
		return <div className="mx-auto py-24 text-center body-md text-tertiary">Loading…</div>
	}

	if (error) {
		const message = error instanceof ArticleApiError ? error.message : 'Failed to load banners'
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-error-muted bg-error-faint p-6">
				<h1 className="heading-sm text-primary">Couldn't load banners</h1>
				<p className="body-md text-secondary">{message}</p>
			</div>
		)
	}

	const items = banners ?? []

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6 px-1 pb-16">
			<header className="flex flex-wrap items-end justify-between gap-3 pt-2 pb-2">
				<div>
					<Link
						href="/research/admin"
						className="inline-flex items-center gap-1 body-sm text-tertiary transition-colors hover:text-primary"
					>
						<span aria-hidden>←</span> Admin
					</Link>
					<h1 className="mt-2 heading-lg tracking-tight text-primary">Banners</h1>
					<p className="mt-1 body-md text-secondary">
						Configure the dismissible top strip, the desktop right-rail image, or the mobile inline image shown on
						/research, all articles, a section's articles, or a single article.
					</p>
				</div>
				<Button ref={newBannerRef} as={BasicLink} variant="primary" size="md" href="/research/admin/banners/new">
					New banner
				</Button>
			</header>

			{deleteTarget ? (
				<ConfirmActionDialog
					key={deleteTarget.banner.id}
					title={`Delete ${deleteTarget.banner.imageAlt || BANNER_KIND_LABELS[deleteTarget.banner.type]} banner?`}
					description="This removes the banner from research pages. This cannot be undone."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deleteBannerMutation}
					variables={deleteTarget.banner.id}
					finalFocus={returnFocusRef}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => {
						returnFocusRef.current = deleteTarget.neighbour ?? newBannerRef.current
					}}
				/>
			) : null}
			{items.length === 0 ? (
				<div className="rounded-md border border-dashed border-medium bg-surface p-10 text-center">
					<p className="body-md text-secondary">No banners yet.</p>
					<Button
						as={BasicLink}
						variant="primary"
						size="md"
						href="/research/admin/banners/new"
						className="mx-auto mt-3 w-fit"
					>
						Create your first banner
					</Button>
				</div>
			) : (
				<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
					{items.map((banner) => (
						<li key={banner.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
							<div className="grid min-w-0 gap-1">
								<div className="flex flex-wrap items-center gap-2">
									<span className="label-xs tracking-[0.18em] text-tertiary uppercase">
										{banner.type === 'promo' ? 'Landing + all articles' : BANNER_SCOPE_LABELS[banner.scope]}
										{banner.scope === 'section' && banner.section ? ` · ${ARTICLE_SECTION_LABELS[banner.section]}` : ''}
										{banner.scope === 'article' && banner.articleId ? ` · #${banner.articleId.slice(0, 8)}` : ''}
									</span>
									<span className="inline-flex items-center rounded-full bg-brand-muted px-2 py-0.5 label-xs tracking-[0.18em] text-link uppercase">
										{BANNER_KIND_LABELS[banner.type]}
									</span>
									<span className="inline-flex items-center rounded-full bg-surface-elevated-1 px-2 py-0.5 label-xs tracking-[0.12em] text-secondary uppercase">
										{bannerAudienceLabel(banner.targetCountries)}
									</span>
									<span
										className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 label-xs tracking-[0.18em] uppercase ${
											banner.enabled ? 'bg-success-tint text-success' : 'bg-surface-elevated-1 text-tertiary'
										}`}
									>
										<span aria-hidden className="size-1 rounded-full bg-current" />
										{banner.enabled ? 'Live' : 'Disabled'}
									</span>
								</div>
								{banner.type === 'text' ? (
									<>
										<p className="line-clamp-2 body-md text-primary">{banner.text}</p>
										{banner.linkUrl ? (
											<p className="truncate body-sm text-tertiary">
												→ {banner.linkLabel?.trim() || 'Read more'} · {banner.linkUrl}
											</p>
										) : null}
									</>
								) : (
									<div className="mt-1 flex items-center gap-3">
										{(banner.imageUrl ??
										banner.imageWideUrl ??
										banner.imageCardUrl ??
										banner.imageMobileUrl ??
										banner.imageLandingMobileUrl) ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={
													(banner.imageUrl ??
														banner.imageWideUrl ??
														banner.imageCardUrl ??
														banner.imageMobileUrl ??
														banner.imageLandingMobileUrl) as string
												}
												alt=""
												className={`shrink-0 rounded-sm border border-medium object-cover ${
													banner.type === 'image-horizontal' || banner.type === 'promo' ? 'h-8 w-20' : 'size-12'
												}`}
											/>
										) : null}
										<p className="line-clamp-2 body-md text-secondary">
											{banner.imageAlt?.trim() || <span className="text-tertiary italic">no alt text</span>}
										</p>
									</div>
								)}
							</div>
							<div className="flex flex-wrap items-center gap-2 justify-self-end">
								<Button
									variant="secondary"
									size="sm"
									onClick={() => toggleMutation.mutate({ id: banner.id, enabled: !banner.enabled })}
									pendingLabel="Updating…"
									pending={toggleMutation.isPending && toggleMutation.variables.id === banner.id}
									disabled={toggleMutation.isPending}
								>
									<StableLabel labels={['Enable', 'Disable']} current={banner.enabled ? 'Disable' : 'Enable'} />
								</Button>
								<Button as={BasicLink} variant="secondary" size="sm" href={`/research/admin/banners/${banner.id}`}>
									Edit
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={(event) => {
										returnFocusRef.current = null
										setDeleteTarget({
											banner,
											neighbour: neighbourRowControl(event.currentTarget.closest('li')!, event.currentTarget)
										})
									}}
									disabled={deleteBannerMutation.isPending}
								>
									Delete
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
