import { useEffect, useState, useRef } from 'react'
import styled from 'styled-components'
import { fetchPosts } from '../lib/contentApi'
import { urlFor } from '../lib/sanity'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'

const Container = styled.div`
  padding: 2rem;
  color: white;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 768px) {
    padding: 1.5rem;
  }
`

const ArticleContainer = styled.div`
  ${frostedPanel}
  ${frostedPanelShadow}
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 3rem;

  &:last-child {
    margin-bottom: 0;
  }
`

const ArticleTitle = styled.h2`
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.8rem;
  margin-bottom: 1rem;
  color: white;
  letter-spacing: -0.02em;

  @media (min-width: 768px) {
    font-size: 2.2rem;
  }
`

const ArticleDescription = styled.div`
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.1rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`

const MediaGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  max-width: 1000px;
  margin: 0 auto;
`

const MediaItem = styled.div`
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: rgba(0, 0, 0, 0.2);
  
  img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
  }
  
  iframe {
    width: 100%;
    aspect-ratio: 16/9;
    border: none;
  }
  
  a {
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    color: inherit;
    background: rgba(255, 255, 255, 0.1);
    min-height: 200px;
    padding: 1rem;
    cursor: pointer;
    transition: transform 0.2s ease, background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: scale(1.05);
    }

    &:active {
      transform: scale(1);
    }
  }
`

const InstagramEmbed = styled.div`
  width: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;

  iframe {
    width: 100%;
    min-height: 450px;
    border: none;
    margin: 0;
    padding: 0;
    aspect-ratio: auto;
  }
`

function extractYouTubeId(url) {
  if (!url) return null
  try {
    const urlObj = new URL(url)

    // Handle youtu.be format
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1)
    }

    // Handle youtube.com format
    if (urlObj.hostname === 'youtube.com' || urlObj.hostname === 'www.youtube.com') {
      const searchParams = new URLSearchParams(urlObj.search)
      return searchParams.get('v')
    }

    return null
  } catch {
    return null
  }
}

function loadInstagramEmbed() {
  if (window.instgrm) {
    window.instgrm.Embeds.process()
    return
  }

  if (document.querySelector('script[src*="instagram.com/embed.js"]')) return

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://www.instagram.com/embed.js'
  document.body.appendChild(script)
}

function getInstagramUrl(url) {
  try {
    const urlObj = new URL(url)
    const postId = urlObj.pathname.split('/')[2]
    return `https://www.instagram.com/p/${postId}/embed`
  } catch {
    return url
  }
}

function renderMediaItem(item) {
  let videoId;
  let embedUrl;

  switch (item.type) {
    case 'image':
      return (
        <img
          src={urlFor(item.image).width(600).url()}
          alt={item.alt || 'Media item'}
        />
      )
    case 'link':
      return (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.alt || 'Visit Link'}
        </a>
      )
    case 'youtube':
      videoId = extractYouTubeId(item.videoUrl)
      if (!videoId) return null
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={item.alt || 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )
    case 'instagram':
      embedUrl = getInstagramUrl(item.instagramPost)
      return (
        <InstagramEmbed>
          <iframe
            src={embedUrl}
            frameBorder="0"
            scrolling="no"
            allow="encrypted-media"
            style={{ background: 'transparent' }}
          />
        </InstagramEmbed>
      )
    default:
      return null
  }
}

export default function Blog() {
  const [posts, setPosts] = useState([])
  const postsRef = useRef([])

  useEffect(() => {
    fetchPosts()
      .then(data => {
        setPosts(data)
        postsRef.current = data
      })
      .catch(console.error)
  }, [])

  // Reload Instagram embeds when posts change
  useEffect(() => {
    if (posts.length > 0) {
      loadInstagramEmbed()
    }
  }, [posts])

  if (!posts.length) return null

  return (
    <Container>
      {posts.map((post, index) => (
        <ArticleContainer key={index}>
          <ArticleTitle>{post.title}</ArticleTitle>
          <ArticleDescription>{post.description}</ArticleDescription>
          <MediaGrid>
            {post.media?.map((item, mediaIndex) => (
              <MediaItem key={mediaIndex}>
                {renderMediaItem(item)}
              </MediaItem>
            ))}
          </MediaGrid>
        </ArticleContainer>
      ))}
    </Container>
  )
} 