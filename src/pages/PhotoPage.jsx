import { useEffect, useMemo, useState } from 'react'
import { fetchPhotos } from '../lib/contentApi'
import { imageAlt } from '../lib/sanity'
import { imageUrl, photoSources } from '../lib/sanityImage'
import styled from 'styled-components'
import Filmstrip from '../components/filmstrip'
import FrostNote from '../components/FrostNote'
import { font } from '../styles/theme'

const Panel = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Visible so the strip's own preserve-3d context is not clipped to a
     smaller box. The wall frame still clips to the page. No opacity,
     filter, transform, or isolation here — those flatten the curl. */
  overflow: visible;
  background: #0a0908;
  color: #fff;
  box-sizing: border-box;
  pointer-events: auto;
  font-family: ${font};
`

const NoteHold = styled.div`
  isolation: isolate;
  width: 100%;
`

function filmFrame(photo) {
  const sources = photoSources(photo)
  if (!sources.src) return null
  const native = Number(photo?.width) || sources.width || 0
  const hi = Math.min(1600, native || sources.width || 0)
  const sharp = hi > 0 ? imageUrl(photo, { width: hi }) : ''
  const caption = typeof photo?.caption === 'string' ? photo.caption.trim() : ''
  return {
    src: sources.src,
    src2x: sharp && sharp !== sources.src ? sharp : undefined,
    srcSet: sources.srcSet || undefined,
    alt: imageAlt(photo, 'Photograph by Ronnie Foreman'),
    width: sources.width,
    height: sources.height,
    aspect: sources.width && sources.height ? sources.width / sources.height : undefined,
    caption: caption || undefined,
  }
}

export default function PhotoPage({ active = true }) {
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let alive = true
    fetchPhotos().then((data) => {
      if (!alive) return
      if (data?.length) {
        setPhotos(data)
        setStatus('ready')
      } else {
        setStatus('empty')
      }
    }).catch(() => {
      if (alive) setStatus('error')
    })
    return () => { alive = false }
  }, [])

  const images = useMemo(
    () => photos.map(filmFrame).filter(Boolean),
    [photos],
  )

  const ready = status === 'ready' && images.length > 0
  // The projected wall is a CSS3DObject: its matrix3d transform flattens
  // descendant preserve-3d, so the curl cannot draw there. Flat is that
  // fallback only. Once the camera is on this page the overlay transform
  // is cleared and mode stays auto (compact tier, reduced motion, and the
  // missing-3D fallback all stay inside the strip).
  const mode = active ? 'auto' : 'flat'

  return (
    <Panel>
      {status === 'loading' && (
        <NoteHold><FrostNote>Loading photos…</FrostNote></NoteHold>
      )}
      {(status === 'empty' || (status === 'ready' && !images.length)) && (
        <NoteHold><FrostNote>No photos yet.</FrostNote></NoteHold>
      )}
      {status === 'error' && (
        <NoteHold><FrostNote>Could not load photos.</FrostNote></NoteHold>
      )}
      {ready ? (
        <Filmstrip
          images={images}
          active={active}
          mode={mode}
          ariaLabel="Photographs"
        />
      ) : null}
    </Panel>
  )
}
