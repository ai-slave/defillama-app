import { tw } from '../tw'

/** The mark of text that explains itself: a dotted underline 2px under the text and the help cursor. Definition draws
    it on a Tooltip anchor and Hovercard on its anchor when `definition` is set, so both read the same. */
export const definitionMarkStyles = tw`cursor-help underline decoration-dotted underline-offset-2`
