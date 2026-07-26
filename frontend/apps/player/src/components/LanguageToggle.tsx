import { LOCALE_NAMES, LOCALE_SHORT_NAMES, LOCALES, useLocale, useT, type Locale } from "../i18n";
import { SegmentedControl } from "../ui";

/**
 * The language switch, shown on the landing screen.
 *
 * Every option names itself — "English", "ไทย" — which is the one rule a
 * language switcher cannot break: someone looking for Thai scans for "ไทย", and
 * a control that says "Thai" is only legible to a person who already reads
 * English, which is exactly the person who does not need it. The group's own
 * label and each option's tooltip ARE translated, since those are read by
 * someone who has already found their language.
 *
 * The selected option is the EFFECTIVE locale, not the pinned one, so a Thai
 * phone opening a bare link shows ไทย selected rather than an English default
 * it is not actually rendering. Choosing pins `?lang=` in the URL (the screen
 * above owns that, via the router) rather than writing a preference anywhere,
 * so the choice is addressable like the rest of this app's state: it survives a
 * reload, it travels in a shared link, and a kiosk can be started in Thai from
 * a home-screen shortcut without touching the phone's own settings.
 *
 * It lives on the landing screen only, on purpose. A player picks a language
 * before they pick a game and the pin then travels with them; the same control
 * inside a live round would be one more thing to mis-tap beside the quit
 * button, which the round already has to guard against.
 */
export function LanguageToggle({ onChange }: { onChange: (locale: Locale) => void }) {
  const { locale } = useLocale();
  const t = useT();

  return (
    <SegmentedControl<Locale>
      label={t("language.label")}
      value={locale}
      onChange={onChange}
      options={LOCALES.map((value) => ({
        value,
        label: LOCALE_SHORT_NAMES[value],
        title: t("language.switchTo", { language: LOCALE_NAMES[value] }),
      }))}
    />
  );
}
