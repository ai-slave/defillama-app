import clsx from 'clsx'
import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

type TableTextAlign = 'start' | 'center' | 'end'

function getTableTextAlignClass(textAlign: TableTextAlign) {
	if (textAlign === 'center') return 'text-center'
	if (textAlign === 'end') return 'text-end'
	return 'text-start'
}

interface TokenPageTableCellProps {
	children: ReactNode
	className?: string
	textAlign?: TableTextAlign
}

export function TokenPageTableShell({
	children,
	className,
	...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
	return (
		<div className={clsx('overflow-hidden rounded-md border border-subtle', className)} {...props}>
			{children}
		</div>
	)
}

export function TokenPageTableScroller({
	children,
	className,
	...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
	return (
		<div data-table-scroller className={clsx('relative overflow-x-auto', className)} {...props}>
			{children}
		</div>
	)
}

export function TokenPageTable({
	children,
	className,
	separated = false,
	...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode; separated?: boolean }) {
	return (
		<table
			className={clsx(
				'w-max min-w-full text-sm',
				separated ? 'border-separate border-spacing-0' : 'border-collapse',
				className
			)}
			{...props}
		>
			{children}
		</table>
	)
}

export function TokenPageTableHeaderCell({
	children,
	className,
	textAlign = 'start',
	...props
}: TokenPageTableCellProps & ThHTMLAttributes<HTMLTableCellElement>) {
	return (
		<th
			className={clsx(
				'px-3 py-2 table-header whitespace-nowrap text-secondary',
				getTableTextAlignClass(textAlign),
				className
			)}
			{...props}
		>
			{children}
		</th>
	)
}

export function TokenPageTableBodyCell({
	children,
	className,
	textAlign = 'start',
	...props
}: TokenPageTableCellProps & TdHTMLAttributes<HTMLTableCellElement>) {
	return (
		<td
			className={clsx(
				'px-3 py-2 align-middle',
				getTableTextAlignClass(textAlign),
				textAlign === 'end' && 'tabular-nums',
				className
			)}
			{...props}
		>
			{children}
		</td>
	)
}

export function TokenPageTableIncomeHeaderCell({
	children,
	className,
	lastColumn = false,
	surface = 'cards',
	sticky = false,
	...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
	children: ReactNode
	className?: string
	lastColumn?: boolean
	surface?: 'app' | 'cards'
	sticky?: boolean
}) {
	return (
		<th
			className={clsx(
				'truncate border-r border-b border-subtle p-2 text-left',
				surface === 'app' ? 'bg-page' : 'bg-surface',
				sticky && 'first:sticky first:left-0 first:z-10',
				lastColumn && 'border-r-0',
				className
			)}
			{...props}
		>
			{children}
		</th>
	)
}

export function TokenPageTableIncomeCell({
	children,
	className,
	lastColumn = false,
	...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
	children: ReactNode
	className?: string
	lastColumn?: boolean
}) {
	return (
		<td
			className={clsx('truncate border-r border-b border-subtle p-2 text-left', lastColumn && 'border-r-0', className)}
			{...props}
		>
			{children}
		</td>
	)
}
