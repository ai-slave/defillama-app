import dynamic from 'next/dynamic'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { ArticlesAccessGate } from '~/containers/Articles/ArticlesAccessGate'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import Layout from '~/layout'
import { PanelLoadingStatus } from '~/ui/Status'

// The editor's own loading frame and label, so nothing moves when the chunk and the draft land.
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

export default function NewArticlePage() {
	return (
		<Layout
			title="Research editor - DefiLlama"
			description="Editor for DefiLlama research."
			canonicalUrl="/research/new"
			noIndex
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<AppMetadataProvider>
					<ArticlesAccessGate loadingFallback={editorLoading}>
						<ArticleEditorClient />
					</ArticlesAccessGate>
				</AppMetadataProvider>
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
