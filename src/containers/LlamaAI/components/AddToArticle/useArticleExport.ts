import { createContext, useContext } from 'react'
import type { ArticleExportRequest } from '~/containers/LlamaAI/utils/articleExport'

export type OpenArticleExport = (request: ArticleExportRequest) => void

export const ArticleExportContext = createContext<{ openArticleExport: OpenArticleExport | null }>({
	openArticleExport: null
})

export function useArticleExport(): OpenArticleExport | null {
	return useContext(ArticleExportContext).openArticleExport
}
