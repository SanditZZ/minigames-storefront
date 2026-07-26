import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { COLORS } from "@minigames/tokens";
import { baseUrl } from "./api";

// The native admin's shared UI, same rule as the web app's `src/ui/`: screens
// compose these and never restyle markup (see frontend/CLAUDE.md).
//
// These moved out of app/index.tsx when the claims screen arrived. The markup is
// unchanged — the Maestro flows key on `sign-in-screen`, `admin-token-input`,
// `admin-signin-button` and `sign-in-error`, so those testIDs are part of the
// contract of this file, not decoration.

/** A full-bleed centred area on the app background. */
export function Centered({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center bg-brand-4 p-6">{children}</View>;
}

/** The one spinner. `COLORS.ink` because a platform view takes a style value. */
export function Spinner() {
  return (
    <Centered>
      <ActivityIndicator color={COLORS.ink} />
    </Centered>
  );
}

/** A dead end with an explanation — a missing API host, a failed load. */
export function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Centered>
      <Text className="text-lg font-bold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-sm text-ink/70">{body}</Text>
    </Centered>
  );
}

/** An error banner. Renders nothing when there is no message, like the web `Alert`. */
export function Banner({ message, testID }: { message: string; testID?: string }) {
  if (message === "") return null;
  return (
    <View testID={testID} className="m-4 rounded-xl bg-brand p-3">
      <Text className="text-sm font-semibold text-ink">{message}</Text>
    </View>
  );
}

/** The primary button. `disabled` greys it rather than hiding it. */
export function ActionButton({
  label,
  onPress,
  disabled = false,
  tone = "primary",
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "ghost";
  testID?: string;
}) {
  const base = disabled ? "bg-ink/10" : tone === "primary" ? "bg-brand" : "bg-white";
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      // px-5 py-3 keeps every control at or above the 44px tap target the
      // project's UI rules require — on a phone at a counter, in one hand.
      className={`rounded-xl px-5 py-3 ${base}`}
    >
      <Text className="text-center text-base font-bold text-ink">{label}</Text>
    </Pressable>
  );
}

/**
 * The "are you sure" step, mirroring the web kit's `ConfirmPrompt`.
 *
 * Native has `Alert.alert`, and it is deliberately not used: a platform dialog
 * cannot show the prize name in the app's own type, and — the reason that
 * matters here — it is exactly the modal that makes a camera-driven flow
 * unpredictable, since the scanner keeps running behind it. This is an in-place
 * card, so the screen can stop the camera and show the question in one state
 * change.
 */
export function ConfirmPrompt({
  question,
  note,
  verb,
  busy = false,
  onConfirm,
  onCancel,
}: {
  question: string;
  note: string;
  verb: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View testID="confirm-prompt" className="m-4 rounded-2xl bg-white p-4">
      <Text className="text-base font-bold text-ink">{question}</Text>
      <Text className="mt-1 text-sm text-ink/70">{note}</Text>
      {/* Wrapping, not a fixed row: two labelled buttons and a prize name do not
          fit one narrow phone row, and a confirm control that overflows is worse
          than one that stacks. */}
      <View className="mt-3 flex-row flex-wrap items-center gap-3">
        <ActionButton
          testID="confirm-action"
          label={busy ? "Working…" : verb}
          disabled={busy}
          onPress={onConfirm}
        />
        <ActionButton testID="confirm-cancel" tone="ghost" label="Cancel" disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

/** The shared-secret gate. Identical markup to the web app's `TokenGate`. */
export function SignIn({ error, onSubmit }: { error: string; onSubmit: (token: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Centered>
      <View testID="sign-in-screen" className="w-full max-w-sm gap-3">
        <Text className="text-xl font-bold text-ink">Admin sign in</Text>
        <Text className="text-sm text-ink/60">
          The shared secret for {baseUrl}. Stored in the device keychain, not in app storage.
        </Text>
        <TextInput
          testID="admin-token-input"
          value={value}
          onChangeText={setValue}
          placeholder="Admin token"
          placeholderTextColor="#4A2B2066"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-xl bg-white px-4 py-3 text-ink"
        />
        {error !== "" && (
          <Text testID="sign-in-error" className="text-sm font-semibold text-ink">
            {error}
          </Text>
        )}
        <Pressable
          testID="admin-signin-button"
          disabled={value === ""}
          onPress={() => onSubmit(value)}
          className={`rounded-xl px-4 py-3 ${value === "" ? "bg-ink/10" : "bg-brand"}`}
        >
          <Text className="text-center text-base font-bold text-ink">Sign in</Text>
        </Pressable>
      </View>
    </Centered>
  );
}

/** The "this build has no API host" dead end, which both screens can hit. */
export function NotConfigured() {
  return (
    <Notice
      title="No API host baked in"
      body="This build has no apiBaseUrl. Rebuild with EXPO_PUBLIC_API_URL set to the address the phone can reach — the Tailscale IP that serve-prod.sh prints, never localhost."
    />
  );
}
