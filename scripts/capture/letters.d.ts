/**
 * Types for the single-stroke capture font (`letters.mjs`).
 *
 * The font itself stays plain ESM because `capture-run.mjs` runs it under node
 * with no build step; this declaration lets the Next app import the same
 * layout function so the live tuner and the offline capture lay out text
 * identically rather than each having their own idea of the letterforms.
 */

export interface LayoutOptions {
  x?: number
  y?: number
  /** Cap height in font units. */
  size?: number
  /** Extra advance between glyphs, in font units. */
  tracking?: number
  /**
   * WRAP THE TEXT ONCE A LINE WOULD EXCEED THIS, in the same units `width` is
   * returned in. 0 or absent means no wrap, which is the shipped behaviour and
   * the path `"Desk Doodles"` still takes — see the byte-identity note on
   * `layoutWord` in `letters.mjs`.
   */
  maxWidth?: number
  /** Baseline-to-baseline distance as a multiple of `size`. Default 1.62. */
  lineGap?: number
}

export interface LayoutPoint {
  x: number
  y: number
}

export interface LayoutResult {
  /** One polyline per pen-down stroke, in font units. */
  polylines: LayoutPoint[][]
  /**
   * Which LETTER each polyline belongs to — parallel to `polylines`, so
   * `letterOf[i]` is the letter index of `polylines[i]`.
   *
   * Letters that draw no ink (spaces, unsupported characters) take no index, so
   * these are dense: 0..`letterCount`-1 with no gaps. That matters because
   * every per-letter stagger indexes into them.
   */
  letterOf: number[]
  /** How many letters actually drew. `"Desk Doodles"` is 11. */
  letterCount: number
  /** Total advance width of the laid-out text, in font units. Wrapped: the
   *  widest line. */
  width: number
  /** Total height of the block: `(lineCount - 1) * lineHeight + size`. */
  height: number
  /** How many lines the text wrapped onto. 1 unless `maxWidth` engaged. */
  lineCount: number
  /** Baseline-to-baseline distance, in font units. */
  lineHeight: number
}

export declare function layoutWord(text: string, opts?: LayoutOptions): LayoutResult
export declare function measureWord(text: string, opts?: LayoutOptions): number
/** Every character the font can draw; anything else advances as a space. */
export declare const SUPPORTED: string
/**
 * Map a character the font lacks onto one it has — accents onto their ASCII
 * base, typographic quotes onto the straight ones — or `null` when nothing
 * maps, which is the only case that still advances as blank space.
 */
export declare function fold(ch: string): string | null
