import Link from 'next/link'
import { TrustedLogoForm } from '~/containers/Articles/admin/TrustedLogoForm'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import Layout from '~/layout'

export default function NewTrustedLogoPage() {
	return (
		<Layout
			title="New logo - Research Admin - DefiLlama"
			description="Add a sponsor logo."
			canonicalUrl="/research/admin/trusted-by/logos/new"
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
							<h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">New logo</h1>
						</header>
					</div>
					<TrustedLogoForm />
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
