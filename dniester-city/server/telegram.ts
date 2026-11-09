export class TelegramError extends Error {
  constructor(
    public code: number,
    public retryAfter = 0,
  ) {
    super('Telegram request failed');
  }
}
export type TelegramUpdate = {
  update_id: number;
  message?: { text?: string; chat: { id: number; type: string }; from?: { is_bot?: boolean } };
};
export function createTelegramClient(token: string, fetcher: typeof fetch = fetch) {
  return async <T = unknown>(method: string, body: unknown): Promise<T> => {
    const response = await fetcher(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
    const data = (await response.json()) as {
      ok: boolean;
      result: T;
      error_code?: number;
      parameters?: { retry_after?: number };
    };
    if (!data.ok)
      throw new TelegramError(
        data.error_code || response.status,
        Math.max(0, Number(data.parameters?.retry_after) || 0),
      );
    return data.result;
  };
}
