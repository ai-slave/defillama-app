import { describe, expect, it } from 'vitest'
import {
	didQueueAttachProgress,
	hasClaimableQueueWork,
	shouldConfirmQueueDrain,
	shouldTriggerQueueAttach
} from '~/containers/LlamaAI/utils/queueAttach'

describe('queue attachment decisions', () => {
	it('treats an editing item as an ordering barrier', () => {
		expect(hasClaimableQueueWork([{ state: 'editing' }, { state: 'pending' }])).toBe(false)
	})

	it('skips terminal rows before the first executable item', () => {
		expect(hasClaimableQueueWork([{ state: 'not_sent' }, { state: 'pending' }])).toBe(true)
	})

	it('attaches only for an idle client with claimable work', () => {
		const queue = [{ state: 'pending' as const }]
		expect(shouldTriggerQueueAttach(false, 'session-1', queue)).toBe(true)
		expect(shouldTriggerQueueAttach(true, 'session-1', queue)).toBe(false)
		expect(shouldTriggerQueueAttach(false, null, queue)).toBe(false)
	})

	it('confirms the final execution after observed work leaves the claimable queue', () => {
		expect(shouldConfirmQueueDrain(true, [])).toBe(true)
		expect(shouldConfirmQueueDrain(true, [{ state: 'editing' }])).toBe(true)
		expect(shouldConfirmQueueDrain(false, [])).toBe(false)
	})

	it('recognizes queue or execution identity progress', () => {
		expect(didQueueAttachProgress('q1:firing', '', null, null)).toBe(true)
		expect(didQueueAttachProgress('q1:firing', 'q1:firing', 'message-1', 'message-2')).toBe(true)
		expect(didQueueAttachProgress('q1:firing', 'q1:firing', 'message-1', 'message-1')).toBe(false)
	})
})
