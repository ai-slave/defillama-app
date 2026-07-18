import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import {
	getMemories,
	deleteMemory,
	clearMemories,
	getSkills,
	archiveSkill,
	restoreSkill
} from '~/containers/LlamaAI/api/agentHome'

export const AGENT_HOME_MEMORIES_KEY = ['agent-home-memories'] as const
export const AGENT_HOME_SKILLS_KEY = ['agent-home-skills'] as const

export function useAgentHomeData(shouldLoad: boolean = true) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const queryClient = useQueryClient()

	const memories = useQuery({
		queryKey: AGENT_HOME_MEMORIES_KEY,
		queryFn: () => getMemories(authorizedFetch),
		enabled: isAuthenticated && shouldLoad
	})

	const skills = useQuery({
		queryKey: AGENT_HOME_SKILLS_KEY,
		queryFn: () => getSkills(authorizedFetch),
		enabled: isAuthenticated && shouldLoad
	})

	const deleteMemoryMutation = useMutation({
		mutationFn: (id: string) => deleteMemory(authorizedFetch, id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_HOME_MEMORIES_KEY })
	})

	const clearMemoriesMutation = useMutation({
		mutationFn: (target: 'user' | 'memory') => clearMemories(authorizedFetch, target),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_HOME_MEMORIES_KEY })
	})

	const archiveSkillMutation = useMutation({
		mutationFn: (name: string) => archiveSkill(authorizedFetch, name),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_HOME_SKILLS_KEY })
	})

	const restoreSkillMutation = useMutation({
		mutationFn: (name: string) => restoreSkill(authorizedFetch, name),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: AGENT_HOME_SKILLS_KEY })
	})

	return { memories, skills, deleteMemoryMutation, clearMemoriesMutation, archiveSkillMutation, restoreSkillMutation }
}
