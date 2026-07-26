// CALCULATIONS layer: reading and writing a duration setting in the unit an
// operator actually thinks in.
//
// The problem this solves is small and entirely presentational. `claim_ttl_hours`
// is seeded as `168` and described as "Hours a won prize stays claimable" — so
// an operator who wants "one week" has to know that is 168, and one who reads
// 168 has to divide. Nobody reasons about prize expiry in hours, or about
// session timeouts in seconds; they reason in days and minutes.
//
// Two things are deliberately NOT changed:
//
//   - **The stored value.** `claim_ttl_hours` keeps storing hours and
//     `session_ttl_seconds` keeps storing seconds. The unit is part of the key's
//     name and of the wire contract the backend reads (`app.Service.settingInt`,
//     `claim.TTL`), and an operator who set a value in a previous version must
//     not silently get a different policy because the admin started reading the
//     number differently.
//   - **The set of settings.** This is a lookup keyed by the settings that
//     already exist. An unknown key has no spec and falls back to the plain
//     integer box, which is what every other setting still uses.
//
// Everything here is pure: same value in, same amount and unit out. That is what
// makes the rounding rule testable instead of buried in a form's onChange.

/** A unit a duration can be expressed in. */
export type DurationUnit = "seconds" | "minutes" | "hours" | "days";

/** How many seconds each unit is worth. The one conversion table. */
const SECONDS: Record<DurationUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

/** Singular/plural labels, for a control that says "1 day" rather than "1 days". */
export function unitLabel(unit: DurationUnit, amount: number): string {
  return Math.abs(amount) === 1 ? unit.slice(0, -1) : unit;
}

/**
 * A duration setting: what unit its stored integer is in, and which units the
 * operator may enter it in.
 *
 * `units` is ordered finest-first. `fromBase` walks it backwards, so the
 * COARSEST unit that divides the stored value evenly is the one shown — 168
 * reads as 7 days, 36 stays 36 hours rather than becoming 1.5 of anything.
 */
export interface DurationSpec {
  /** The unit the stored integer is in. Never changes — it is in the key's name. */
  base: DurationUnit;
  /** Units offered, finest first. Must include `base`. */
  units: readonly DurationUnit[];
}

/**
 * The duration settings this admin knows about, keyed exactly as the backend
 * stores them (see `defaultSettings` in backend/internal/app/seed.go).
 *
 * The offered units are chosen for the range each knob is actually set in, not
 * for completeness: a claim window is days or hours, and offering seconds would
 * be a way to set a prize that expires before the player reaches the counter. A
 * session TTL is the opposite — it is tens of seconds to a few minutes, and
 * days would be a typo waiting to happen.
 */
export const DURATION_SETTINGS: Record<string, DurationSpec> = {
  claim_ttl_hours: { base: "hours", units: ["hours", "days"] },
  session_ttl_seconds: { base: "seconds", units: ["seconds", "minutes"] },
};

/** The spec for a setting key, or null when it is not a duration. */
export function durationSpecFor(key: string): DurationSpec | null {
  return DURATION_SETTINGS[key] ?? null;
}

/** A duration as the operator sees it: a number and the unit it is counted in. */
export interface DurationValue {
  amount: number;
  unit: DurationUnit;
}

/**
 * Converts an amount in `unit` into the setting's stored base unit.
 *
 * Rounds, because the result is written to an integer setting and a fractional
 * hour is not something the backend can store. Rounding rather than truncating
 * so "30 minutes" of a seconds-based setting is 1800 and not 1799 — though with
 * the units offered above, every combination divides exactly.
 */
export function toBase(value: DurationValue, spec: DurationSpec): number {
  const seconds = value.amount * SECONDS[value.unit];
  return Math.round(seconds / SECONDS[spec.base]);
}

/**
 * Reads a stored base-unit value back into the coarsest unit that expresses it
 * WITHOUT a remainder.
 *
 * The no-remainder rule is the whole design. It is what lets 168 read as "7
 * days" while 36 stays "36 hours" instead of "1.5 days": an operator never sees
 * a fraction, and no value is ever rounded away behind their back on a form
 * they did not intend to change.
 *
 * Zero is returned in the BASE unit. Every unit divides zero evenly, so the
 * coarsest-wins rule would otherwise render "0 days" — and zero does not mean a
 * length at all here: for `claim_ttl_hours` it means "claims never expire", so
 * dressing it up in a unit implies a duration that was chosen.
 */
export function fromBase(stored: number, spec: DurationSpec): DurationValue {
  if (!Number.isFinite(stored) || stored === 0) return { amount: 0, unit: spec.base };

  const seconds = stored * SECONDS[spec.base];
  for (let i = spec.units.length - 1; i >= 0; i--) {
    const unit = spec.units[i];
    if (seconds % SECONDS[unit] === 0) return { amount: seconds / SECONDS[unit], unit };
  }
  return { amount: stored, unit: spec.base };
}

/**
 * Parses a stored setting string into an amount and unit, or null when the
 * value is not a whole number.
 *
 * Null is the signal to fall back to the raw text box. A settings table is
 * hand-editable and a value like `"abc"` or `"1.5"` should be visible and
 * fixable rather than silently coerced to something else — the same reasoning
 * as `groupClaimCode` returning a wrong-length code untouched.
 */
export function parseDuration(value: string, spec: DurationSpec): DurationValue | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const stored = Number(trimmed);
  if (!Number.isSafeInteger(stored) || stored < 0) return null;
  return fromBase(stored, spec);
}

/** Serialises an amount and unit back to the string a setting stores. */
export function formatDuration(value: DurationValue, spec: DurationSpec): string {
  return String(toBase(value, spec));
}

/**
 * The stored value in words — "168 hours" — for the line under the control.
 *
 * Worth showing even though the operator is editing days: the KEY says hours,
 * the backend reads hours, and someone comparing this screen to a database row
 * or a log line needs the number that is actually stored. It is also how the
 * control stays honest about a value it has quietly converted.
 */
export function describeStored(value: DurationValue, spec: DurationSpec): string {
  const stored = toBase(value, spec);
  return `${stored} ${unitLabel(spec.base, stored)}`;
}
