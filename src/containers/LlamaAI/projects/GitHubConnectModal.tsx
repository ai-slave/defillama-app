import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useId, useMemo, useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { DialogCloseButton, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { inputStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { popoverHovercardSurfaceStyles } from '~/ui/Popover'
import {
	useConnectGithubSource,
	useGithubBranches,
	useGithubInstallations,
	useGithubRepos,
	useStartGithubInstall
} from './hooks'

interface GitHubConnectModalProps {
	dialogStore: Ariakit.DialogStore
	projectId: string
	finalFocus?: RefObject<HTMLElement | null>
}

const TRUSTED_GITHUB_INSTALL_HOSTS = new Set(['github.com', 'www.github.com'])

function getSafeGithubInstallUrl(value: string): string | null {
	try {
		const url = new URL(value)
		if (url.protocol !== 'https:') return null
		if (!TRUSTED_GITHUB_INSTALL_HOSTS.has(url.hostname.toLowerCase())) return null
		if (!url.pathname.startsWith('/apps/') && !url.pathname.startsWith('/settings/installations')) return null
		return url.toString()
	} catch {
		return null
	}
}

export function GitHubConnectModal({ dialogStore, projectId, finalFocus }: GitHubConnectModalProps) {
	const headingRef = useRef<HTMLHeadingElement>(null)
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				initialFocus={headingRef}
				finalFocus={finalFocus}
				className={`${dialogSurfaceStyles} [--dialog-width:520px]`}
				portal
			>
				{isOpen ? (
					<GitHubConnectForm key={projectId} dialogStore={dialogStore} projectId={projectId} headingRef={headingRef} />
				) : null}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

// One instance per opening: unmounting prevents old completions from changing a reopened form.
function GitHubConnectForm({
	dialogStore,
	projectId,
	headingRef
}: GitHubConnectModalProps & { headingRef: RefObject<HTMLHeadingElement | null> }) {
	const formRef = useRef<HTMLDivElement>(null)
	const repoInputId = useId()
	const branchInputId = useId()
	const installs = useGithubInstallations()
	const [selectedInstallId, setSelectedInstallId] = useState<number | null>(null)
	const [selectedRepo, setSelectedRepo] = useState('')
	const [repoQuery, setRepoQuery] = useState('')
	const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
	const [branchQuery, setBranchQuery] = useState('')
	const defaultInstallId = installs.data?.[0]?.installation_id ?? null
	const effectiveInstallId = selectedInstallId ?? defaultInstallId
	const repos = useGithubRepos(effectiveInstallId)
	const connect = useConnectGithubSource(projectId)
	const startInstall = useStartGithubInstall()
	const install = useMutation({
		mutationFn: async () => {
			const { install_url } = await startInstall(`/ai/projects/${projectId}?tab=sources&connectGithub=1`)
			const url = getSafeGithubInstallUrl(install_url)
			if (!url) throw new Error('Could not start GitHub install')
			return url
		},
		onError: (error) => {
			if (!formRef.current?.isConnected) toast.error(error.message)
		}
	})

	const filteredRepos = useMemo(() => {
		const all = repos.data ?? []
		const q = repoQuery.trim().toLowerCase()
		if (!q) return all
		return all.filter((r) => r.full_name.toLowerCase().includes(q))
	}, [repos.data, repoQuery])

	const repoMeta = useMemo(
		() => repos.data?.find((r) => r.full_name === selectedRepo) ?? null,
		[repos.data, selectedRepo]
	)
	const repoSelectionIsStale = !!selectedRepo && !repos.isLoading && !repos.isError && !repoMeta

	const repoOwner = repoMeta ? repoMeta.full_name.split('/')[0] : null
	const repoName = repoMeta ? repoMeta.name : null
	const branches = useGithubBranches(effectiveInstallId, repoOwner, repoName)
	const defaultBranch = branches.data?.find((branch) => branch.is_default) ?? branches.data?.[0]
	const effectiveBranch =
		selectedBranch && branches.data?.some((branch) => branch.name === selectedBranch)
			? selectedBranch
			: (defaultBranch?.name ?? '')

	const selectRepository = (repository: string) => {
		setSelectedRepo(repository)
		setRepoQuery('')
		setSelectedBranch(null)
		setBranchQuery('')
	}

	const filteredBranches = useMemo(() => {
		const all = branches.data ?? []
		const q = branchQuery.trim().toLowerCase()
		if (!q) return all
		return all.filter((b) => b.name.toLowerCase().includes(q))
	}, [branches.data, branchQuery])

	const onConnect = async () => {
		if (connect.isPending) return
		const isStillMounted = () => formRef.current?.isConnected === true
		if (!selectedRepo || !effectiveBranch || !effectiveInstallId) {
			toast.error('Choose a repository and branch before connecting.')
			return
		}
		const repo = repoMeta
		if (!repo) {
			toast.error('Repository metadata is stale. Pick the repository again.')
			return
		}
		try {
			await connect.mutateAsync({
				owner: repo.full_name.split('/')[0],
				repo: repo.name,
				branch: effectiveBranch,
				installation_id: effectiveInstallId
			})
			if (isStillMounted()) dialogStore.hide()
			else toast.success(`Connected ${repo.full_name}`)
		} catch (error) {
			if (!isStillMounted()) toast.error(error instanceof Error ? error.message : 'Failed to connect repository')
		}
	}

	const onStartInstall = () => {
		if (install.isPending) return
		install.mutate(undefined, {
			onSuccess: (url) => {
				window.location.href = url
			}
		})
	}

	const hasInstalls = (installs.data?.length ?? 0) > 0

	return (
		<div ref={formRef} className="flex min-h-0 flex-auto flex-col">
			<header className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-4 py-3">
				<div className="flex items-center gap-2">
					<Icon name="github" height={16} width={16} className="shrink-0 text-secondary" />
					<div className="flex flex-col gap-0.5">
						{/* Initial focus lands on the heading, which DialogHeading does not expose a ref for. */}
						<Ariakit.DialogHeading
							ref={headingRef}
							tabIndex={-1}
							render={<h2>Connect a GitHub repo</h2>}
							className="heading-xs text-primary outline-hidden"
						/>
						<p className="body-sm text-secondary">Read-only access. Files are fetched on demand, never written back.</p>
					</div>
				</div>
				<DialogCloseButton ariaLabel="Close GitHub connection dialog" />
			</header>
			<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-4`}>
				{connect.error ? (
					<p role="alert" className="text-sm text-error">
						{connect.error.message}
					</p>
				) : null}
				{install.error ? (
					<p role="alert" className="text-sm text-error">
						{install.error.message}
					</p>
				) : null}
				<div className="flex flex-col gap-4">
					{installs.isLoading ? (
						<div className="flex items-center gap-2 text-xs text-tertiary">
							<LoadingSpinner size={12} /> Loading installations…
						</div>
					) : installs.isError ? (
						<div className="flex flex-col gap-3 rounded-md border border-error/30 bg-error/10 p-4 text-xs text-error">
							<p>{installs.error instanceof Error ? installs.error.message : 'Failed to load GitHub installations.'}</p>
							<Button type="button" size="sm" className="self-start" onClick={() => void installs.refetch()}>
								Retry
							</Button>
						</div>
					) : !hasInstalls ? (
						<div className="flex flex-col gap-3 rounded-md border border-dashed border-subtle p-4 text-xs text-tertiary">
							<p>
								No GitHub apps installed yet. Install LlamaAI Workspace on your GitHub account to grant repo access.
							</p>
							<Button
								type="button"
								size="md"
								variant="primary"
								className="self-start"
								onClick={() => void onStartInstall()}
								disabled={install.isPending || connect.isPending}
							>
								{install.isPending ? <LoadingSpinner size={14} /> : <Icon name="github" height={14} width={14} />}
								Install GitHub App
							</Button>
						</div>
					) : (
						<>
							<label className="flex flex-col gap-1.5">
								<span className="text-xs font-medium text-secondary">Installation</span>
								<select
									disabled={connect.isPending || install.isPending}
									value={effectiveInstallId ?? ''}
									onChange={(e) => {
										setSelectedInstallId(Number(e.target.value))
										selectRepository('')
									}}
									className={inputStyles}
								>
									{installs.data?.map((i) => (
										<option key={i.installation_id} value={i.installation_id}>
											{i.account_login}
										</option>
									))}
								</select>
							</label>

							<div className="flex flex-col gap-1.5">
								<label htmlFor={repoInputId} className="text-xs font-medium text-secondary">
									Repository
								</label>
								{repos.isLoading ? (
									<div className="flex items-center gap-2 text-xs text-tertiary">
										<LoadingSpinner size={12} /> Loading repositories…
									</div>
								) : repos.isError ? (
									<div className="flex flex-col gap-2 rounded-md border border-error/30 bg-error/10 p-3 text-xs text-error">
										<p>{repos.error instanceof Error ? repos.error.message : 'Failed to load repositories.'}</p>
										<Button type="button" size="sm" className="self-start" onClick={() => void repos.refetch()}>
											Retry
										</Button>
									</div>
								) : (
									<Ariakit.ComboboxProvider
										inputValue={repoQuery}
										setInputValue={setRepoQuery}
										selectedValue={selectedRepo}
										setSelectedValue={(value) => {
											if (typeof value === 'string') selectRepository(value)
										}}
									>
										<Ariakit.Combobox
											id={repoInputId}
											disabled={connect.isPending || install.isPending}
											placeholder={selectedRepo || 'Search repositories…'}
											className={inputStyles}
										/>
										<Ariakit.ComboboxPopover
											gutter={4}
											sameWidth
											className={`${popoverHovercardSurfaceStyles} z-[60]! max-h-64 py-1`}
										>
											{filteredRepos.length === 0 ? (
												<div className="px-3 py-2 text-xs text-tertiary">No repositories match.</div>
											) : (
												filteredRepos.map((r) => (
													<Ariakit.ComboboxItem
														key={r.full_name}
														value={r.full_name}
														className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-inherit data-[active-item]:bg-surface-elevated-1"
													>
														<span className="truncate">{r.full_name}</span>
														{r.private ? (
															<span className="ml-auto rounded-sm bg-surface-elevated-1 px-1 py-0.5 text-[10px] text-tertiary">
																private
															</span>
														) : null}
													</Ariakit.ComboboxItem>
												))
											)}
										</Ariakit.ComboboxPopover>
									</Ariakit.ComboboxProvider>
								)}
								{repoSelectionIsStale ? (
									<p className="text-xs text-error">Repository metadata is stale. Pick the repository again.</p>
								) : null}
							</div>

							<div className="flex flex-col gap-1.5">
								<label htmlFor={branchInputId} className="text-xs font-medium text-secondary">
									Branch
								</label>
								{!selectedRepo ? (
									<div className="rounded-md border border-dashed border-subtle px-3 py-2 text-xs text-tertiary">
										Pick a repository first
									</div>
								) : branches.isLoading ? (
									<div className="flex items-center gap-2 text-xs text-tertiary">
										<LoadingSpinner size={12} /> Loading branches…
									</div>
								) : branches.isError ? (
									<div className="flex flex-col gap-2 rounded-md border border-error/30 bg-error/10 p-3 text-xs text-error">
										<p>{branches.error instanceof Error ? branches.error.message : 'Failed to load branches.'}</p>
										<Button type="button" size="sm" className="self-start" onClick={() => void branches.refetch()}>
											Retry
										</Button>
									</div>
								) : (
									<Ariakit.ComboboxProvider
										inputValue={branchQuery}
										setInputValue={setBranchQuery}
										selectedValue={effectiveBranch}
										setSelectedValue={(value) => {
											if (typeof value === 'string') setSelectedBranch(value || null)
										}}
									>
										<Ariakit.Combobox
											id={branchInputId}
											disabled={connect.isPending || install.isPending}
											placeholder={effectiveBranch || 'Search branches…'}
											className="rounded-md border border-subtle bg-surface px-3 py-2 text-sm text-inherit placeholder:text-tertiary focus:border-brand focus:outline-hidden"
										/>
										<Ariakit.ComboboxPopover
											gutter={4}
											sameWidth
											className={`${popoverHovercardSurfaceStyles} z-[60]! max-h-64 py-1`}
										>
											{filteredBranches.length === 0 ? (
												<div className="px-3 py-2 text-xs text-tertiary">No branches match.</div>
											) : (
												filteredBranches.map((b) => (
													<Ariakit.ComboboxItem
														key={b.name}
														value={b.name}
														className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-inherit data-[active-item]:bg-surface-elevated-1"
													>
														<span className="truncate">{b.name}</span>
														{b.is_default ? (
															<span className="ml-auto rounded-sm bg-surface-elevated-1 px-1 py-0.5 text-[10px] text-tertiary">
																default
															</span>
														) : b.protected ? (
															<span className="ml-auto rounded-sm bg-surface-elevated-1 px-1 py-0.5 text-[10px] text-tertiary">
																protected
															</span>
														) : null}
													</Ariakit.ComboboxItem>
												))
											)}
										</Ariakit.ComboboxPopover>
									</Ariakit.ComboboxProvider>
								)}
							</div>

							<button
								type="button"
								onClick={() => void onStartInstall()}
								disabled={install.isPending || connect.isPending}
								className="self-start text-xs text-brand underline-offset-2 not-disabled:not-aria-disabled:hover:underline disabled:opacity-50"
							>
								Manage installations →
							</button>
						</>
					)}
				</div>
			</div>
			<footer className="flex shrink-0 justify-end gap-2 border-t border-subtle px-4 py-3">
				<Ariakit.DialogDismiss type="button" render={<Button size="md" />}>
					Cancel
				</Ariakit.DialogDismiss>
				{hasInstalls ? (
					<Button
						type="button"
						size="md"
						variant="primary"
						onClick={() => void onConnect()}
						disabled={!repoMeta || !effectiveBranch || !effectiveInstallId || connect.isPending || install.isPending}
					>
						{connect.isPending ? <LoadingSpinner size={14} /> : null}
						{connect.isPending ? 'Connecting…' : 'Connect'}
					</Button>
				) : null}
			</footer>
		</div>
	)
}
