import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { font } from '../styles/theme'

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
  gap: 0.65rem;
`

const Item = styled(Link)`
  color: #fff;
  font-family: ${font};
  font-size: 1.05rem;
  text-decoration: underline;
  text-underline-offset: 3px;
`

/** 2D way in only when the station canvas cannot run. */
export default function FlatHome() {
  return (
    <Page>
      <Lead>
        Photography and video by Ronnie Foreman in the New York metropolitan area.
        Skate, snow, and other visual work.
      </Lead>
      <Note>The station view needs WebGL, which is not available right now.</Note>
      <Nav aria-label="Site">
        <Item to="/photo">Photo</Item>
        <Item to="/video">Video</Item>
        <Item to="/about">About</Item>
      </Nav>
    </Page>
  )
}
