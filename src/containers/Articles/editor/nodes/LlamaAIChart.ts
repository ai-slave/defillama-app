import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import type { LlamaAIChartAttrs } from '../../llamaaiChart'
import { LlamaAIChartNodeView } from './LlamaAIChartNodeView'

const toCamel = (kebab: string) => kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		llamaaiChart: {
			insertLlamaAIChart: (attrs: LlamaAIChartAttrs) => ReturnType
		}
	}
}

const stringAttr = (attr: string, dataAttr: string) => ({
	default: '',
	parseHTML: (el: HTMLElement) => el.getAttribute(dataAttr) ?? '',
	renderHTML: (attrs: Record<string, unknown>) => (attrs[attr] ? { [dataAttr]: String(attrs[attr]) } : {})
})

export const LlamaAIChart = Node.create({
	name: 'llamaaiChart',
	group: 'block',
	atom: true,

	addAttributes() {
		// The node is persisted as ProseMirror JSON, but clipboard copy-paste inside
		// the editor roundtrips through renderHTML -> parseHTML. Object attrs are
		// serialized as JSON data-attributes so a pasted chart keeps its config/data
		// instead of degrading to "[object Object]".
		const jsonAttr = (attr: string) => ({
			default: null,
			parseHTML: (el: HTMLElement) => {
				const raw = el.getAttribute(`data-${attr}`)
				if (!raw) return null
				try {
					return JSON.parse(raw)
				} catch {
					return null
				}
			},
			renderHTML: (attrs: Record<string, unknown>) =>
				attrs[toCamel(attr)] == null ? {} : { [`data-${attr}`]: JSON.stringify(attrs[toCamel(attr)]) }
		})
		return {
			chartConfig: jsonAttr('chart-config'),
			chartData: jsonAttr('chart-data'),
			caption: stringAttr('caption', 'data-caption'),
			savedChartId: {
				default: null,
				parseHTML: (el: HTMLElement) => el.getAttribute('data-saved-chart-id') || null,
				renderHTML: (attrs: Record<string, unknown>) =>
					attrs.savedChartId ? { 'data-saved-chart-id': String(attrs.savedChartId) } : {}
			},
			// Transient ref carried through parseHTML by the selection-import pipeline;
			// hydrated into chartConfig/chartData and never persisted.
			chartRef: {
				default: null,
				rendered: false,
				parseHTML: (el: HTMLElement) => {
					const value = el.getAttribute('data-llamaai-chart')
					return value && value !== 'true' ? value : null
				}
			}
		}
	},

	parseHTML() {
		return [{ tag: 'div[data-llamaai-chart]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes, { 'data-llamaai-chart': 'true' })]
	},

	addCommands() {
		return {
			insertLlamaAIChart:
				(attrs) =>
				({ commands }) =>
					commands.insertContent({ type: this.name, attrs })
		}
	},

	addNodeView() {
		return ReactNodeViewRenderer(LlamaAIChartNodeView)
	}
})
