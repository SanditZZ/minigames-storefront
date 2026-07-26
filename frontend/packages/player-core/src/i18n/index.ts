// The client-owned half of the app's language support.
//
// What lives here is CHROME — the words the app says about itself. What the
// server decides (game names, score units, the errors a failed round produces)
// is translated in backend/internal/i18n and arrives ready to render; awards
// are admin-entered free text and are translated nowhere yet, which is a schema
// change filed in docs/potential-features.md rather than an oversight.
//
// Nothing in here imports React or touches `window`. The React glue — the
// provider, the hooks, keeping <html lang> in sync — lives in
// apps/player/src/i18n, which is the same split as `router/`: a pure grammar in
// the package, a thin platform binding in the app.

export { en, type MessageKey, type Messages } from "./en";
export { th } from "./th";
export {
  DEFAULT_LOCALE,
  LANG_PARAM,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_SHORT_NAMES,
  type Locale,
} from "./locales";
export {
  format,
  parseLang,
  parseLocale,
  pickLocale,
  translator,
  type MessageVars,
  type Translator,
} from "./translate";
