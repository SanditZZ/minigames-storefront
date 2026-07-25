import type {
  Award,
  AwardInput,
  Game,
  HighScores,
  Setting,
  SettingInput,
  StartSessionResponse,
  SubmitResult,
  SubmitScoreInput,
} from "./types";

/** Error thrown for any non-2xx API response, carrying the HTTP status so
 *  callers can branch on it (e.g. 409 = session already used). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ClientOptions {
  baseUrl: string;
  /** Shared secret for /admin routes. Only the admin app sets this. */
  adminToken?: string;
}

/**
 * createClient returns a small typed wrapper over fetch. All request/response
 * shapes come from the shared types module, so both apps talk to the backend
 * through one contract. It is deliberately dependency-free.
 */
export function createClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set("Content-Type", "application/json");
    if (opts.adminToken) headers.set("X-Admin-Token", opts.adminToken);

    const res = await fetch(`${base}${path}`, { ...init, headers });
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const msg = data?.error ?? `request failed with ${res.status}`;
      throw new ApiError(res.status, msg);
    }
    return data as T;
  }

  return {
    // --- Player play flow ---
    listGames: () => request<Game[]>("/api/v1/games"),
    getGame: (slug: string) => request<Game>(`/api/v1/games/${slug}`),
    startSession: (slug: string) =>
      request<StartSessionResponse>(`/api/v1/games/${slug}/sessions`, { method: "POST" }),
    submitScore: (slug: string, body: SubmitScoreInput) =>
      request<SubmitResult>(`/api/v1/games/${slug}/scores`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    /** Re-reads a finished round so /result/:slug/:id works on reload or share. */
    scoreResult: (slug: string, scoreId: string) =>
      request<SubmitResult>(`/api/v1/games/${slug}/scores/${scoreId}`),
    highScores: (slug: string, limit?: number) =>
      request<HighScores>(`/api/v1/games/${slug}/scores${limit ? `?limit=${limit}` : ""}`),

    // --- Admin CRUD (requires adminToken) ---
    listAwards: () => request<Award[]>("/api/v1/admin/awards"),
    createAward: (body: AwardInput) =>
      request<Award>("/api/v1/admin/awards", { method: "POST", body: JSON.stringify(body) }),
    updateAward: (id: string, body: AwardInput) =>
      request<Award>(`/api/v1/admin/awards/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    deleteAward: (id: string) =>
      request<void>(`/api/v1/admin/awards/${id}`, { method: "DELETE" }),

    listSettings: () => request<Setting[]>("/api/v1/admin/settings"),
    upsertSetting: (key: string, body: SettingInput) =>
      request<Setting>(`/api/v1/admin/settings/${key}`, { method: "PUT", body: JSON.stringify(body) }),
    deleteSetting: (key: string) =>
      request<void>(`/api/v1/admin/settings/${key}`, { method: "DELETE" }),
  };
}

/** The concrete client type, handy for prop typing in components. */
export type ApiClient = ReturnType<typeof createClient>;
