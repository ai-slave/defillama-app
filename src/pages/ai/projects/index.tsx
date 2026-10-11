import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { LlamaAIShell } from '~/containers/LlamaAI/LlamaAIShell'
import { ProjectsSignInGate } from '~/containers/LlamaAI/projects/ProjectsSignInGate'

export default function ProjectsIndexPage() {
	const router = useRouter()
	const queryClient = useQueryClient()

	useEffect(() => {
		if (!router.isReady) return
		if (router.query.ghInstalled === '1') {
			toast.success('GitHub app installed — pick a repo to connect.')
			void (async () => {
				try {
					await queryClient.invalidateQueries({ queryKey: ['github', 'installations'] })
					const { ghInstalled: _drop, ...rest } = router.query
					await router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true })
				} catch (error) {
					console.error('Failed to refresh GitHub installations after install', error)
					toast.error("Couldn't refresh GitHub installations.")
				}
			})()
		}
	}, [router, queryClient])

	return <ProjectsSignInGate />
}

ProjectsIndexPage.getLayout = LlamaAIShell.getLayout
