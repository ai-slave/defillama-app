import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '~/components/Icon'
import { ChartRenderer } from '~/containers/LlamaAI/components/charts/ChartRenderer'
import type { ChartConfiguration } from '~/containers/LlamaAI/types'
import { validateLlamaAIChartConfig, type LlamaAIChartData } from '../../llamaaiChart'

function CaptionEditor({ caption, onChange }: { caption: string; onChange: (caption: string) => void }) {
	const [draft, setDraft] = useState(caption)
	const ref = useRef<HTMLTextAreaElement | null>(null)

	useEffect(() => {
		setDraft(caption)
	}, [caption])

	useEffect(() => {
		const el = ref.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${el.scrollHeight}px`
	}, [draft])

	return (
		<textarea
			ref={ref}
			value={draft}
			rows={1}
			placeholder="Add a caption, e.g. data source and denomination."
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => {
				const next = draft.trim()
				if (next === caption.trim()) return
				onChange(next)
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault()
					;(e.target as HTMLTextAreaElement).blur()
				}
			}}
			onMouseDown={(e) => e.stopPropagation()}
			className="w-full resize-none border-b border-dashed border-transparent bg-transparent text-[13px] leading-snug text-secondary outline-hidden placeholder:text-tertiary/70 hover:border-medium focus:border-link/60 focus:text-primary"
		/>
	)
}

export function LlamaAIChartNodeView({ node, selected, deleteNode, updateAttributes }: NodeViewProps) {
	const config = validateLlamaAIChartConfig(node.attrs.chartConfig)
	const chartData = node.attrs.chartData as LlamaAIChartData | null
	const caption = typeof node.attrs.caption === 'string' ? node.attrs.caption : ''

	// TipTap mounts node views detached from the document and attaches them a beat
	// later; the ECharts components init via document.getElementById, which returns
	// null while detached and never retries. Defer the chart until we're connected.
	const chartHostRef = useRef<HTMLDivElement | null>(null)
	const [attached, setAttached] = useState(false)
	useEffect(() => {
		if (attached) return
		let raf = 0
		const check = () => {
			if (chartHostRef.current?.isConnected) setAttached(true)
			else raf = requestAnimationFrame(check)
		}
		check()
		return () => cancelAnimationFrame(raf)
	}, [attached])

	const handleStyleSave = (updated: ChartConfiguration) => {
		updateAttributes({ chartConfig: updated })
	}

	return (
		<NodeViewWrapper data-llamaai-chart className="group relative my-6 pl-4 sm:pl-6">
			<span
				aria-hidden
				className={`pointer-events-none absolute top-2 bottom-2 left-0 w-px transition-colors duration-150 ${
					selected ? 'bg-link' : 'bg-border-medium group-focus-within:bg-tertiary group-hover:bg-tertiary'
				}`}
			/>

			<div
				contentEditable={false}
				onMouseDown={(e) => e.stopPropagation()}
				className={`pointer-events-none absolute -top-2 right-0 left-4 z-10 flex items-center justify-between gap-2 transition-opacity duration-150 sm:left-6 ${
					selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
				}`}
			>
				<span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xs border border-medium bg-surface px-2 py-1 font-jetbrains text-[10px] tracking-[0.22em] text-tertiary uppercase shadow-xs">
					<Icon name="sparkles" className="size-3 text-link" />
					LlamaAI · {config?.type ?? 'chart'}
				</span>
				<span className="pointer-events-auto flex items-stretch divide-x divide-(--border-medium) overflow-hidden rounded-xs border border-medium bg-surface shadow-xs">
					<button
						type="button"
						title="Remove chart"
						aria-label="Remove chart"
						onMouseDown={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
						onClick={(e) => {
							e.stopPropagation()
							deleteNode()
						}}
						className="flex items-center gap-1.5 px-2.5 py-1 font-jetbrains text-[10px] tracking-[0.2em] text-tertiary uppercase transition-colors hover:bg-(--legacy-link-hover-bg) hover:text-error"
					>
						<Icon name="trash-2" className="size-3" />
						Remove
					</button>
				</span>
			</div>

			<div contentEditable={false} ref={chartHostRef}>
				{config && chartData && attached ? (
					<ChartRenderer charts={[config]} chartData={chartData} onLocalStyleSave={handleStyleSave} />
				) : config && chartData ? (
					<div className="h-[338px]" />
				) : (
					<div className="flex items-center justify-center rounded-md border border-dashed border-medium py-10 text-sm text-tertiary">
						Invalid LlamaAI chart data — remove this block and re-export it.
					</div>
				)}
				<CaptionEditor caption={caption} onChange={(next) => updateAttributes({ caption: next })} />
			</div>
		</NodeViewWrapper>
	)
}
