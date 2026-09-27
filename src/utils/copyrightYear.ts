/**
 * The year the bundle was evaluated. Pages that show it have no data function, so their HTML is frozen at build;
 * StaleText carries the text so a visit after New Year hydrates without a warning and updates on the next render.
 */
export const COPYRIGHT_YEAR = new Date().getUTCFullYear()
