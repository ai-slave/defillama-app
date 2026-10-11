import Link from 'next/link'
import { articleHref, formatDate, readingMinutes } from '~/containers/Articles/landing/utils'
import type { ArticleDocument } from '~/containers/Articles/types'
import { Card } from '~/ui/Card'
import { MetaLine } from '~/ui/MetaLine'

export function GenericCard({ article }: { article: ArticleDocument }) {
	const cover = article.coverImage?.url || null
	const primaryTag = article.tags?.[0]
	return (
		<Card as={Link} padding="md" href={articleHref(article)} className="group hover-wash-card grid content-start gap-3">
			<div className="flex items-center justify-between gap-3 label-xs tracking-[0.18em] text-tertiary uppercase">
				<span>{primaryTag?.replace(/-/g, ' ') || 'Story'}</span>
				<span className="tabular-nums">{readingMinutes(article)} min</span>
			</div>
			{cover ? (
				<div className="aspect-[16/9] w-full overflow-hidden">
					<img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
				</div>
			) : null}
			<h3 className="title-lg tracking-tight text-primary group-hover:text-link">{article.title}</h3>
			{article.excerpt || article.subtitle ? (
				<p className="line-clamp-3 body-md text-secondary">{article.excerpt || article.subtitle}</p>
			) : null}
			<MetaLine>
				{article.brandByline ? (
					<span className="font-medium text-secondary">DefiLlama Research</span>
				) : article.authorProfile?.displayName ? (
					<span className="font-medium text-secondary">{article.authorProfile.displayName}</span>
				) : null}
				{formatDate(article.displayDate ?? article.publishedAt)}
			</MetaLine>
		</Card>
	)
}
