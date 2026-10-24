/**
 * VERSIONED LOCAL STORAGE — the envelope, the migration, and the quarantine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * Free Stroke persisted two things to `localStorage` — the drawing
 * (`freestroke.strokes.v1`) and the user's own fusions (`freestroke.fusions.v1`)
 * — and BOTH carried their version only in the KEY NAME. The payload itself was
 * a bare JSON array. That has two failure modes and this project has already
 * been bitten by the second one:
 *
 *   1. BUMP THE KEY and every existing user's work is orphaned in place. It is
 *      still on disk, it is never read again, and nothing tells anyone.
 *   2. FORGET TO BUMP THE KEY — which is the default, because nothing enforces
 *      it — and a payload written by a DIFFERENT shape is restored as if it
 *      were current. `lib/style-fusion.ts:786` documents where that lands: a
 *      link out of an older or hand-edited blob resolves `src[link.source]` to
 *      `undefined`, `undefined * a` is `NaN`, the `v === 0` guard does not stop
 *      it because `NaN === 0` is false, and `f.ditherScaleMul *= NaN` poisons a
 *      MULTIPLICATIVE accumulator — so ONE bad link voids every other link the
 *      user authored against that parameter. Measured: six of eight malformed
 *      shapes produced a non-finite frame.
 *
 * The consumer-side guard for that now exists. This file is the other half: the
 * STORAGE boundary, where the bad blob should have been stopped in the first
 * place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SHAPE, AND WHERE IT COMES FROM
 *
 * `dialkit` — already a dependency of this repo, and the toolkit the hero
 * beat's transport rides — does exactly this and does it in six lines
 * (`node_modules/dialkit/dist/index.js:464`):
 *
 *     const parsed = JSON.parse(raw);
 *     if (parsed?.version !== 1 || typeof parsed !== "object") return null;
 *
 * …paired with a writer at `:478` that stamps `version: 1` into the payload.
 * That is the whole idea: the version travels WITH the data, and a payload that
 * does not say what it is does not get used. This file is that pattern with the
 * three things dialkit's version does not need and ours does — a migration
 * path, a KIND tag, and a quarantine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR THINGS A READ CAN FIND, AND WHY EACH IS HANDLED DIFFERENTLY
 *
 *   CORRUPT   Unparseable, or parses to something that is not an envelope and
 *             is not a recognised legacy shape. Nothing can be recovered from
 *             it programmatically — but it is still the user's bytes, so it is
 *             QUARANTINED, never deleted (§0.7: never delete, verify).
 *
 *   FOREIGN   A well-formed envelope whose `kind` is not ours. This is the case
 *             the key-name-only scheme could not even express: two features
 *             pointed at one key, or a key reused across apps on the same
 *             origin. Restoring it would be restoring someone else's data into
 *             our state. Quarantined.
 *
 *   FUTURE    `v` is HIGHER than this build understands — the user ran a newer
 *             build and then downgraded (a stale tab, a rollback, a cached
 *             bundle). We CANNOT read it, and the tempting move — read it
 *             anyway and hope the extra fields are ignored — is precisely the
 *             coercion that produced the NaN above.
 *
 *             But refusing to read it is not enough on its own, and this is the
 *             subtle one: the app WRITES this key on every change, so a refusal
 *             that leaves the blob in place would have the very next autosave
 *             stomp the newer work we just declined to read. So a future
 *             payload is MOVED to the quarantine key first. It survives, it is
 *             recoverable by hand, and the session is not bricked.
 *
 *   OLDER     `v` is lower. This is the only one that is not an error: the
 *             registered migrations run in sequence from the stored version up
 *             to the current one, and the result is validated exactly like a
 *             current payload before it is handed back. A missing migration
 *             step is treated as corrupt rather than as "close enough".
 *
 * A fifth case, LEGACY, is what is actually on disk today: a bare array with no
 * envelope at all. It is read as version 0 so the two live keys migrate rather
 * than orphan. This is not a hypothetical migration written to look thorough —
 * it is the one that has to run on every machine that has ever opened this app.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUARANTINE, NOT DELETE
 *
 * Every rejection path moves the offending bytes to `<key>.quarantine` together
 * with the reason and a timestamp. Deleting it would be the tidy answer and it
 * is the wrong one: the blob is the only remaining copy of something the user
 * made, and "the app decided your file was bad and threw it away" is not a
 * behaviour anyone pays for. One slot, overwritten by the next rejection — the
 * alternative is unbounded key growth in a 5 MB budget.
 */

/** How a read ended. Every one of these is reported, never swallowed. */
export type ReadOutcome =
  /** Envelope present, version current, payload validated. */
  | "ok"
  /** Older envelope (or a pre-envelope legacy blob) migrated up and validated. */
  | "migrated"
  /** Nothing stored under this key. Not an error — a first run. */
  | "empty"
  /** Unparseable, or a shape no reader recognises. Quarantined. */
  | "corrupt"
  /** A valid envelope belonging to something else. Quarantined. */
  | "foreign"
  /** Written by a newer build than this one. Quarantined so it survives. */
  | "future"
  /** Parsed and versioned correctly, but the payload failed its own validator. */
  | "invalid"
  /** No storage at all — SSR, private mode, or a blocked origin. */
  | "unavailable"

export interface ReadResult<T> {
  outcome: ReadOutcome
  /** The usable payload, or null on every non-`ok`/`migrated` outcome. */
  data: T | null
  /** The version actually found on disk (0 for a legacy bare payload). */
  foundVersion: number | null
  /** Human-readable, for a console line or a toast. Never empty. */
  note: string
  /** Set when bytes were moved aside; the key they were moved to. */
  quarantinedTo?: string
  /**
   * Non-fatal repairs the validator made, e.g. "3 points had no timestamp".
   * A repair the user is never told about is indistinguishable from a bug.
   */
  repairs: string[]
}

/** The on-disk wrapper. Short field names: this shares a 5 MB origin budget
 *  with a drawing that can run to hundreds of kilobytes. */
export interface Envelope<T> {
  /** Schema version of `data`. */
  v: number
  /** WHAT this is. Guards against two features sharing a key, or a key
   *  colliding with another app on the same origin. */
  kind: string
  data: T
  /** Epoch ms of the write. Diagnostic only — never used for ordering. */
  at: number
}

/**
 * One migration step: takes the payload AS IT WAS at `from` and returns it in
 * the shape of `from + 1`. Steps are composed, so adding v3 later means writing
 * exactly one function and never revisiting the v1→v2 step.
 *
 * Returning `null` means "this cannot be carried forward" and is treated as
 * corrupt — an honest refusal beats a silent half-migration.
 */
export type Migration = (data: unknown) => unknown | null

export interface SchemaSpec<T> {
  key: string
  kind: string
  /** The version THIS build writes. */
  version: number
  /** Keyed by the version being migrated FROM. `0` is the pre-envelope shape. */
  migrations?: Record<number, Migration>
  /**
   * Validates a payload already known to be at the current version. Returns
   * the value to use (which may be a repaired copy) plus any repairs made, or
   * `null` to reject. THIS is where points get checked, not just containers.
   */
  validate: (data: unknown) => { value: T; repairs: string[] } | null
}

/* -------------------------------------------------------------------------- */
/*  Storage access                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `localStorage` or null.
 *
 * ⚠ THE PROBE MUST NOT WRITE, AND THE ASSERTION CAUGHT THIS. The first version
 * did `setItem("__fs_probe__", "1")` to prove storage worked. On a FULL disk
 * that probe is the thing that throws — so `storage()` returned null, and a
 * write that should have reported `quota` reported `unavailable` instead. The
 * two mean completely different things to a user: "this browser will not
 * persist anything" versus "your drawing has outgrown the 5 MB budget, export
 * it". The app was about to give the wrong one, at the exact moment it mattered.
 *
 * So availability is decided by ACCESS and a READ, neither of which consumes
 * quota. Accessing `window.localStorage` genuinely can throw — Safari with
 * cookies blocked, a partitioned third-party origin — and that is the case this
 * needs to catch. Whether a write will FIT is not an availability question, and
 * it is answered where the write happens.
 */
function storage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    const s = window.localStorage
    /* A read, not a write: proves the object is usable without spending a byte. */
    s.getItem("__fs_probe__")
    return s
  } catch {
    return null
  }
}

export const quarantineKey = (key: string) => `${key}.quarantine`

/**
 * Move bytes aside. Returns the key they landed under, or undefined if even
 * that failed (a full quota) — in which case the read still refuses, which is
 * the safe half of the answer.
 */
function quarantine(key: string, raw: string, reason: string): string | undefined {
  const s = storage()
  if (!s) return undefined
  const qk = quarantineKey(key)
  try {
    /* COUNT THE REPEATS. Chromium does the same thing for a corrupt preferences
     * file — `BackupPrefsFile()` renames it aside rather than deleting it — and
     * it distinguishes the FIRST corruption from a repeat, because they mean
     * different things: one bad blob is bad luck, a second one means the WRITER
     * is broken and the next save will corrupt the replacement too. A count is
     * the cheapest way to be able to tell, and a bug report that says "this has
     * happened four times" is a different bug report.
     *
     * The earlier blob's bytes are overwritten by the newer one on purpose: one
     * slot, because this shares a 5 MB origin budget with a drawing. */
    let priorCount = 0
    try {
      const prev = s.getItem(qk)
      if (prev) priorCount = Number(JSON.parse(prev)?.count) || 1
    } catch {
      priorCount = 1
    }
    s.setItem(qk, JSON.stringify({ reason, at: Date.now(), count: priorCount + 1, raw }))
    return qk
  } catch {
    /* Quota, most likely because `raw` is large. The bytes stay where they are
     * unless the caller is about to overwrite them; `readVersioned` only calls
     * this on paths where refusing to read is itself protective. */
    return undefined
  }
}

function isEnvelope(x: unknown): x is Envelope<unknown> {
  return (
    !!x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    typeof (x as Envelope<unknown>).v === "number" &&
    Number.isFinite((x as Envelope<unknown>).v) &&
    typeof (x as Envelope<unknown>).kind === "string" &&
    "data" in (x as object)
  )
}

/* -------------------------------------------------------------------------- */
/*  Read                                                                      */
/* -------------------------------------------------------------------------- */

export function readVersioned<T>(spec: SchemaSpec<T>): ReadResult<T> {
  const s = storage()
  if (!s) {
    return {
      outcome: "unavailable",
      data: null,
      foundVersion: null,
      note: "no localStorage on this origin. The session works, it just will not persist",
      repairs: [],
    }
  }

  let raw: string | null
  try {
    raw = s.getItem(spec.key)
  } catch {
    return { outcome: "unavailable", data: null, foundVersion: null, note: "storage read threw", repairs: [] }
  }
  if (raw === null || raw === "") {
    return { outcome: "empty", data: null, foundVersion: null, note: "nothing stored yet", repairs: [] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const to = quarantine(spec.key, raw, "unparseable JSON")
    return {
      outcome: "corrupt",
      data: null,
      foundVersion: null,
      note: "stored value is not JSON. Kept aside, not deleted",
      quarantinedTo: to,
      repairs: [],
    }
  }

  let version: number
  let payload: unknown

  if (isEnvelope(parsed)) {
    if (parsed.kind !== spec.kind) {
      const to = quarantine(spec.key, raw, `foreign kind "${parsed.kind}", expected "${spec.kind}"`)
      return {
        outcome: "foreign",
        data: null,
        foundVersion: parsed.v,
        note: `this key holds "${parsed.kind}", not "${spec.kind}", kept aside, not restored`,
        quarantinedTo: to,
        repairs: [],
      }
    }
    if (parsed.v > spec.version) {
      /* MOVED, not left in place. The writer autosaves this key on the next
       * state change, so leaving a newer payload here would mean overwriting
       * work we had just refused to read — the read would be safe and the
       * session would still destroy it. */
      const to = quarantine(spec.key, raw, `written by a newer build (v${parsed.v} > v${spec.version})`)
      return {
        outcome: "future",
        data: null,
        foundVersion: parsed.v,
        note: `saved by a newer version of Free Stroke (v${parsed.v}); this build reads v${spec.version}. Kept aside so it is not overwritten.`,
        quarantinedTo: to,
        repairs: [],
      }
    }
    version = parsed.v
    payload = parsed.data
  } else {
    /* LEGACY: a bare pre-envelope payload. This is what is on disk right now
     * for both live keys, so version 0 is a real migration source and not a
     * courtesy. A `0` migration must be registered or this is corrupt. */
    version = 0
    payload = parsed
  }

  const startVersion = version
  if (version < spec.version) {
    const steps = spec.migrations ?? {}
    while (version < spec.version) {
      const step = steps[version]
      if (!step) {
        const to = quarantine(spec.key, raw, `no migration registered from v${version}`)
        return {
          outcome: "corrupt",
          data: null,
          foundVersion: startVersion,
          note: `stored at v${version} with no way to bring it forward to v${spec.version}, kept aside, not deleted`,
          quarantinedTo: to,
          repairs: [],
        }
      }
      let next: unknown
      try {
        next = step(payload)
      } catch {
        next = null
      }
      if (next === null || next === undefined) {
        const to = quarantine(spec.key, raw, `migration v${version} -> v${version + 1} refused the payload`)
        return {
          outcome: "corrupt",
          data: null,
          foundVersion: startVersion,
          note: `could not migrate v${version} to v${version + 1}, kept aside, not deleted`,
          quarantinedTo: to,
          repairs: [],
        }
      }
      payload = next
      version += 1
    }
  }

  const checked = spec.validate(payload)
  if (!checked) {
    const to = quarantine(spec.key, raw, "failed validation after migration")
    return {
      outcome: "invalid",
      data: null,
      foundVersion: startVersion,
      note: "stored payload did not survive validation. Kept aside, not deleted",
      quarantinedTo: to,
      repairs: [],
    }
  }

  return {
    outcome: startVersion < spec.version ? "migrated" : "ok",
    data: checked.value,
    foundVersion: startVersion,
    note:
      startVersion < spec.version
        ? `migrated v${startVersion} -> v${spec.version}`
        : `read v${spec.version}`,
    repairs: checked.repairs,
  }
}

/* -------------------------------------------------------------------------- */
/*  Write                                                                     */
/* -------------------------------------------------------------------------- */

export type WriteOutcome = "ok" | "unavailable" | "quota"

export function writeVersioned<T>(spec: SchemaSpec<T>, data: T): WriteOutcome {
  const s = storage()
  if (!s) return "unavailable"
  const env: Envelope<T> = { v: spec.version, kind: spec.kind, data, at: Date.now() }
  try {
    s.setItem(spec.key, JSON.stringify(env))
    return "ok"
  } catch {
    /* Quota. A very long drawing simply is not persisted; the session is
     * unaffected. Reported rather than swallowed so the caller can say so. */
    return "quota"
  }
}

/** Read a quarantined blob back, for a "restore what was set aside" path.
 *  `count` is how many times this key has been quarantined — see `quarantine`. */
export function readQuarantine(
  key: string,
): { reason: string; at: number; count: number; raw: string } | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(quarantineKey(key))
    if (!raw) return null
    const p = JSON.parse(raw)
    if (!p || typeof p !== "object" || typeof p.raw !== "string") return null
    return {
      reason: String(p.reason ?? "unknown"),
      at: Number(p.at) || 0,
      count: Number(p.count) || 1,
      raw: p.raw,
    }
  } catch {
    return null
  }
}
