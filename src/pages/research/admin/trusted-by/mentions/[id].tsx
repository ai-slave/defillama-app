import Link from 'next/link'
import { useRouter } from 'next/router'
import { SocialMentionForm } from '~/containers/Articles/admin/SocialMentionForm'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import Layout from '~/layout'

export default function EditSocialMentionPage() {
	const router = useRouter()
	const id =
		typeof router.query.id === 'string' ? router.query.id : Array.isArray(router.query.id) ? router.query.id[0] : ''

	return (
		<Layout
			title="Edit mention - Research Admin - DefiLlama"
			description="Edit a social media mention."
			canonicalUrl={`/research/admin/trusted-by/mentions/${id || ''}`}
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<ArticlesAccessGate>
					<div className="mx-auto grid w-full max-w-2xl gap-0 px-1">
						<header className="pt-2 pb-2">
							<Link
								href="/research/admin/trusted-by"
								className="inline-flex items-center gap-1 text-xs text-tertiary transition-colors hover:text-primary"
							>
								<span aria-hidden>←</span> Trusted By
							</Link>
							<h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Edit mention</h1>
						</header>
					</div>
					{id ? <SocialMentionForm mentionId={id} /> : null}
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
