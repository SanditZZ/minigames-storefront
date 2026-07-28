// The web player's language surface: the shared dictionary and lookup rules
// plus the one provider that touches the browser.
//
// Re-exported through here so components import "../i18n" and never have to
// know which side of the package boundary a symbol falls on — exactly the same
// arrangement as `router/index.ts`.

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_SHORT_NAMES,
  type Locale,
  type MessageKey,
  type Translator,
} from "@minigames/player-core";
export { claimDocumentLang, LocaleProvider, useApi, useLocale, useT } from "./LocaleProvider";
