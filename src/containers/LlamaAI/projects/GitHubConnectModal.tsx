import * as Ariakit from '@ariakit/react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
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

export function GitHubConnectModal({ dialogStore, projectId }: GitHubConnectModalProps) {
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				className="fixed top-1/2 left-1/2 z-50 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ai-line bg-surface p-5 shadow-2xl"
				backdrop={<div className="backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-md" />}
			>
				{isOpen ? <GitHubConnectForm key={projectId} dialogStore={dialogStore} projectId={projectId} /> : null}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function GitHubConnectForm({ dialogStore, projectId }: GitHubConnectModalProps) {
	const installs = useGithubInstallations()
	const [selectedInstallId, setSelectedInstallId] = useState<number | null>(null)
	const [selectedRepo, setSelectedRepo] = useState('')
	const [repoQuery, setRepoQuery] = useState('')
	const [selectedBranch, setSelectedBranch] = useState('')
	const [branchQuery, setBranchQuery] = useState('')
	const [installing, setInstalling] = useState(false)
	const defaultInstallId = installs.data?.[0]?.installation_id ?? null
	const effectiveInstallId = selectedInstallId ?? defaultInstallId
	const repos = useGithubRepos(effectiveInstallId)
	const connect = useConnectGithubSource(projectId)
	const startInstall = useStartGithubInstall()

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

	useEffect(() => {
		setSelectedBranch('')
		setBranchQuery('')
	}, [selectedRepo])

	useEffect(() => {
		if (selectedBranch || !branches.data || branches.data.length === 0) return
		const defaultBranch = branches.data.find((b) => b.is_default) ?? branches.data[0]
		if (defaultBranch) setSelectedBranch(defaultBranch.name)
	}, [branches.data, selectedBranch])

	const filteredBranches = useMemo(() => {
		const all = branches.data ?? []
		const q = branchQuery.trim().toLowerCase()
		if (!q) return all
		return all.filter((b) => b.name.toLowerCase().includes(q))
	}, [branches.data, branchQuery])

	const onConnect = async () => {
		if (!selectedRepo || !selectedBranch || !effectiveInstallId) {
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
				branch: selectedBranch,
				installation_id: effectiveInstallId
			})
			toast.success(`Connected ${repo.full_name}`)
			dialogStore.hide()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to connect repository')
		}
	}

	const onStartInstall = async () => {
		try {
			setInstalling(true)
			const returnTo = `/ai/projects/${projectId}?tab=sources&connectGithub=1`
			const { install_url } = await startInstall(returnTo)
			const safeInstallUrl = getSafeGithubInstallUrl(install_url)
			if (!safeInstallUrl) {
				console.error('Rejected unsafe GitHub install URL', install_url)
				toast.error('Could not start GitHub install')
				setInstalling(false)
				return
			}
			window.location.href = safeInstallUrl
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not start GitHub install')
			setInstalling(false)
		}
	}

	const hasInstalls = (installs.data?.length ?? 0) > 0

	return (
		<>
			<header className="flex items-start justify-between">
				<div className="flex items-center gap-2">
					<Icon name="github" height={18} width={18} />
					<div>
						<h2 className="text-base font-semibold text-primary">Connect a GitHub repo</h2>
						<p className="mt-0.5 text-xs text-ai-tertiary">
							Read-only access. Files are fetched on demand, never written back.
						</p>
					</div>
				</div>
				<Ariakit.DialogDismiss className="-mr-1.5 rounded-lg p-2 text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary">
					<Icon name="x" height={16} width={16} />
				</Ariakit.DialogDismiss>
			</header>

			<div className="mt-4 flex flex-col gap-4">
				{installs.isLoading ? (
					<div className="flex items-center gap-2 text-xs text-ai-tertiary">
						<LoadingSpinner size={12} /> Loading installations…
					</div>
				) : installs.isError ? (
					<div className="flex flex-col gap-3 rounded-md border border-ai-error-border bg-ai-error-bg p-4 text-xs text-ai-error-strong">
						<p>{installs.error instanceof Error ? installs.error.message : 'Failed to load GitHub installations.'}</p>
						<button
							type="button"
							onClick={() => void installs.refetch()}
							className="self-start rounded-md border border-ai-error-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-ai-error-border"
						>
							Retry
						</button>
					</div>
				) : !hasInstalls ? (
					<div className="flex flex-col gap-3 rounded-md border border-dashed border-ai-line p-4 text-xs text-ai-tertiary">
						<p>No GitHub apps installed yet. Install LlamaAI Workspace on your GitHub account to grant repo access.</p>
						<button
							type="button"
							onClick={() => void onStartInstall()}
							disabled={installing}
							className="flex items-center justify-center gap-2 self-start rounded-md border border-ai-inverse bg-ai-inverse px-3 py-1.5 text-xs font-medium text-ai-on-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{installing ? <LoadingSpinner size={12} /> : <Icon name="github" height={14} width={14} />}
							Install GitHub App
						</button>
					</div>
				) : (
					<>
						<label className="flex flex-col gap-1.5">
							<span className="text-xs font-medium text-ai-secondary">Installation</span>
							<select
								value={effectiveInstallId ?? ''}
								onChange={(e) => {
									setSelectedInstallId(Number(e.target.value))
									setSelectedRepo('')
									setRepoQuery('')
								}}
								className="rounded-md border border-ai-line bg-surface px-3 py-2 text-sm text-inherit focus:border-brand focus:outline-hidden"
							>
								{installs.data?.map((i) => (
									<option key={i.installation_id} value={i.installation_id}>
										{i.account_login}
									</option>
								))}
							</select>
						</label>

						<div className="flex flex-col gap-1.5">
							<span className="text-xs font-medium text-ai-secondary">Repository</span>
							{repos.isLoading ? (
								<div className="flex items-center gap-2 text-xs text-ai-tertiary">
									<LoadingSpinner size={12} /> Loading repositories…
								</div>
							) : repos.isError ? (
								<div className="flex flex-col gap-2 rounded-md border border-ai-error-border bg-ai-error-bg p-3 text-xs text-ai-error-strong">
									<p>{repos.error instanceof Error ? repos.error.message : 'Failed to load repositories.'}</p>
									<button
										type="button"
										onClick={() => void repos.refetch()}
										className="self-start rounded-md border border-ai-error-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-ai-error-border"
									>
										Retry
									</button>
								</div>
							) : (
								<Ariakit.ComboboxProvider
									value={repoQuery}
									setValue={setRepoQuery}
									selectedValue={selectedRepo}
									setSelectedValue={(value) => {
										if (typeof value === 'string') setSelectedRepo(value)
									}}
								>
									<Ariakit.Combobox
										placeholder={selectedRepo || 'Search repositories…'}
										className="rounded-md border border-ai-line bg-surface px-3 py-2 text-sm text-inherit placeholder:text-ai-muted focus:border-brand focus:outline-hidden"
									/>
									<Ariakit.ComboboxPopover
										gutter={4}
										sameWidth
										className="z-[60] max-h-64 overflow-y-auto rounded-md border border-ai-line bg-surface py-1 shadow-lg"
									>
										{filteredRepos.length === 0 ? (
											<div className="px-3 py-2 text-xs text-ai-muted">No repositories match.</div>
										) : (
											filteredRepos.map((r) => (
												<Ariakit.ComboboxItem
													key={r.full_name}
													value={r.full_name}
													className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-inherit data-[active-item]:bg-ai-surface-muted"
												>
													<span className="truncate">{r.full_name}</span>
													{r.private ? (
														<span className="ml-auto rounded-sm bg-ai-surface-muted px-1 py-0.5 text-[10px] text-ai-tertiary">
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
								<p className="text-xs text-ai-error">Repository metadata is stale. Pick the repository again.</p>
							) : null}
						</div>

						<div className="flex flex-col gap-1.5">
							<span className="text-xs font-medium text-ai-secondary">Branch</span>
							{!selectedRepo ? (
								<div className="rounded-md border border-dashed border-ai-line px-3 py-2 text-xs text-ai-muted">
									Pick a repository first
								</div>
							) : branches.isLoading ? (
								<div className="flex items-center gap-2 text-xs text-ai-tertiary">
									<LoadingSpinner size={12} /> Loading branches…
								</div>
							) : branches.isError ? (
								<div className="flex flex-col gap-2 rounded-md border border-ai-error-border bg-ai-error-bg p-3 text-xs text-ai-error-strong">
									<p>{branches.error instanceof Error ? branches.error.message : 'Failed to load branches.'}</p>
									<button
										type="button"
										onClick={() => void branches.refetch()}
										className="self-start rounded-md border border-ai-error-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-ai-error-border"
									>
										Retry
									</button>
								</div>
							) : (
								<Ariakit.ComboboxProvider
									value={branchQuery}
									setValue={setBranchQuery}
									selectedValue={selectedBranch}
									setSelectedValue={(value) => {
										if (typeof value === 'string') setSelectedBranch(value)
									}}
								>
									<Ariakit.Combobox
										placeholder={selectedBranch || 'Search branches…'}
										className="rounded-md border border-ai-line bg-surface px-3 py-2 text-sm text-inherit placeholder:text-ai-muted focus:border-brand focus:outline-hidden"
									/>
									<Ariakit.ComboboxPopover
										gutter={4}
										sameWidth
										className="z-[60] max-h-64 overflow-y-auto rounded-md border border-ai-line bg-surface py-1 shadow-lg"
									>
										{filteredBranches.length === 0 ? (
											<div className="px-3 py-2 text-xs text-ai-muted">No branches match.</div>
										) : (
											filteredBranches.map((b) => (
												<Ariakit.ComboboxItem
													key={b.name}
													value={b.name}
													className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-inherit data-[active-item]:bg-ai-surface-muted"
												>
													<span className="truncate">{b.name}</span>
													{b.is_default ? (
														<span className="ml-auto rounded-sm bg-ai-surface-muted px-1 py-0.5 text-[10px] text-ai-tertiary">
															default
														</span>
													) : b.protected ? (
														<span className="ml-auto rounded-sm bg-ai-surface-muted px-1 py-0.5 text-[10px] text-ai-tertiary">
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
							disabled={installing}
							className="self-start text-xs text-brand underline-offset-2 hover:underline disabled:opacity-50"
						>
							Manage installations →
						</button>
					</>
				)}

				<footer className="mt-1 flex justify-end gap-2">
					<Ariakit.DialogDismiss
						type="button"
						className="rounded-md px-3 py-1.5 text-xs text-ai-tertiary hover:bg-ai-surface-muted"
					>
						Cancel
					</Ariakit.DialogDismiss>
					{hasInstalls ? (
						<button
							type="button"
							onClick={() => void onConnect()}
							disabled={!repoMeta || !selectedBranch || !effectiveInstallId || connect.isPending}
							className="flex items-center gap-1.5 rounded-md border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-ai-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{connect.isPending ? <LoadingSpinner size={12} /> : null}
							Connect
						</button>
					) : null}
				</footer>
			</div>
		</>
	)
}
