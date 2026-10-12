import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { ABOUT_QUERY, client, imageAlt } from '../lib/sanity'
import { imageSrcSet, imageUrl } from '../lib/sanityImage'
import { PortableText } from '@portabletext/react'
import FrostNote from '../components/FrostNote'
import StationPlate from '../components/StationPlate'
import { font, route, signage } from '../styles/theme'

const BROWN = route.about

const Container = styled.div`
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  isolation: isolate;
  background:
    linear-gradient(#121214, #121214) 0 0 / 100% 8px no-repeat,
    linear-gradient(${BROWN}, ${BROWN}) 0 8px / 100% 6px no-repeat,
    linear-gradient(#121214, #121214) 0 14px / 100% 8px no-repeat,
    #0c0e10;
  padding: 28px 14px 28px;
  box-sizing: border-box;
  color: #fff;
  pointer-events: auto;
  -webkit-overflow-scrolling: touch;
  font-family: ${font};
`

const Shell = styled.div`
  max-width: 780px;
  margin: 0 auto;
`

const Title = styled.h2`
  margin: 0 0 1.15rem;
  font-family: ${signage};
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
  text-transform: uppercase;
`

const Top = styled.div`
  display: flex;
  gap: 1.75rem;
  align-items: start;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 1.15rem;
  }
`

const Portrait = styled.div`
  flex: 0 0 240px;
  max-width: 100%;

  img {
    width: 100%;
    height: auto;
    display: block;
    outline: 4px solid ${BROWN};
  }

  @media (max-width: 640px) {
    flex-basis: auto;
    width: min(100%, 280px);
  }
`

const Copy = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 1rem;
  line-height: 1.55;
  letter-spacing: -0.02em;
  color: rgba(255, 255, 255, 0.88);

  p {
    margin: 0 0 0.9rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  strong {
    color: #fff;
    font-weight: 600;
  }

  em {
    font-style: italic;
  }

  a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }
`

const Instagram = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.15rem;
  color: ${BROWN};
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.02em;

  &:hover {
    color: #fff;
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
`

const Landscape = styled.div`
  margin-top: 1.75rem;

  img {
    width: 100%;
    height: auto;
    display: block;
  }
`

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" aria-hidden="true">
    <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
  </svg>
)

const portableTextComponents = {
  marks: {
    link: ({ children, value }) => {
      const href = value?.href || ''
      const rel = href.startsWith('/') ? undefined : 'noreferrer noopener'
      return (
        <a href={href} rel={rel} target={href.startsWith('/') ? undefined : '_blank'}>
          {children}
        </a>
      )
    },
  },
}

export default function AboutPage() {
  const [aboutContent, setAboutContent] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let alive = true
    client.fetch(ABOUT_QUERY).then((data) => {
      if (!alive) return
      if (data) {
        setAboutContent(data)
        setStatus('ready')
      } else {
        setStatus('empty')
      }
    }).catch((error) => {
      console.error('Error fetching about content:', error)
      if (alive) setStatus('error')
    })
    return () => { alive = false }
  }, [])

  const photo2 = aboutContent?.photo2
  const photo1 = aboutContent?.photo1

  return (
    <Container>
      <Shell>
        <StationPlate letter="A" title="About" color={BROWN} />
        {status === 'loading' && <FrostNote>Loading…</FrostNote>}
        {status === 'empty' && <FrostNote>No about info yet.</FrostNote>}
        {status === 'error' && <FrostNote>Could not load about info.</FrostNote>}
      </Shell>
      {status === 'ready' && aboutContent ? (
        <Shell>
          <Title>{aboutContent.title}</Title>
          <Top>
            {photo2 ? (
              <Portrait>
                <img
                  src={imageUrl(photo2, { width: 480 })}
                  srcSet={imageSrcSet(photo2, [320, 480, 720])}
                  sizes="(max-width: 640px) 280px, 240px"
                  width={photo2.width || 480}
                  height={photo2.height || 640}
                  alt={imageAlt(photo2, 'Portrait of Ronnie Foreman')}
                />
              </Portrait>
            ) : null}
            <Copy>
              {aboutContent.description ? (
                <PortableText
                  value={aboutContent.description}
                  components={portableTextComponents}
                />
              ) : null}
              {aboutContent.instagramUrl ? (
                <Instagram
                  href={aboutContent.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <InstagramIcon />
                  @metrotapes
                </Instagram>
              ) : null}
            </Copy>
          </Top>
          {photo1 ? (
            <Landscape>
              <img
                src={imageUrl(photo1, { width: 960 })}
                srcSet={imageSrcSet(photo1, [640, 960, 1400])}
                sizes="(max-width: 780px) 92vw, 780px"
                width={photo1.width || 1400}
                height={photo1.height || 900}
                alt={imageAlt(photo1, 'Photograph by Ronnie Foreman')}
              />
            </Landscape>
          ) : null}
        </Shell>
      ) : null}
    </Container>
  )
}
