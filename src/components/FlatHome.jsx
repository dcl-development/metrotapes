import { useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import StationPlate from './StationPlate'
import { font, route, signage } from '../styles/theme'
import { hasWebGL } from '../lib/webglSupport'

const Page = styled.article`
  max-width: 36rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
  color: #fff;
  font-family: ${font};
`

const Lead = styled.p`
  margin: 0 0 0.75rem;
  line-height: 1.45;
  font-size: 1.05rem;
`

const Note = styled.p`
  margin: 0 0 1.35rem;
  color: rgba(255, 255, 255, 0.62);
  font-size: 0.92rem;
  line-height: 1.4;
`

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`

const Item = styled(Link)`
  display: flex;
  align-items: center;
  min-height: 56px;
  color: #fff;
  text-decoration: none;
  font-family: ${signage};
  font-weight: 700;
  font-size: 1.35rem;
  letter-spacing: -0.03em;
  text-transform: uppercase;
`

const Bullet = styled.span`
  width: 40px;
  height: 40px;
  margin-right: 0.85rem;
  border-radius: 50%;
  background: ${(p) => p.$color};
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font-size: 1rem;
  letter-spacing: -0.04em;
`

/** 2D way in when the station canvas cannot run, or when lite mode is on. */
export default function FlatHome() {
  const [webgl] = useState(() => hasWebGL())
  return (
    <Page>
      <StationPlate letter="M" title="metrotapes" color="#FCCC0A" ink="#111" />
      <Lead>
        Photography and video by Ronnie Foreman in the New York metropolitan area.
        Skate, snow, and other visual work.
      </Lead>
      <Note>
        {webgl
          ? 'Flat view. Choose full in the header for the station.'
          : 'The station view needs WebGL, which is not available right now.'}
      </Note>
      <Nav aria-label="Site">
        <Item to="/photo"><Bullet $color={route.photo}>P</Bullet>Photo</Item>
        <Item to="/video"><Bullet $color={route.video}>V</Bullet>Video</Item>
        <Item to="/about"><Bullet $color={route.about}>A</Bullet>About</Item>
      </Nav>
    </Page>
  )
}
