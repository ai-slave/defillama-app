import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import Layout from '~/layout'
import { PanelLoadingStatus } from '~/ui/Status'

// The editor's own loading frame and label, so nothing moves when the chunk and the article land.
const editorLoading = (
	<div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
		<PanelLoadingStatus label="Loading editor" />
	</div>
)

const ArticleEditorClient = dynamic(
	() => import('~/containers/Articles/editor/ArticleEditorClient').then((mod) => mod.ArticleEditorClient),
	{
		ssr: false,
		loading: () => editorLoading
	}
)

export default function EditArticlePage() {
	const router = useRouter()
	const id = typeof router.query.id === 'string' ? router.query.id : undefined

	return (
		<Layout
			title="Edit research - DefiLlama"
			description="Edit a DefiLlama research draft."
			canonicalUrl={id ? `/research/edit/${id}` : '/research/edit'}
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<AppMetadataProvider>
					<ArticlesAccessGate loadingFallback={editorLoading}>
						{id ? <ArticleEditorClient articleId={id} /> : editorLoading}
					</ArticlesAccessGate>
				</AppMetadataProvider>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
