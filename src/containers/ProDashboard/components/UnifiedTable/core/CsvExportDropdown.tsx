import { useEffect, useRef, useState } from 'react'
import { Icon } from '~/ui/Icon'
import type { UnifiedRowHeaderType } from '../../../unifiedTable/config/types'
import { CSVExportButton } from '../../CSVExportButton'

export type CsvExportLevel = 'all' | UnifiedRowHeaderType

const EXPORT_LEVEL_LABELS: Record<CsvExportLevel, string> = {
	all: 'All Protocols',
	chain: 'Chains Only',
	category: 'Categories Only',
	'parent-protocol': 'Protocol Groups Only',
	protocol: 'Protocols Only'
}

interface CsvExportDropdownProps {
	rowHeaders: Array<UnifiedRowHeaderType>
	onExport: (level: CsvExportLevel) => void
	isLoading: boolean
	disabled: boolean
}

export function CsvExportDropdown({ rowHeaders, onExport, isLoading, disabled }: CsvExportDropdownProps) {
	const [isOpen, setIsOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	const exportOptions: Array<CsvExportLevel> = [
		'all',
		...rowHeaders.filter((header): header is Exclude<UnifiedRowHeaderType, 'protocol'> => header !== 'protocol')
	]

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (event.target instanceof Node && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false)
			}
		}

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen])

	const handleButtonClick = () => {
		if (disabled) return
		setIsOpen((prev) => !prev)
	}

	return (
		<div ref={dropdownRef} className="relative">
			<CSVExportButton
				onClick={handleButtonClick}
				isLoading={isLoading}
				className={`flex items-center gap-2 rounded-md border pro-border pro-hover-bg pro-panel-bg px-3 py-1.5 text-sm text-pro-text-primary transition-colors ${
					disabled ? 'cursor-not-allowed opacity-60' : ''
				}`}
			/>
			{isOpen ? (
				<div className="absolute top-full right-0 z-50 mt-1 min-w-[180px] rounded-md border border-pro-cards-border bg-pro-cards-bg py-1 shadow-lg">
					{exportOptions.map((level) => (
						<button
							key={level}
							type="button"
							onClick={() => {
								setIsOpen(false)
								onExport(level)
							}}
							className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-pro-text-primary transition-colors hover:bg-border-subtle"
						>
							<Icon name="download-paper" className="size-3 shrink-0 text-pro-text-tertiary" />
							{EXPORT_LEVEL_LABELS[level]}
						</button>
					))}
				</div>
			) : null}
		</div>
	)
}
