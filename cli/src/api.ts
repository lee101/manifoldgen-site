export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) {
    super(message);
  }
}

export interface ApiResponse<T = any> {
  status: number;
  data: T;
}

export function hintFor(status: number): string {
  if (status === 401) return 'Run `mg auth login` or set MANIFOLDGEN_API_KEY.';
  if (status === 402) return 'Add credits at https://manifoldgen.com/account';
  if (status === 429 || status === 503) return 'Capacity is busy; retry shortly.';
  return '';
}

export class Api {
  constructor(public baseUrl: string, public apiKey: string | undefined, private fetcher: Fetch) {}

  url(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return this.baseUrl + (path.startsWith('/') ? path : '/' + path);
  }

  async raw<T = any>(method: string, path: string, body?: unknown, auth = true): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'manifoldgen-cli' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    let res: Response;
    try {
      res = await this.fetcher(this.url(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (err) {
      throw new ApiError(`Network error reaching ${this.baseUrl}: ${(err as Error).message}`, 0);
    }
    const text = await res.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text.slice(0, 300) };
      }
    }
    return { status: res.status, data };
  }

  async request<T = any>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const { status, data } = await this.raw<any>(method, path, body, auth);
    if (status >= 400) {
      const message = (data && (data.error || data.message)) || `HTTP ${status}`;
      throw new ApiError(String(message), status, data);
    }
    return data as T;
  }

  requireKey() {
    if (!this.apiKey) throw new ApiError('Not signed in.', 401);
  }
}
