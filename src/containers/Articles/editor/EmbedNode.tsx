import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { Button } from '~/ui/Button'
import { getEmbedProviderLabel } from '../embedProviders'
import type { ArticleEmbedConfig } from '../types'
import { useArticleEditable } from './useArticleEditable'

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		articleEmbed: {
			insertArticleEmbed: (config: ArticleEmbedConfig) => ReturnType
		}
	}
}

function EmbedNodeView({ node, selected, deleteNode, getPos, editor }: NodeViewProps) {
	const isEditable = useArticleEditable(editor)
	const config = node.attrs.config as ArticleEmbedConfig
	const providerLabel = getEmbedProviderLabel(config.provider)
	const handleEdit = () => {
		const pos = typeof getPos === 'function' ? getPos() : null
		if (typeof pos !== 'number') return
		document.dispatchEvent(new CustomEvent('article:edit-embed', { detail: { config, pos } }))
	}
	return (
		<NodeViewWrapper
			data-article-embed
			className={`my-4 overflow-hidden rounded-md border bg-surface ${selected ? 'border-brand' : 'border-medium'}`}
		>
			<div className="flex items-start justify-between gap-3 px-4 py-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2 body-sm text-tertiary">
						<span className="shrink-0 rounded-sm border border-medium bg-page px-1.5 py-0.5 label-xs tracking-wider text-secondary uppercase">
							{providerLabel}
						</span>
						<span className="truncate">{config.sourceUrl}</span>
					</div>
					{config.title ? <div className="mt-1 truncate label-md text-primary">{config.title}</div> : null}
					{config.caption ? <p className="mt-2 body-md text-secondary">{config.caption}</p> : null}
				</div>
				{isEditable ? (
					// oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- selects the node inside a contenteditable; TipTap owns keyboard navigation there.
					<div
						contentEditable={false}
						className="flex shrink-0 items-center gap-1"
						onMouseDown={(e) => e.stopPropagation()}
					>
						<Button
							variant="secondary"
							size="sm"
							onMouseDown={(e) => {
								e.preventDefault()
								e.stopPropagation()
							}}
							onClick={(e) => {
								e.stopPropagation()
								handleEdit()
							}}
						>
							Edit
						</Button>
						<Button
							variant="secondary"
							size="sm"
							onMouseDown={(e) => {
								e.preventDefault()
								e.stopPropagation()
							}}
							onClick={(e) => {
								e.stopPropagation()
								deleteNode()
								editor.commands.focus()
							}}
						>
							Remove
						</Button>
					</div>
				) : null}
			</div>
		</NodeViewWrapper>
	)
}

export const ArticleEmbed = Node.create({
	name: 'articleEmbed',
	group: 'block',
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			config: { default: null }
		}
	},

	parseHTML() {
		return [{ tag: 'div[data-article-embed]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-article-embed': 'true',
				'data-config': JSON.stringify(HTMLAttributes.config ?? null)
			})
		]
	},

	addNodeView() {
		return ReactNodeViewRenderer(EmbedNodeView)
	},

	addCommands() {
		return {
			insertArticleEmbed:
				(config) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs: { config } })
		}
	}
})
