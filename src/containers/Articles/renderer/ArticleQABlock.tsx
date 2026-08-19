import type { ReactNode } from 'react'

export function ArticleQABlock({
	id,
	questionNumber,
	children
}: {
	id?: string
	questionNumber?: string
	children: ReactNode
}) {
	return (
		<dl data-article-qa="true" data-qa-number={questionNumber} className="article-qa" id={id}>
			{children}
		</dl>
	)
}

export function ArticleQAQuestion({ id, children }: { id?: string; children: ReactNode }) {
	return (
		<dt data-article-qa-question="true" className="article-qa-question" id={id}>
			{children}
		</dt>
	)
}

export function ArticleQAAnswer({ children }: { children: ReactNode }) {
	return (
		<dd data-article-qa-answer="true" className="article-qa-answer">
			{children}
		</dd>
	)
}
