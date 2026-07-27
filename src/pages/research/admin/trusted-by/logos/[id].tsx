import Link from 'next/link'
import { useRouter } from 'next/router'
import { TrustedLogoForm } from '~/containers/Articles/admin/TrustedLogoForm'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import Layout from '~/layout'

export default function EditTrustedLogoPage() {
	const router = useRouter()
	const id =
		typeof router.query.id === 'string' ? router.query.id : Array.isArray(router.query.id) ? router.query.id[0] : ''

	return (
		<Layout
			title="Edit logo - Research Admin - DefiLlama"
			description="Edit a sponsor logo."
			canonicalUrl={`/research/admin/trusted-by/logos/${id || ''}`}
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
							<h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Edit logo</h1>
						</header>
					</div>
					{id ? <TrustedLogoForm logoId={id} /> : null}
				</ArticlesAccessGate>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
