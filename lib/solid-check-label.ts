// How the Solid debug panel prints a yes/no geometry check.
//
// Three states, not two. A check nobody measured is null (or undefined), and it
// must read NOT MEASURED in grey. Before 2026-10-24 the panel used
// `v ? "YES - BAD" : "NO"`, so five checks that were never computed showed a
// green NO on every build. Gate: scripts/verify/assert-solid-check-truth.mjs.

export type SolidCheckTone = "bad" | "good" | "unmeasured"

export function solidCheckLabel(value: boolean | null | undefined): { text: string; tone: SolidCheckTone } {
  if (value === true) return { text: "YES - BAD", tone: "bad" }
  if (value === false) return { text: "NO", tone: "good" }
  return { text: "NOT MEASURED", tone: "unmeasured" }
}

export const SOLID_CHECK_CLASS: Record<SolidCheckTone, string> = {
  bad: "text-red-400 font-bold",
  good: "text-green-400",
  unmeasured: "text-gray-500",
}
