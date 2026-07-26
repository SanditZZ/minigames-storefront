import { useRef, useState } from "react";
import type { ApiClient } from "@minigames/api-client";
import { Alert, Button, Field, Input } from "../ui";

/**
 * An image, as an operator deals with one: a preview, an upload button, and the
 * URL it resolved to.
 *
 * The URL stays visible and editable on purpose. Uploading is a convenience,
 * not the only source — a store with its assets already on a CDN should be able
 * to paste a link — and what is stored either way is just a URL, so showing it
 * is showing the truth rather than hiding it behind a widget.
 *
 * Shared by the store logo and award images because they are the same problem;
 * the roadmap said to do them once, and this is the once.
 */
export function ImageField({
  api,
  label,
  value,
  onChange,
  hint,
}: {
  api: ApiClient;
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const { url } = await api.uploadImage(file);
      onChange(url);
    } catch (err) {
      // The API's messages here are written to be read by an operator — "…is
      // not an accepted image type (allowed: …)", "image must be under 2 MB" —
      // so pass them through rather than replacing them with "Upload failed".
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      // Clear the picker so choosing the SAME file again still fires a change.
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Field label={label}>
      <div className="flex items-start gap-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink/15 bg-brand-4">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span aria-hidden className="text-2xl text-ink/40">
              🖼️
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… or upload"
            spellCheck={false}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              className="shrink-0"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
            </Button>
            {value && (
              <Button variant="ghost" className="shrink-0" disabled={busy} onClick={() => onChange("")}>
                Clear
              </Button>
            )}
          </div>
          {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <Alert message={error} />
    </Field>
  );
}
