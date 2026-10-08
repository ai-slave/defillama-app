import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SANITIZE_REHYPE_PLUGINS } from '~/containers/LlamaAI/components/markdown/sanitizeConfig'
import type { TextConfig } from '../types'
import { isExternalLink } from './externalLink'
import { ExternalLinkInterstitial } from './ExternalLinkInterstitial'
import { ProCardHeader } from './ProCardHeader'

interface TextCardProps {
	text: TextConfig
}

const REMARK_PLUGINS = [[remarkGfm, { singleTilde: false }]] as any

export function TextCard({ text }: TextCardProps) {
	const [pendingHref, setPendingHref] = useState<string | null>(null)

	return (
		<div className="flex max-w-none flex-col overflow-y-auto p-0">
			<ProCardHeader {...(text.title ? { title: text.title } : {})} />
			<div className="prose prose-sm flex flex-col gap-2 px-3 pb-3 prose-invert">
				<ReactMarkdown
					remarkPlugins={REMARK_PLUGINS}
					rehypePlugins={SANITIZE_REHYPE_PLUGINS}
					components={{
						h1: ({ children }) => <h3 className="m-0! heading-sm text-primary">{children}</h3>,
						h2: ({ children }) => <h4 className="m-0! heading-xs text-primary">{children}</h4>,
						h3: ({ children }) => <h5 className="m-0! label-lg text-primary">{children}</h5>,
						p: ({ children }) => <p className="m-0! leading-relaxed text-secondary">{children}</p>,
						ul: ({ children }) => <ul className="m-0! flex list-disc flex-col gap-1 pl-4">{children}</ul>,
						ol: ({ children }) => <ol className="m-0! flex list-decimal flex-col gap-1 pl-4">{children}</ol>,
						li: ({ children }) => <li className="m-0! text-secondary">{children}</li>,
						code: ({ children }) => (
							<code className="m-0! overflow-x-auto rounded-sm bg-surface-elevated-2 px-1 py-0.5 body-sm">
								{children}
							</code>
						),
						pre: ({ children }) => (
							<pre className="m-0! overflow-x-auto rounded-sm bg-surface-elevated-2 p-2">{children}</pre>
						),
						blockquote: ({ children }) => (
							<blockquote className="m-0! overflow-x-auto border-l-3 border-brand pl-2 text-secondary italic">
								{children}
							</blockquote>
						),
						a: ({ children, href }) => {
							const external = isExternalLink(href)
							return (
								<a
									href={href}
									className="m-0! text-link hover:underline"
									target="_blank"
									rel={external ? 'noopener noreferrer nofollow ugc' : 'noopener noreferrer'}
									onClick={
										external
											? (event) => {
													event.preventDefault()
													setPendingHref(href ?? null)
												}
											: undefined
									}
								>
									{children}
								</a>
							)
						},
						img: () => null,
						strong: ({ children }) => <strong className="m-0! font-semibold text-primary">{children}</strong>,
						em: ({ children }) => <em className="m-0! text-secondary italic">{children}</em>,
						table: ({ children }) => (
							<div className="overflow-x-auto">
								<table className="m-0! w-full border-collapse body-md">{children}</table>
							</div>
						),
						thead: ({ children }) => <thead>{children}</thead>,
						tbody: ({ children }) => <tbody>{children}</tbody>,
						tr: ({ children }) => <tr>{children}</tr>,
						th: ({ children }) => (
							<th className="m-0! border-b border-subtle px-3 py-2 text-left font-semibold whitespace-nowrap text-primary">
								{children}
							</th>
						),
						td: ({ children }) => <td className="m-0! border-b border-subtle px-3 py-1.5 text-secondary">{children}</td>
					}}
				>
					{text.content}
				</ReactMarkdown>
				<ExternalLinkInterstitial href={pendingHref} onClose={() => setPendingHref(null)} />
			</div>
		</div>
	)
}
