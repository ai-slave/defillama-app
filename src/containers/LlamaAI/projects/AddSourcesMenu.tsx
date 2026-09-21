import * as Ariakit from '@ariakit/react'
import { useRef } from 'react'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { UploadSelectionNotice } from '../components/UploadSelectionNotice'
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

const SECTION_LABEL_CLASS = 'px-3 pt-2 pb-1 label-xs tracking-wide text-tertiary uppercase'

export function AddSourcesMenu({
	projectId,
	trigger,
	menuClassName,
	gutter = 6,
	onAddPhotosFiles
}: AddSourcesMenuProps) {
	const { handleFiles, isUploading, feedback, dismissFeedback } = useProjectFileUpload(projectId)
	const addTextStore = Ariakit.useDialogStore()
	const githubStore = Ariakit.useDialogStore()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const folderInputRef = useRef<HTMLInputElement>(null)

	return (
		<>
			<Ariakit.MenuProvider placement="bottom-start">
				<Ariakit.MenuButton disabled={isUploading} render={trigger as React.ReactElement} />
				<MenuSurface variant="actions" gutter={gutter} className={menuClassName ?? 'z-50 w-60'}>
					{onAddPhotosFiles ? (
						<>
							<div className={SECTION_LABEL_CLASS}>This message</div>
							<MenuItem onClick={onAddPhotosFiles} className="w-full gap-2 text-left">
								<Icon name="image-plus" height={14} width={14} className="text-secondary" />
								Add photos &amp; files
							</MenuItem>
							<Ariakit.MenuSeparator className="my-1 border-t border-subtle" />
							<div className={SECTION_LABEL_CLASS}>Add to project</div>
						</>
					) : null}
					<MenuItem onClick={() => fileInputRef.current?.click()} className="w-full gap-2 text-left">
						<Icon name="file-plus" height={14} width={14} className="text-secondary" />
						Upload files
					</MenuItem>
					<MenuItem onClick={() => folderInputRef.current?.click()} className="w-full gap-2 text-left">
						<Icon name="file-plus" height={14} width={14} className="text-secondary" />
						Upload folder
					</MenuItem>
					<MenuItem onClick={() => addTextStore.show()} className="w-full gap-2 text-left">
						<Icon name="file-text" height={14} width={14} className="text-secondary" />
						Add text content
					</MenuItem>
					<MenuItem onClick={() => githubStore.show()} className="w-full gap-2 text-left">
						<Icon name="github" height={14} width={14} className="text-secondary" />
						Connect GitHub repo
					</MenuItem>
				</MenuSurface>
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
			{isUploading || feedback ? (
				<Ariakit.Portal>
					<div className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-surface shadow-lg">
						{isUploading ? (
							<p role="status" className="p-3 body-sm text-secondary">
								Uploading project files…
							</p>
						) : null}
						<UploadSelectionNotice feedback={feedback} onDismiss={dismissFeedback} />
					</div>
				</Ariakit.Portal>
			) : null}
			<AddTextContentModal dialogStore={addTextStore} projectId={projectId} />
			<GitHubConnectModal dialogStore={githubStore} projectId={projectId} />
		</>
	)
}
