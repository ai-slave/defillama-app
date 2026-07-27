import Link from 'next/link'
import { SocialMentionForm } from '~/containers/Articles/admin/SocialMentionForm'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import Layout from '~/layout'

export default function NewSocialMentionPage() {
	return (
		<Layout
			title="New mention - Research Admin - DefiLlama"
			description="Add a social media mention."
			canonicalUrl="/research/admin/trusted-by/mentions/new"
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
							<h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">New mention</h1>
						</header>
					</div>
					<SocialMentionForm />
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
