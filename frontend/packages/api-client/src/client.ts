import type {
  Award,
  AwardInput,
  ClaimStatus,
  ClaimView,
  Game,
  HighScores,
  Prize,
  PublicSettings,
  Setting,
  SettingInput,
  StartSessionResponse,
  SubmitResult,
  SubmitScoreInput,
  UploadedImage,
} from "./types";
import { LANG_PARAM } from "./locale";

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
  /**
   * Language to ask the API to answer in ("en", "th"). Only the player app
   * sets this; the admin is not translated.
   *
   * A client is built PER LOCALE rather than given a mutable setting, which is
   * what keeps this dependency-free module free of state: switching language
   * builds a new client, so no request can be issued against a locale that
   * changed while it was in flight.
   *
   * Sent as a query parameter rather than an Accept-Language header on purpose.
   * It is visible in a log and in the address bar, it needs no CORS preflight
   * on a cross-origin API — which this always is, since the apps are built with
   * an absolute API base — and it caches correctly without a Vary.
   */
  locale?: string;
}

/**
 * createClient returns a small typed wrapper over fetch. All request/response
 * shapes come from the shared types module, so both apps talk to the backend
 * through one contract. It is deliberately dependency-free.
 */
export function createClient(opts: ClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, "");

  /** Appends the requested language, if this client has one. */
  function withLocale(path: string): string {
    if (!opts.locale) return path;
    return `${path}${path.includes("?") ? "&" : "?"}${LANG_PARAM}=${encodeURIComponent(opts.locale)}`;
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    // FormData must set its own Content-Type: the browser appends the multipart
    // boundary, and overriding it here produces a body the server cannot parse.
    if (init?.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (opts.adminToken) headers.set("X-Admin-Token", opts.adminToken);

    const res = await fetch(`${base}${withLocale(path)}`, { ...init, headers });
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
    /** Prizes on offer for a game, for the landing screen's showcase. Public. */
    gamePrizes: (slug: string) => request<Prize[]>(`/api/v1/games/${slug}/awards`),
    /**
     * The allowlisted settings an unauthenticated client may read — today the
     * store's name and tagline. Deliberately a flat key→value map rather than
     * the admin `Setting[]`: descriptions and edit timestamps are operator
     * data, and the narrower shape is what keeps the allowlist meaningful.
     *
     * Read it through `storeIdentity` in @minigames/player-core rather than
     * indexing the map at a call site, so the fallbacks stay in one place.
     */
    publicSettings: () => request<PublicSettings>("/api/v1/settings/public"),

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

    /**
     * Every claim, newest first, optionally narrowed to one status.
     *
     * The status filter is applied server-side because status is derived there
     * from the server's clock — passing it through rather than filtering the
     * response keeps one definition of "expired".
     */
    listClaims: (status?: ClaimStatus) =>
      request<ClaimView[]>(`/api/v1/admin/claims${status ? `?status=${status}` : ""}`),
    /**
     * Marks a prize handed over. The code may be passed exactly as a human
     * typed it — case and the grouping dash are normalised by the backend.
     *
     * Throws ApiError(404) for a code that does not resolve and ApiError(409)
     * for one that cannot be redeemed, whose message is the reason to read out
     * at the counter ("this claim has already been redeemed").
     */
    redeemClaim: (code: string) =>
      request<ClaimView>(`/api/v1/admin/claims/${encodeURIComponent(code)}/redeem`, {
        method: "POST",
      }),

    /**
     * Uploads one image and returns where it can be fetched.
     *
     * The returned URL is ABSOLUTE — it has to be, because the apps are built
     * with an absolute API base baked in and therefore run on a different
     * origin than the API. Store it verbatim in `Award.imageUrl` or the store
     * logo setting; do not try to make it relative.
     *
     * Throws ApiError(415) for a file that is not an accepted image and
     * ApiError(413) for one over the size cap — both carry a message worth
     * showing the operator as-is.
     */
    uploadImage: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return request<UploadedImage>("/api/v1/admin/uploads", { method: "POST", body });
    },
    /** Removes an uploaded object. Idempotent — an already-deleted name is fine. */
    deleteUpload: (name: string) =>
      request<void>(`/api/v1/admin/uploads/${encodeURIComponent(name)}`, { method: "DELETE" }),

    listSettings: () => request<Setting[]>("/api/v1/admin/settings"),
    upsertSetting: (key: string, body: SettingInput) =>
      request<Setting>(`/api/v1/admin/settings/${key}`, { method: "PUT", body: JSON.stringify(body) }),
    deleteSetting: (key: string) =>
      request<void>(`/api/v1/admin/settings/${key}`, { method: "DELETE" }),
  };
}

/** The concrete client type, handy for prop typing in components. */
export type ApiClient = ReturnType<typeof createClient>;
