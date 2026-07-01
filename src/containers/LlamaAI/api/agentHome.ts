import { llamaAIRequest, type AuthorizedFetch } from '~/containers/LlamaAI/api/transport'

export interface MemoryEntry {
	id: string
	text: string
	chars: number
}

export interface MemoriesResponse {
	available: boolean
	user: MemoryEntry[]
	memory: MemoryEntry[]
	limits: { user: number; memory: number }
}

export interface AgentSkill {
	name: string
	description: string
	source: 'user' | 'archived'
	createdBy: 'agent' | 'user'
	useCount: number
	pinned: boolean
	lastUsedAt: string | null
	referencedSkills: string[]
}

export interface SkillsResponse {
	available: boolean
	active: AgentSkill[]
	archived: AgentSkill[]
}

export const getMemories = (af: AuthorizedFetch) => llamaAIRequest<MemoriesResponse>(af, '/agent-home/memories')

export const deleteMemory = (af: AuthorizedFetch, id: string) =>
	llamaAIRequest<{ deleted: true }>(af, `/agent-home/memories/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const clearMemories = (af: AuthorizedFetch, target: 'user' | 'memory') =>
	llamaAIRequest<{ cleared: number }>(af, `/agent-home/memories?target=${target}`, { method: 'DELETE' })

export const getSkills = (af: AuthorizedFetch) => llamaAIRequest<SkillsResponse>(af, '/agent-home/skills')

export const archiveSkill = (af: AuthorizedFetch, name: string) =>
	llamaAIRequest<{ message: string }>(af, `/agent-home/skills/${encodeURIComponent(name)}`, { method: 'DELETE' })

export const restoreSkill = (af: AuthorizedFetch, name: string) =>
	llamaAIRequest<{ message: string }>(af, `/agent-home/skills/${encodeURIComponent(name)}/restore`, { method: 'POST' })
