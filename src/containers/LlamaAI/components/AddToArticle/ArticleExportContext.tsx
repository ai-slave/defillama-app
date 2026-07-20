import * as Ariakit from '@ariakit/react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useHasArticlesAccess } from '~/containers/Articles/ArticlesAccessGate'
import type { ArticleExportRequest } from '~/containers/LlamaAI/utils/articleExport'
import { AddToArticleModal } from './AddToArticleModal'
import { ArticleExportContext, type OpenArticleExport } from './useArticleExport'

export function ArticleExportProvider({ children, sessionTitle }: { children: ReactNode; sessionTitle?: string }) {
	const { hasAccess } = useHasArticlesAccess()
	const dialogStore = Ariakit.useDialogStore()
	const [request, setRequest] = useState<ArticleExportRequest | null>(null)

	const openArticleExport = useCallback<OpenArticleExport>(
		(next) => {
			setRequest(next)
			dialogStore.show()
		},
		[dialogStore]
	)

	const value = useMemo(
		() => ({ openArticleExport: hasAccess ? openArticleExport : null }),
		[hasAccess, openArticleExport]
	)

	return (
		<ArticleExportContext.Provider value={value}>
			{children}
			{hasAccess ? <AddToArticleModal dialogStore={dialogStore} request={request} sessionTitle={sessionTitle} /> : null}
		</ArticleExportContext.Provider>
	)
}
