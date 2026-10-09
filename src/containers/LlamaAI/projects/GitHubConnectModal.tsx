import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Select } from '~/components/Select/Select'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors, takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { popoverRowStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tag } from '~/ui/Tag'
import { queryReadFailed } from '~/utils/query'
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

const EMPTY_RESULTS_STYLES = 'px-3 py-6 text-center body-sm text-tertiary'

// One instance per opening: a fresh form, and old completions cannot change a reopened one.
export function GitHubConnectModal(props: GitHubConnectModalProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return <GitHubConnectDialog key={`${props.projectId}-${useOpeningKey(open)}`} {...props} />
}

function LoadError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
	return (
		<InlineStatus
			variant="error"
			action={
				<Button type="button" size="sm" onClick={onRetry} pendingLabel={retrying ? 'Retrying…' : null}>
					Try again
				</Button>
			}
		>
			{message}
		</InlineStatus>
	)
}

function GitHubConnectDialog({ dialogStore, projectId, finalFocus }: GitHubConnectModalProps) {
	const connect = useConnectGithubSource(projectId)
	return (
		<Dialog
			store={dialogStore}
			size="md"
			// Repository and branch results appear as the reader types, so the phone sheet keeps its full height.
			fullSheet
			pending={connect.isPending}
			finalFocus={finalFocus}
			unmountOnHide
			portal
		>
			{/* The dialog mounts its content only while it shows, so a closed dialog loads nothing from GitHub. */}
			<GitHubConnectForm dialogStore={dialogStore} projectId={projectId} connect={connect} />
		</Dialog>
	)
}

function GitHubConnectForm({
	dialogStore,
	projectId,
	connect
}: Pick<GitHubConnectModalProps, 'dialogStore' | 'projectId'> & {
	connect: ReturnType<typeof useConnectGithubSource>
}) {
	const installs = useGithubInstallations()
	const [selectedInstallId, setSelectedInstallId] = useState<number | null>(null)
	const [selectedRepo, setSelectedRepo] = useState('')
	// null while the field shows its selection; text while the reader types a search.
	const [repoQuery, setRepoQuery] = useState<string | null>(null)
	const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
	const [branchQuery, setBranchQuery] = useState<string | null>(null)
	// Set by a Connect with a field still empty; the field errors then follow the selection.
	const [submitted, setSubmitted] = useState(false)
	const defaultInstallId = installs.data?.[0]?.installation_id ?? null
	const effectiveInstallId = selectedInstallId ?? defaultInstallId
	const repos = useGithubRepos(effectiveInstallId)
	const startInstall = useStartGithubInstall()
	const install = useMutation({
		// The variable is the dialog element at the click, so a failure after it closes can still be reported.
		mutationFn: async (_dialog: HTMLElement | null) => {
			const { install_url } = await startInstall(`/ai/projects/${projectId}?tab=sources&connectGithub=1`)
			const url = getSafeGithubInstallUrl(install_url)
			if (!url) throw new Error('Could not start GitHub install')
			return url
		},
		onError: (_error, dialog) => {
			// The dialog shows the error while it is open; after it closes, only a toast can.
			if (!dialog?.isConnected) toast.error("Couldn't open GitHub to install the app.")
		}
	})

	const filteredRepos = useMemo(() => {
		const all = repos.data ?? []
		const q = repoQuery?.trim().toLowerCase()
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
	// A picked repository that a reload no longer lists says so at once; an empty pick waits for Connect.
	const repoError = repoSelectionIsStale
		? 'This repository is no longer in the list. Choose it again.'
		: submitted && !selectedRepo
			? 'Choose a repository.'
			: null
	const branchError = submitted && branches.isSuccess && !effectiveBranch ? 'Choose a branch.' : null

	const selectRepository = (repository: string) => {
		setSelectedRepo(repository)
		setRepoQuery(null)
		setSelectedBranch(null)
		setBranchQuery(null)
	}

	const filteredBranches = useMemo(() => {
		const all = branches.data ?? []
		const q = branchQuery?.trim().toLowerCase()
		if (!q) return all
		return all.filter((b) => b.name.toLowerCase().includes(q))
	}, [branches.data, branchQuery])

	const onConnect = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (connect.isPending) return
		const dialog = dialogStore.getState().contentElement
		// The dialog can unmount while the request runs (its host re-keys it), so check after the await.
		const isStillOpen = () => dialog?.isConnected === true
		const repo = repoMeta
		if (!repo || !effectiveBranch || !effectiveInstallId) {
			return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		}
		try {
			await connect.mutateAsync({
				owner: repo.full_name.split('/')[0],
				repo: repo.name,
				branch: effectiveBranch,
				installation_id: effectiveInstallId
			})
			if (isStillOpen()) dialogStore.hide()
			else toast.success(`Connected ${repo.full_name}`)
		} catch {
			// The dialog shows the error while it is open; after it closes, only a toast can.
			if (!isStillOpen()) toast.error(`Couldn't connect ${repo.full_name}.`)
		}
	}

	const onStartInstall = () => {
		if (install.isPending) return
		install.mutate(dialogStore.getState().contentElement, {
			onSuccess: (url) => {
				window.location.href = url
			}
		})
	}

	const hasInstalls = (installs.data?.length ?? 0) > 0
	const needsInstall = installs.isSuccess && !hasInstalls
	const fieldsLocked = connect.isPending || install.isPending

	return (
		<>
			<DialogHeader
				title="Connect a GitHub repo"
				subtitle="Read-only access. Files are fetched on demand, never written back."
				leading={
					<span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-subtle bg-surface-elevated-1 text-secondary">
						<Icon name="github" className="size-4" aria-hidden="true" />
					</span>
				}
			/>
			<form noValidate onSubmit={(event) => void onConnect(event)} className="flex min-h-0 flex-auto flex-col">
				<DialogBody>
					{queryReadFailed(installs) ? (
						<LoadError
							message="Couldn't load your GitHub installations."
							retrying={installs.isFetching}
							onRetry={() => void installs.refetch()}
						/>
					) : installs.isLoading ? (
						<div role="status" aria-live="polite">
							<LoadingIndicator label="Loading installations" />
						</div>
					) : needsInstall ? (
						<p className="body-sm text-secondary">
							No GitHub apps installed yet. Install LlamaAI Workspace on your GitHub account to grant repo access.
						</p>
					) : (
						<>
							<Field label="Installation">
								{(control) => (
									<Select
										heading="Installation"
										allValues={(installs.data ?? []).map((i) => ({
											key: String(i.installation_id),
											name: i.account_login
										}))}
										selectedValues={effectiveInstallId === null ? '' : String(effectiveInstallId)}
										setSelectedValues={(value: string) => {
											setSelectedInstallId(Number(value))
											selectRepository('')
										}}
										label={
											installs.data?.find((i) => i.installation_id === effectiveInstallId)?.account_login ??
											'Pick an installation'
										}
										labelType="none"
										variant="input"
										size="md"
										className="w-full justify-between"
										triggerProps={{
											...control,
											// A retry that succeeds replaces its button with this control, which takes the focus it drops.
											ref: takeLostFocus,
											'aria-label': 'Installation',
											disabled: fieldsLocked
										}}
									/>
								)}
							</Field>

							<Field label="Repository" error={repoError} live>
								{(control) =>
									queryReadFailed(repos) ? (
										<LoadError
											message="Couldn't load the repositories for this installation."
											retrying={repos.isFetching}
											onRetry={() => void repos.refetch()}
										/>
									) : repos.isLoading ? (
										<div role="status" aria-live="polite">
											<LoadingIndicator label="Loading repositories" />
										</div>
									) : (
										<Ariakit.ComboboxProvider
											inputValue={repoQuery ?? selectedRepo}
											setInputValue={setRepoQuery}
											selectedValue={selectedRepo}
											setSelectedValue={(value) => {
												if (typeof value === 'string') selectRepository(value)
											}}
										>
											<Ariakit.Combobox
												{...control}
												ref={takeLostFocus}
												disabled={fieldsLocked}
												placeholder="owner/repo"
												render={<Input className="w-full" />}
											/>
											<ComboboxSurface
												variant="search-results"
												sameWidth
												className="max-h-[min(256px,var(--popover-available-height))]"
											>
												{filteredRepos.length === 0 ? (
													<p className={EMPTY_RESULTS_STYLES}>No repositories match.</p>
												) : (
													filteredRepos.map((r) => (
														<Ariakit.ComboboxItem
															key={r.full_name}
															value={r.full_name}
															setValueOnClick={false}
															className={popoverRowStyles}
														>
															<span className="truncate">{r.full_name}</span>
															{r.private ? <Tag className="shrink-0">private</Tag> : null}
														</Ariakit.ComboboxItem>
													))
												)}
											</ComboboxSurface>
										</Ariakit.ComboboxProvider>
									)
								}
							</Field>

							<Field label="Branch" error={branchError}>
								{(control) =>
									!repoMeta ? (
										<p className="body-sm text-tertiary">Pick a repository first.</p>
									) : queryReadFailed(branches) ? (
										<LoadError
											message="Couldn't load the branches for this repository."
											retrying={branches.isFetching}
											onRetry={() => void branches.refetch()}
										/>
									) : branches.isLoading ? (
										<div role="status" aria-live="polite">
											<LoadingIndicator label="Loading branches" />
										</div>
									) : (
										<Ariakit.ComboboxProvider
											inputValue={branchQuery ?? effectiveBranch}
											setInputValue={setBranchQuery}
											selectedValue={effectiveBranch}
											setSelectedValue={(value) => {
												if (typeof value !== 'string') return
												setSelectedBranch(value || null)
												setBranchQuery(null)
											}}
										>
											<Ariakit.Combobox
												{...control}
												ref={takeLostFocus}
												disabled={fieldsLocked}
												placeholder="main"
												render={<Input className="w-full" />}
											/>
											<ComboboxSurface
												variant="search-results"
												sameWidth
												className="max-h-[min(256px,var(--popover-available-height))]"
											>
												{filteredBranches.length === 0 ? (
													<p className={EMPTY_RESULTS_STYLES}>No branches match.</p>
												) : (
													filteredBranches.map((b) => (
														<Ariakit.ComboboxItem
															key={b.name}
															value={b.name}
															setValueOnClick={false}
															className={popoverRowStyles}
														>
															<span className="truncate">{b.name}</span>
															{b.is_default ? (
																<Tag className="shrink-0">default</Tag>
															) : b.protected ? (
																<Tag className="shrink-0">protected</Tag>
															) : null}
														</Ariakit.ComboboxItem>
													))
												)}
											</ComboboxSurface>
										</Ariakit.ComboboxProvider>
									)
								}
							</Field>
						</>
					)}
					{connect.isError ? (
						<InlineStatus variant="error">Couldn&apos;t connect this repository. Try again.</InlineStatus>
					) : null}
					{install.isError ? (
						<InlineStatus variant="error">Couldn&apos;t open GitHub to install the app. Try again.</InlineStatus>
					) : null}
				</DialogBody>
				<DialogFooter
					leading={
						hasInstalls ? (
							<Button
								type="button"
								size="md"
								variant="ghost"
								disabled={connect.isPending}
								pendingLabel={install.isPending ? 'Opening GitHub…' : null}
								onClick={onStartInstall}
							>
								Manage installations
							</Button>
						) : null
					}
					dismiss={<DialogCancelButton />}
				>
					{hasInstalls ? (
						<Button
							type="submit"
							size="md"
							variant="primary"
							disabled={install.isPending}
							pendingLabel={connect.isPending ? 'Connecting…' : null}
						>
							Connect
						</Button>
					) : needsInstall ? (
						<Button
							ref={takeLostFocus}
							type="button"
							size="md"
							variant="primary"
							pendingLabel={install.isPending ? 'Opening GitHub…' : null}
							onClick={onStartInstall}
						>
							<Icon name="github" height={14} width={14} />
							Install GitHub App
						</Button>
					) : null}
				</DialogFooter>
			</form>
		</>
	)
}
