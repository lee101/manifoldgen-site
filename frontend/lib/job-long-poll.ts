// Long-poll helpers for GET /api/video-jobs/{id}. The server holds the request
// (up to 25 s) until the job leaves `status`, and marks such replies with
// `long_poll: true`. Servers without VIDEO_JOB_LONG_POLL ignore the params, so
// callers keep their normal sleep whenever the reply is not marked.
export const JOB_LONG_POLL_SECONDS = 25;

export function jobLongPollURL(url: string, lastStatus?: string): string {
  const separator = url.includes('?') ? '&' : '?';
  const status = lastStatus ? `&status=${encodeURIComponent(lastStatus)}` : '';
  return `${url}${separator}wait=${JOB_LONG_POLL_SECONDS}${status}`;
}

export function jobLongPollHonored(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && (payload as { long_poll?: unknown }).long_poll === true;
}
