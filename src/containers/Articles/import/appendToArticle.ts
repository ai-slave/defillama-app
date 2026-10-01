import { createArticle, getOwnedArticle, updateArticle } from '../api'
import { createEmptyLocalArticle } from '../document'
import type { ArticleDocument, TiptapJson } from '../types'

type AuthorizedFetch = (url: string, options?: RequestInit) => Promise<Response | null>

// Read-modify-write via the editor's own mappers: the fetched ArticleDocument is
// passed back through buildSavePayload untouched except for the appended content,
// so a concurrent editor save can only lose the append, never corrupt the doc.
export async function appendBlocksToArticle(
	articleId: string,
	blocks: Array<TiptapJson>,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const article = await getOwnedArticle(articleId, authorizedFetch)
	const contentJson = {
		...(article.contentJson ?? { type: 'doc' }),
		content: [...((article.contentJson?.content as Array<TiptapJson>) ?? []), ...blocks]
	}
	return updateArticle(articleId, { ...article, contentJson }, authorizedFetch)
}

export async function createArticleWithBlocks(
	title: string,
	blocks: Array<TiptapJson>,
	authorizedFetch: AuthorizedFetch
): Promise<ArticleDocument> {
	const draft = createEmptyLocalArticle(new Date().toISOString())
	const trimmed = title.trim()
	return createArticle(
		{
			...draft,
			...(trimmed ? { title: trimmed } : {}),
			contentJson: { type: 'doc', content: blocks }
		},
		authorizedFetch
	)
}
