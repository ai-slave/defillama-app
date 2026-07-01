import { describe, expect, it, vi } from 'vitest'
import { getMemories, deleteMemory, clearMemories, archiveSkill } from '../agentHome'

function stubFetch(json: unknown) {
	return vi.fn(
		async () => new Response(JSON.stringify(json), { status: 200, headers: { 'content-type': 'application/json' } })
	)
}

describe('agentHome api', () => {
	it('GET /agent-home/memories', async () => {
		const af = stubFetch({ available: true, user: [], memory: [], limits: { user: 1375, memory: 2200 } })
		await getMemories(af as any)
		expect(af).toHaveBeenCalledWith(expect.stringContaining('/agent-home/memories'), expect.any(Object))
	})

	it('DELETE /agent-home/memories/:id encodes the id', async () => {
		const af = stubFetch({ deleted: true })
		await deleteMemory(af as any, 'abc123')
		const [url, init] = (af as any).mock.calls[0]
		expect(url).toContain('/agent-home/memories/abc123')
		expect(init.method).toBe('DELETE')
	})

	it('DELETE /agent-home/memories?target= for clear-all', async () => {
		const af = stubFetch({ cleared: 2 })
		await clearMemories(af as any, 'user')
		expect((af as any).mock.calls[0][0]).toContain('/agent-home/memories?target=user')
	})

	it('DELETE /agent-home/skills/:name to archive', async () => {
		const af = stubFetch({ message: 'Archived skill: x' })
		await archiveSkill(af as any, 'x')
		const [url, init] = (af as any).mock.calls[0]
		expect(url).toContain('/agent-home/skills/x')
		expect(init.method).toBe('DELETE')
	})
})
