import type { IconName } from "@minigames/icons";
import { Icon } from "./Icon";

/**
 * A prize's picture, in a box that is the same size whether or not there is one.
 *
 * Every place a prize appears — the showcase before playing, the card after
 * winning — needs the same three decisions, which is why they live here once:
 *
 * - **Fixed box.** The height and width never depend on the image, so a prize
 *   with no picture leaves the layout identical to one with a picture. An admin
 *   filling in `imageUrl` later must not reflow the screen.
 * - **`alt=""`.** The prize name is always rendered next to this, so a screen
 *   reader announcing the file as well would just say the name twice. The image
 *   is decoration on top of text that already carries the meaning.
 * - **Icon fallback**, never an empty box or a broken-image glyph.
 *
 * `muted` is for a prize that can no longer be collected (a redeemed or expired
 * claim): the photo stays — it is still what was won — but stops competing with
 * the live parts of the screen.
 */
export function PrizeImage({
  src,
  fallback,
  size = "sm",
  muted = false,
  className = "",
}: {
  /** The admin-set URL. Empty or absent renders `fallback`. */
  src?: string;
  /** Icon shown when there is no image. */
  fallback: IconName;
  /** `sm` for list rows, `lg` for the one prize a screen is about. */
  size?: "sm" | "lg";
  muted?: boolean;
  className?: string;
}) {
  const box =
    size === "lg" ? "h-20 w-20 rounded-xl text-4xl" : "h-9 w-9 rounded-lg text-lg";

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden bg-brand-4 ${box} ${
        muted ? "opacity-60 grayscale" : ""
      } ${className}`}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name={fallback} className="text-ink/40" />
      )}
    </span>
  );
}
