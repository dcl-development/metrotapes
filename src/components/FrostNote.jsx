import styled from 'styled-components'
import { frostedPanel, frostedPanelShadow } from '../styles/frostedPanel'
import { font } from '../styles/theme'

const Note = styled.div`
  ${frostedPanel}
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
