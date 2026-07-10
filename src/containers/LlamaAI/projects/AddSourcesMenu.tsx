import * as Ariakit from '@ariakit/react'
import { useRef } from 'react'
import { Icon } from '~/components/Icon'
import { AddTextContentModal } from './AddTextContentModal'
import { GitHubConnectModal } from './GitHubConnectModal'
import { PROJECT_FILE_ACCEPT, useProjectFileUpload } from './useProjectFileUpload'

interface AddSourcesMenuProps {
	projectId: string
	trigger: React.ReactNode
	menuClassName?: string
	gutter?: number
	// When set, the menu leads with a "This message" section that attaches files to the next
	// chat (ephemeral) rather than to permanent project knowledge.
	onAddPhotosFiles?: () => void
}

const SECTION_LABEL_CLASS =
	'px-3 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-[#999] dark:text-[#666]'

export function AddSourcesMenu({
	projectId,
	trigger,
	menuClassName,
	gutter = 6,
	onAddPhotosFiles
}: AddSourcesMenuProps) {
	const { handleFiles } = useProjectFileUpload(projectId)
	const addTextStore = Ariakit.useDialogStore()
	const githubStore = Ariakit.useDialogStore()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const folderInputRef = useRef<HTMLInputElement>(null)

	return (
		<>
			<Ariakit.MenuProvider placement="bottom-start">
				<Ariakit.MenuButton render={trigger as React.ReactElement} />
				<Ariakit.Menu
					gutter={gutter}
					className={
						menuClassName ??
						'z-50 min-w-[240px] rounded-xl border border-[#e6e6e6] bg-(--legacy-cards-bg) p-1 text-sm shadow-xl dark:border-[#222324] dark:bg-[#161718]'
					}
				>
					{onAddPhotosFiles ? (
						<>
							<div className={SECTION_LABEL_CLASS}>This message</div>
							<Ariakit.MenuItem
								onClick={onAddPhotosFiles}
								className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f0f0f0] dark:hover:bg-[#1c1d1e]"
							>
								<Icon name="image-plus" height={15} width={15} className="text-[#666] dark:text-[#919296]" />
								Add photos &amp; files
							</Ariakit.MenuItem>
							<div className="mx-2 my-1 h-px bg-[#e6e6e6] dark:bg-[#222324]" />
							<div className={SECTION_LABEL_CLASS}>Add to project</div>
						</>
					) : null}
					<Ariakit.MenuItem
						onClick={() => fileInputRef.current?.click()}
						className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f0f0f0] dark:hover:bg-[#1c1d1e]"
					>
						<Icon name="file-plus" height={15} width={15} className="text-[#666] dark:text-[#919296]" />
						Upload files
					</Ariakit.MenuItem>
					<Ariakit.MenuItem
						onClick={() => folderInputRef.current?.click()}
						className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f0f0f0] dark:hover:bg-[#1c1d1e]"
					>
						<Icon name="file-plus" height={15} width={15} className="text-[#666] dark:text-[#919296]" />
						Upload folder
					</Ariakit.MenuItem>
					<Ariakit.MenuItem
						onClick={() => addTextStore.show()}
						className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f0f0f0] dark:hover:bg-[#1c1d1e]"
					>
						<Icon name="file-text" height={15} width={15} className="text-[#666] dark:text-[#919296]" />
						Add text content
					</Ariakit.MenuItem>
					<Ariakit.MenuItem
						onClick={() => githubStore.show()}
						className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f0f0f0] dark:hover:bg-[#1c1d1e]"
					>
						<Icon name="github" height={15} width={15} className="text-[#666] dark:text-[#919296]" />
						Connect GitHub repo
					</Ariakit.MenuItem>
				</Ariakit.Menu>
			</Ariakit.MenuProvider>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={PROJECT_FILE_ACCEPT}
				hidden
				onChange={(e) => {
					const list = e.target.files ? Array.from(e.target.files) : []
					void handleFiles(list)
					if (fileInputRef.current) fileInputRef.current.value = ''
				}}
			/>
			<input
				ref={folderInputRef}
				type="file"
				multiple
				accept={PROJECT_FILE_ACCEPT}
				hidden
				// @ts-expect-error — non-standard attribute supported by Chromium/WebKit/Firefox.
				webkitdirectory=""
				directory=""
				onChange={(e) => {
					const list = e.target.files ? Array.from(e.target.files) : []
					void handleFiles(list)
					if (folderInputRef.current) folderInputRef.current.value = ''
				}}
			/>
			<AddTextContentModal dialogStore={addTextStore} projectId={projectId} />
			<GitHubConnectModal dialogStore={githubStore} projectId={projectId} />
		</>
	)
}
