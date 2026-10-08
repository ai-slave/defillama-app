import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Button } from '~/ui/Button'
import { formatNumber } from '~/utils/numberFormat'
import { ArticleRenderer } from '../renderer/ArticleRenderer'
import type { LocalArticleDocument } from '../types'
import { ARTICLE_SECTION_SLUGS } from '../types'
import { Icon } from './ArticleEditorIcon'

type ArticleEditorPreviewProps = {
	article: LocalArticleDocument
	articleViewHref: string
	isDirty: boolean
	onEdit: () => void
	readMins: number
	wordCount: number
}

function articlePreviewShareUrl(article: LocalArticleDocument) {
	const path = article.section
		? `/research/${ARTICLE_SECTION_SLUGS[article.section]}/${article.slug}`
		: `/research/${article.slug}`

	if (typeof window === 'undefined') return path
	return `${window.location.origin}${path}`
}

export function ArticleEditorPreview({
	article,
	articleViewHref,
	isDirty,
	onEdit,
	readMins,
	wordCount
}: ArticleEditorPreviewProps) {
	const shareUrl = articlePreviewShareUrl(article)
	const canOpenLive = article.status === 'published' && article.section && article.slug

	return (
		<section className="article-editor-preview relative left-1/2 mt-5 -translate-x-1/2 border-t border-medium">
			<div className="sticky top-0 z-30 border-b border-medium bg-page/95 backdrop-blur supports-[backdrop-filter]:bg-page/82">
				<div className="mx-auto flex w-full max-w-[1300px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
					<div className="flex min-w-[min(100%,18rem)] flex-1 items-start gap-3">
						<div className="grid size-9 shrink-0 place-items-center rounded-md border border-medium bg-surface">
							<Icon name="eye" className="size-4 text-link" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="label-xs tracking-[0.24em] text-tertiary uppercase">Rendered proof</div>
							<div className="label-md break-words text-primary">{article.title || 'Untitled research'}</div>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="hidden items-center gap-2 rounded-md border border-medium bg-surface px-2.5 py-1.5 label-xs tracking-wider whitespace-nowrap text-tertiary uppercase sm:flex">
							<span>{formatNumber(wordCount)} words</span>
							<span aria-hidden className="h-3 w-px bg-border-medium" />
							<span>{readMins} min</span>
							{isDirty ? (
								<>
									<span aria-hidden className="h-3 w-px bg-border-medium" />
									<span className="text-warning dark:text-warning">Unsaved</span>
								</>
							) : null}
						</div>

						{canOpenLive ? (
							<ExternalLinkButton href={articleViewHref} className="max-sm:hidden">
								Live
							</ExternalLinkButton>
						) : null}

						<Button variant="primary" size="md" onClick={onEdit}>
							<Icon name="pencil" className="size-3.5" />
							<span>Edit</span>
						</Button>
					</div>
				</div>
			</div>

			<div className="article-editor-preview-stage">
				<div className="article-editor-preview-proof mx-auto w-full">
					<ArticleRenderer article={article} hideSidePanel shareUrlOverride={shareUrl} />
				</div>
			</div>
		</section>
	)
}
