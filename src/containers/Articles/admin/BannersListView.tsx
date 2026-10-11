import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import { deleteBanner, listBanners, updateBanner } from '~/containers/Articles/api'
import { bannerAudienceLabel } from '~/containers/Articles/bannerCountryGroups'
import type { Banner } from '~/containers/Articles/types'
import { ARTICLE_SECTION_LABELS, BANNER_KIND_LABELS, BANNER_SCOPE_LABELS } from '~/containers/Articles/types'
import { Button, StableLabel } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { neighborRowControl } from '~/ui/focus'
import { EmptyState, InlineStatus, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { StatusBadge } from '~/ui/StatusBadge'
import { Tag } from '~/ui/Tag'
import { httpErrorMessage } from '~/utils/async'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'

export function BannersListView() {
	// The neighbor row's Delete is read when the confirm opens: once the delete succeeds, the refetched list has dropped the row.
	const [deleteTarget, setDeleteTarget] = useState<{
		banner: Banner
		neighbor: HTMLElement | null | undefined
	} | null>(null)
	const returnFocusRef = useRef<HTMLElement | null>(null)
	const newBannerRef = useRef<HTMLAnchorElement>(null)
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const revalidateLanding = useResearchLandingRevalidation()

	const bannersQuery = useQuery<Array<Banner>>({
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
			toast.error(httpErrorMessage(err, "Couldn't update."))
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

	if (queryReadFailed(bannersQuery)) {
		const { error } = bannersQuery
		return (
			<PanelStatus variant="error" retry={bannersQuery} className="mx-auto w-full max-w-5xl">
				{httpErrorMessage(error, "Couldn't load banners.")}
			</PanelStatus>
		)
	}

	if (bannersQuery.isLoading) {
		return <PanelLoadingStatus label="Loading banners" className="mx-auto w-full max-w-5xl" />
	}

	const items = bannersQuery.data ?? []

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
					errorMessage="Couldn't delete the banner."
					finalFocus={returnFocusRef}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => {
						returnFocusRef.current = deleteTarget.neighbor ?? newBannerRef.current
					}}
				/>
			) : null}
			{queryRefreshFailed(bannersQuery) ? (
				<InlineStatus variant="error" retry={bannersQuery}>
					Couldn&apos;t refresh banners. It may not show your latest change.
				</InlineStatus>
			) : null}
			{items.length === 0 ? (
				<EmptyState
					size="md"
					title="No banners yet"
					actions={
						<Button as={BasicLink} variant="primary" size="sm" href="/research/admin/banners/new">
							Create your first banner
						</Button>
					}
					framed
				/>
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
									<Tag>{BANNER_KIND_LABELS[banner.type]}</Tag>
									<Tag>{bannerAudienceLabel(banner.targetCountries)}</Tag>
									<StatusBadge status={banner.enabled ? 'good' : 'neutral'}>
										{banner.enabled ? 'Live' : 'Disabled'}
									</StatusBadge>
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
											neighbor: neighborRowControl(event.currentTarget.closest('li')!, event.currentTarget)
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
