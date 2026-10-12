import * as THREE from 'three'

const SRC = '/mta-logo.jpg'
let pending = null

function cacheImage(image) {
  THREE.Cache.enabled = true
  const keys = [`image:${SRC}`]
  if (typeof window !== 'undefined' && window.location?.href) {
    keys.push(`image:${new URL(SRC, window.location.href).href}`)
  }
  keys.forEach((key) => THREE.Cache.add(key, image))
}

/**
 * One network read of the MTA plate. The decoded image is stored in
 * THREE.Cache under ImageLoader's key so the kiosk texture does not
 * fetch again, and the zap screen uses the same blob URL.
 */
export function primeMtaPlate() {
  if (!pending) {
    pending = fetch(SRC)
      .then((res) => {
        if (!res.ok) throw new Error(`mta plate ${res.status}`)
        return res.blob()
      })
      .then((blob) => new Promise((resolve, reject) => {
        const blobUrl = URL.createObjectURL(blob)
        const image = new Image()
        image.onload = () => {
          cacheImage(image)
          resolve({ href: SRC, blobUrl })
        }
        image.onerror = () => reject(new Error('mta plate decode'))
        image.src = blobUrl
      }))
      .catch((err) => {
        pending = null
        throw err
      })
  }
  return pending
}

export function resetMtaPlateForTests() {
  pending = null
  THREE.Cache.remove(`image:${SRC}`)
}
