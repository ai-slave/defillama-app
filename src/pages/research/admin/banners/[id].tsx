import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { BannerForm } from '~/containers/Articles/admin/BannerForm'
import { ArticleApiError, getBanner } from '~/containers/Articles/api'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import type { Banner } from '~/containers/Articles/types'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { EmptyState, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { httpErrorMessage } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'

function EditBannerInner({ id }: { id: string }) {
	const { authorizedFetch, isAuthenticated, loaders } = useAuthContext()
	const bannerQuery = useQuery<Banner>({
		queryKey: ['research', 'admin', 'banner', id],
		queryFn: () => getBanner(id, authorizedFetch),
		enabled: !!id && isAuthenticated && !loaders.userLoading,
		retry: false
	})
	const { data: banner, error } = bannerQuery
	const notFound = error instanceof ArticleApiError && error.status === 404

	// A failed refetch keeps the form, and its unsaved edits, on screen; a 404 is a missing banner, not a failed read.
	if (queryReadFailed(bannerQuery) && !notFound) {
		return (
			<PanelStatus variant="error" retry={bannerQuery} className="mx-auto w-full max-w-4xl">
				{httpErrorMessage(error, "Couldn't load this banner.")}
			</PanelStatus>
		)
	}

	if (bannerQuery.isLoading) {
		return <PanelLoadingStatus label="Loading banner" className="mx-auto w-full max-w-4xl" />
	}

	if (!banner) {
		return (
			<EmptyState
				size="lg"
				headingAs="h1"
				title="Banner not found"
				actions={
					<Button as={BasicLink} href="/research/admin/banners" size="md">
						Back to banners
					</Button>
				}
			/>
		)
	}

	return (
		<>
			<div className="mx-auto grid w-full max-w-4xl gap-0 px-1">
				<header className="pt-2 pb-2">
					<Link
						href="/research/admin/banners"
						className="inline-flex items-center gap-1 body-sm text-tertiary transition-colors hover:text-primary"
					>
						<span aria-hidden>←</span> Banners
					</Link>
					<h1 className="mt-2 heading-lg tracking-tight text-primary">Edit banner</h1>
				</header>
			</div>
			<BannerForm key={banner.id} banner={banner} />
		</>
	)
}

export default function EditBannerPage() {
	const router = useRouter()
	const id =
		typeof router.query.id === 'string' ? router.query.id : Array.isArray(router.query.id) ? router.query.id[0] : ''
	return (
		<Layout
			title="Edit banner - Research Admin - DefiLlama"
			description="Edit a research banner."
			canonicalUrl={`/research/admin/banners/${id || ''}`}
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<ArticlesAccessGate>{id ? <EditBannerInner id={id} /> : null}</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
