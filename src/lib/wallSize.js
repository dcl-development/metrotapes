/** Wall boards follow the real viewport: HTML lays out at window size, 3D frame matches that aspect. */

export const WALL_BEZEL = 0.036
export const WALL_TITLE_H = 0.12
/** Bench backrest top in world meters (seat 0.42 + armrest overlap + back 0.19). */
export const BENCH_BACK_TOP = 0.68
/** Keep the chrome lip a few inches above the benches. */
export const BOARD_BENCH_GAP = 0.3
export const BOARD_Y_PREFERRED = 1.72

export function layoutWallFace(cssW, cssH) {
  const panelW = Math.max(320, Math.round(cssW || 1100))
  const panelH = Math.max(240, Math.round(cssH || 700))
  const aspect = panelW / panelH

  let contentH = aspect < 0.95 ? 1.2 : 0.91
  let contentW = contentH * aspect
  if (contentW > 1.62) {
    contentW = 1.62
    contentH = contentW / aspect
  }
  if (contentH > 1.52) {
    contentH = 1.52
    contentW = contentH * aspect
  }
  if (contentW < 0.55) {
    contentW = 0.55
    contentH = contentW / aspect
  }

  const titleH = WALL_TITLE_H
  const boardW = contentW
  const boardH = contentH + titleH
  const lip = WALL_BEZEL
  const minCenter = BENCH_BACK_TOP + BOARD_BENCH_GAP + (boardH + lip) / 2
  const boardY = Math.max(BOARD_Y_PREFERRED, minCenter)
  const contentY = -titleH / 2
  return {
    panelW,
    panelH,
    boardW,
    boardH,
    boardY,
    contentW,
    contentH,
    titleH,
    pitch: contentW + 0.34,
    contentY,
    titleY: boardH / 2 - titleH / 2,
  }
}

let live = layoutWallFace(1100, 700)

export function getWallFace() {
  return live
}

export function setWallFace(next) {
  live = next
  return live
}
