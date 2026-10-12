import styled from 'styled-components'
import { signage } from '../styles/theme'

const Row = styled.header`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  min-height: 48px;
  margin: 0 0 14px;
  padding: 4px 2px 10px;
  border-bottom: 4px solid #fff;
  box-sizing: border-box;
`

const Dot = styled.span`
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => p.$color};
  color: ${(p) => p.$ink};
  font-family: ${signage};
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.04em;
  line-height: 1;
`

const Name = styled.h1`
  margin: 0;
  font-family: ${signage};
  font-weight: 700;
  font-size: 1.65rem;
  letter-spacing: -0.03em;
  line-height: 1;
  text-transform: uppercase;
  color: #fff;
`

/** Station-sign header shared by the flat pages and the wall boards. */
export default function StationPlate({ letter, title, color, ink = '#fff' }) {
  return (
    <Row>
      <Dot $color={color} $ink={ink} aria-hidden="true">{letter}</Dot>
      <Name>{title}</Name>
    </Row>
  )
}
