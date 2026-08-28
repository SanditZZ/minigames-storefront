/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** The player app's own origin, so the settings panel can link to its display route. */
  readonly VITE_PLAYER_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
