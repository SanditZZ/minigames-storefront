import { createClient } from "@minigames/api-client";

// Player app is unauthenticated — it only calls public play-flow endpoints.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export const api = createClient({ baseUrl });
