/**
 * One DVD-style step for a line bullet.
 * A hidden CSS3D screen reports 0×0 (display:none until the kiosk is on
 * screen). Reflecting off that box every frame multiplies velocity by -0.92
 * and pins every bullet to the origin. Skip the step until the LCD has a
 * real box so the same speed is still there when the screen appears.
 */
export function stepLineBullet(bullet, { width, height, size }, speed) {
  const maxX = width - size
  const maxY = height - size
  if (!(maxX > 0) || !(maxY > 0)) return bulletCopy(bullet)

  let { x, y, vx, vy } = bullet
  x += vx * speed
  y += vy * speed

  if (x <= 0 || x >= maxX) {
    vx = -vx * 0.92
    x = x <= 0 ? 0 : maxX
  }
  if (y <= 0 || y >= maxY) {
    vy = -vy * 0.92
    y = y <= 0 ? 0 : maxY
  }

  return { x, y, vx, vy }
}

function bulletCopy(bullet) {
  return { x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy }
}
