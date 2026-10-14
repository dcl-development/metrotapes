import styled from 'styled-components'
import { frostedPanelShadow } from '../styles/frostedPanel'
import { font } from '../styles/theme'

const Note = styled.div`
  /* No backdrop-filter: these notes sit inside the CSS3D wall pages.
     A blur there samples the WebGL canvas and tears tiles. */
  background: rgba(22, 22, 22, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.06);
  ${frostedPanelShadow}
  border-radius: 12px;
  padding: 2rem 1.5rem;
  max-width: 28rem;
  margin: 2rem auto 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.88);
  font-family: ${font};
  letter-spacing: -0.02em;
  line-height: 1.5;
`

export default function FrostNote({ children }) {
  return <Note>{children}</Note>
}
