import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import type { GroupBase, MenuListProps, MultiValue } from 'react-select'
import { ReactSelect } from '~/components/MultiSelect/ReactSelect'
import { ProButton, ProDialog } from '../ui'
import { reactSelectStyles } from '../utils/reactSelectStyles'

interface CategoryFilterModalProps {
	isOpen: boolean
	onClose: () => void
	onApply: (include: Array<string>, exclude: Array<string>) => void
	onClear: () => void
	categories: Array<string>
	initialInclude: Array<string>
	initialExclude: Array<string>
}

interface CategoryOption {
	value: string
	label: string
}

function SimpleMenuList(props: MenuListProps<CategoryOption, true, GroupBase<CategoryOption>>) {
	return (
		<div
			style={{
				maxHeight: props.maxHeight,
				overflowY: 'auto'
			}}
		>
			{props.children}
		</div>
	)
}

export function CategoryFilterModal({
	isOpen,
	onClose,
	onApply,
	onClear,
	categories,
	initialInclude,
	initialExclude
}: CategoryFilterModalProps) {
	const [selectedInclude, setSelectedInclude] = React.useState<Array<string>>(initialInclude)
	const [selectedExclude, setSelectedExclude] = React.useState<Array<string>>(initialExclude)

	const categoryOptions = React.useMemo(
		() =>
			categories.map((category) => ({
				value: category,
				label: category
			})),
		[categories]
	)

	const selectedIncludeSet = React.useMemo(() => new Set(selectedInclude), [selectedInclude])
	const selectedExcludeSet = React.useMemo(() => new Set(selectedExclude), [selectedExclude])

	const { includeOptions, includeValue, excludeOptions, excludeValue } = React.useMemo(() => {
		return {
			includeOptions: categoryOptions.filter((opt) => !selectedExcludeSet.has(opt.value)),
			includeValue: categoryOptions.filter((opt) => selectedIncludeSet.has(opt.value)),
			excludeOptions: categoryOptions.filter((opt) => !selectedIncludeSet.has(opt.value)),
			excludeValue: categoryOptions.filter((opt) => selectedExcludeSet.has(opt.value))
		}
	}, [categoryOptions, selectedIncludeSet, selectedExcludeSet])

	const hasSelections = selectedInclude.length > 0 || selectedExclude.length > 0

	return (
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) onClose()
			}}
		>
			<ProDialog
				width="md"
				heading="Filter Categories"
				hideOnInteractOutside
				footer={
					<div className="flex flex-1 items-center justify-between">
						<ProButton
							type="button"
							variant="ghost"
							size="md"
							onClick={() => {
								setSelectedInclude([])
								setSelectedExclude([])
								onClear()
								onClose()
							}}
							disabled={!hasSelections}
						>
							Clear all
						</ProButton>
						<div className="flex gap-2">
							<Ariakit.DialogDismiss render={<ProButton type="button" variant="secondary" size="md" />}>
								Cancel
							</Ariakit.DialogDismiss>
							<ProButton
								type="button"
								variant="primary"
								size="md"
								onClick={() => {
									onApply(selectedInclude, selectedExclude)
									onClose()
								}}
							>
								Apply Filters
							</ProButton>
						</div>
					</div>
				}
			>
				<div className="space-y-6">
					<div>
						<label htmlFor="category-filter-include" className="mb-2 block text-sm font-medium text-pro-text-secondary">
							Include Categories
						</label>
						<ReactSelect<CategoryOption, true>
							inputId="category-filter-include"
							isMulti
							options={includeOptions}
							value={includeValue}
							onChange={(selection: MultiValue<CategoryOption>) => {
								setSelectedInclude(selection.map((item) => item.value))
							}}
							placeholder="Select categories to include..."
							styles={reactSelectStyles<CategoryOption, true, GroupBase<CategoryOption>>()}
							components={{ MenuList: SimpleMenuList }}
							closeMenuOnSelect={false}
							menuPosition="fixed"
						/>
					</div>

					<div>
						<label htmlFor="category-filter-exclude" className="mb-2 block text-sm font-medium text-pro-text-secondary">
							Exclude Categories
						</label>
						<ReactSelect<CategoryOption, true>
							inputId="category-filter-exclude"
							isMulti
							options={excludeOptions}
							value={excludeValue}
							onChange={(selection: MultiValue<CategoryOption>) => {
								setSelectedExclude(selection.map((item) => item.value))
							}}
							placeholder="Select categories to exclude..."
							styles={reactSelectStyles<CategoryOption, true, GroupBase<CategoryOption>>()}
							components={{ MenuList: SimpleMenuList }}
							closeMenuOnSelect={false}
							menuPosition="fixed"
						/>
					</div>
				</div>
			</ProDialog>
		</Ariakit.DialogProvider>
	)
}
