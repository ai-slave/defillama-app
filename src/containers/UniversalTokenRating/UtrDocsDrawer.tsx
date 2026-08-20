import { useEffect, useState } from 'react'
import { Drawer } from '~/containers/MarketMakers/Drawer'
import { UTR_GRADE_COLORS, type UtrGradeLabel } from './gradeBands'
import { UTR_DOC_CHAPTERS, UTR_DOCS_TITLE, type UtrDocBlock, type UtrDocChapter, type UtrDocListItem } from './utrDocs'

const TH = 'bg-brand px-4 py-2.5 text-left align-middle label-sm text-on-brand'
const TD = 'border-b border-subtle px-4 py-2 text-left body-sm text-secondary'

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function chapterSubsections(chapter: UtrDocChapter): { id: string; label: string }[] {
	if (chapter.id === 'glossary' || chapter.id === 'preface') return []
	const headings = chapter.blocks.filter((block) => block.type === 'heading')
	if (headings.length < 2) return []
	return [
		{ id: `utr-docs-${chapter.id}`, label: '1. Intro' },
		...headings.map((heading, index) => ({
			id: `utr-docs-${chapter.id}-${slugify(heading.text)}`,
			label: `${index + 2}. ${heading.text}`
		}))
	]
}

function GradeCell({ value }: { value: string }) {
	const color = UTR_GRADE_COLORS[value as UtrGradeLabel]
	if (!color || value === 'N/A') return <>{value}</>
	return (
		<span className={`inline-flex items-center justify-center rounded px-2 py-0.5 label-sm text-white ${color.solid}`}>
			{value}
		</span>
	)
}

function DocList({ ordered, items }: { ordered: boolean; items: UtrDocListItem[] }) {
	const List = ordered ? 'ol' : 'ul'
	return (
		<List className={`flex flex-col gap-1 pl-6 body-lg text-secondary ${ordered ? 'list-decimal' : 'list-disc'}`}>
			{items.map((item) => (
				<li key={item.text} className={item.strong ? 'font-semibold text-primary' : undefined}>
					{item.text}
					{item.children?.length ? (
						<ol className="flex list-[lower-alpha] flex-col gap-1 pl-6 font-normal text-secondary">
							{item.children.map((child) => (
								<li key={child}>{child}</li>
							))}
						</ol>
					) : null}
				</li>
			))}
		</List>
	)
}

function GradeTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
	const gradeIndex = headers.findIndex((header) => header === 'Grade')
	const isWeightTable = headers.length === 2
	return (
		<div className="overflow-x-auto rounded-lg border border-subtle">
			<table className="w-full table-fixed border-collapse body-sm">
				<colgroup>
					{headers.map((header, index) => (
						<col
							key={header}
							className={
								isWeightTable
									? index === 1
										? 'w-40'
										: undefined
									: gradeIndex >= 0
										? index === 0
											? 'w-44'
											: index === gradeIndex
												? 'w-24'
												: undefined
										: undefined
							}
						/>
					))}
				</colgroup>
				<thead>
					<tr>
						{headers.map((header, index) => (
							<th
								key={header}
								className={`${TH} ${index > 0 && index === headers.length - 1 && gradeIndex < 0 ? 'text-center' : ''}`}
							>
								{header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={rowIndex} className="last:[&>td]:border-b-0">
							{row.map((cell, cellIndex) => (
								<td
									key={cellIndex}
									className={`${TD} ${cellIndex === 0 && gradeIndex >= 0 ? 'font-jetbrains whitespace-nowrap' : ''} ${
										cellIndex > 0 && cellIndex === row.length - 1 && gradeIndex < 0 ? 'text-center' : ''
									}`}
								>
									{cellIndex === gradeIndex ? <GradeCell value={cell} /> : cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function DocBlock({ block, chapterId }: { block: UtrDocBlock; chapterId: string }) {
	switch (block.type) {
		case 'heading':
			return (
				<h3
					id={`utr-docs-${chapterId}-${slugify(block.text)}`}
					className={`scroll-mt-4 text-base font-semibold ${chapterId === 'glossary' ? 'mt-2' : ''}`}
				>
					{block.text}
				</h3>
			)
		case 'paragraph':
			return (
				<p className={`body-lg text-secondary ${block.strong ? 'font-semibold text-primary' : ''}`}>
					{block.lead ? <strong className="font-semibold text-primary">{block.lead} </strong> : null}
					{block.text}
				</p>
			)
		case 'formula':
			return <p className="font-jetbrains text-base font-normal text-secondary italic">{block.text}</p>
		case 'bullets':
			return <DocList ordered={false} items={block.items} />
		case 'numbered':
			return <DocList ordered items={block.items} />
		case 'table':
			return <GradeTable headers={block.headers} rows={block.rows} />
	}
}

export function UtrDocsDrawer({
	open,
	onClose,
	initialChapterId
}: {
	open: boolean
	onClose: () => void
	initialChapterId?: string
}) {
	const [activeId, setActiveId] = useState(initialChapterId ?? UTR_DOC_CHAPTERS[0].id)
	const [activeSubId, setActiveSubId] = useState<string | null>(null)

	const activeChapter = UTR_DOC_CHAPTERS.find((chapter) => chapter.id === activeId) ?? UTR_DOC_CHAPTERS[0]
	const subsections = chapterSubsections(activeChapter)

	useEffect(() => {
		if (!open) return
		if (initialChapterId) {
			setActiveId(initialChapterId)
			const frame = requestAnimationFrame(() => {
				document.getElementById(`utr-docs-${initialChapterId}`)?.scrollIntoView({ block: 'start' })
			})
			return () => cancelAnimationFrame(frame)
		}
	}, [open, initialChapterId])

	useEffect(() => {
		if (!open) return
		let observer: IntersectionObserver | null = null
		const raf = requestAnimationFrame(() => {
			const targets = UTR_DOC_CHAPTERS.flatMap((chapter) => {
				const section = document.getElementById(`utr-docs-${chapter.id}`)
				const headings = chapterSubsections(chapter)
					.slice(1)
					.map((subsection) => document.getElementById(subsection.id))
				return [section, ...headings].filter((el): el is HTMLElement => el != null)
			})
			if (targets.length === 0) return
			let root: HTMLElement | null = targets[0].parentElement
			while (root && root !== document.body) {
				const overflowY = getComputedStyle(root).overflowY
				if (overflowY === 'auto' || overflowY === 'scroll') break
				root = root.parentElement
			}
			observer = new IntersectionObserver(
				(entries) => {
					const visible = entries
						.filter((entry) => entry.isIntersecting)
						.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
					const topId = visible[0]?.target.id
					if (!topId) return
					const chapter = UTR_DOC_CHAPTERS.find(
						(entry) => topId === `utr-docs-${entry.id}` || topId.startsWith(`utr-docs-${entry.id}-`)
					)
					if (!chapter) return
					setActiveId(chapter.id)
					setActiveSubId(topId === `utr-docs-${chapter.id}` ? `utr-docs-${chapter.id}` : topId)
				},
				{ root, rootMargin: '0px 0px -75% 0px', threshold: 0 }
			)
			targets.forEach((target) => observer?.observe(target))
		})
		return () => {
			cancelAnimationFrame(raf)
			observer?.disconnect()
		}
	}, [open])

	const scrollToId = (id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	return (
		<Drawer open={open} onClose={onClose} title={UTR_DOCS_TITLE} widthClassName="sm:max-w-2xl lg:max-w-[1110px]">
			<div className="flex flex-col gap-4 md:flex-row md:gap-6">
				<nav className="md:w-[290px] md:shrink-0 md:self-stretch md:border-r md:border-subtle">
					<div className="md:sticky md:top-0">
						<p className="border-b border-subtle px-5 py-4 heading-xs">Chapters</p>
						<ul className="flex flex-col gap-4 border-b border-subtle px-4 py-6">
							{UTR_DOC_CHAPTERS.map((chapter) => {
								const active = chapter.id === activeId
								return (
									<li key={chapter.id}>
										<button
											type="button"
											onClick={() => {
												setActiveId(chapter.id)
												setActiveSubId(null)
												scrollToId(`utr-docs-${chapter.id}`)
											}}
											className={`flex w-full cursor-pointer border-l-2 pl-3 text-left text-base whitespace-nowrap ${
												active
													? 'border-brand font-medium text-link'
													: 'border-transparent text-primary hover:text-link'
											}`}
										>
											{chapter.label}
										</button>
									</li>
								)
							})}
						</ul>
						{subsections.length ? (
							<ul className="flex flex-col gap-3 px-4 py-5">
								{subsections.map((subsection) => {
									const active =
										activeSubId === subsection.id || (activeSubId == null && subsection.label === '1. Intro')
									return (
										<li key={subsection.id}>
											<button
												type="button"
												onClick={() => {
													setActiveSubId(subsection.id)
													scrollToId(subsection.id)
												}}
												className={`flex w-full cursor-pointer pl-3 text-left text-base ${
													active ? 'text-link' : 'text-primary hover:text-link'
												}`}
											>
												{subsection.label}
											</button>
										</li>
									)
								})}
							</ul>
						) : null}
					</div>
				</nav>

				<div className="flex min-w-0 flex-1 flex-col gap-8 p-4">
					{UTR_DOC_CHAPTERS.map((chapter) => (
						<section
							key={chapter.id}
							id={`utr-docs-${chapter.id}`}
							className={`flex scroll-mt-4 flex-col ${chapter.id === 'glossary' ? 'gap-2' : 'gap-5'}`}
						>
							<h2 className="heading-xs">{chapter.label}</h2>
							{chapter.blocks.map((block, index) => (
								<DocBlock key={index} block={block} chapterId={chapter.id} />
							))}
						</section>
					))}
				</div>
			</div>
		</Drawer>
	)
}
