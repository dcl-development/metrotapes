import { useState, useEffect } from 'react'
import styled from 'styled-components'
import { NavLink, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faVideo, faBook, faBars } from '@fortawesome/free-solid-svg-icons'
import { route, station, cushy } from '../styles/theme'
import { useKioskLeave } from '../context/useKioskLeave'
import { usePresentation } from '../lib/usePresentation'

const HeaderContainer = styled.header`
  width: 100%;
  background: ${station};
`

const HeaderContent = styled.div`
  padding: 0.75rem 1rem;
  position: relative;

  @media (min-width: 768px) {
    padding: 0.75rem 1rem 0.75rem 1rem;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
`

const TopSection = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  padding-bottom: 4px;
`

const TitleWrapper = styled.button`
  ${cushy}
  background: none;
  border: none;
  padding: 0;
  display: inline-block;
  transform-origin: left center;
  border-radius: 2px;

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 4px;
  }
`

const Title = styled.div`
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
  line-height: 1;
`

const ResetButton = styled.button`
  ${cushy}
  width: 52px;
  min-width: 48px;
  min-height: 48px;
  height: auto;
  background: none;
  border: none;
  padding: 2px 0 0;
  position: relative;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));

  img {
    width: 26px;
    height: 34px;
    object-fit: contain;
    pointer-events: none;
    display: block;
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 3px;
  }
`

const RightCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
`

const NavList = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  max-height: ${props => props.$isOpen ? '300px' : '0'};
  opacity: ${props => props.$isOpen ? 1 : 0};
  visibility: ${props => props.$isOpen ? 'visible' : 'hidden'};
  transition: all 0.3s ease;
  padding: 0;
  margin: ${props => props.$isOpen ? '1rem 0 .5rem' : '0'};

  @media (min-width: 768px) {
    flex-direction: row;
    gap: 1rem;
    max-height: none;
    opacity: 1;
    visibility: visible;
    overflow: visible;
    padding: 0;
    margin: 0;
  }
`

const NavItem = styled(NavLink)`
  ${cushy}
  display: flex;
  align-items: center;
  text-decoration: none;
  min-width: 48px;
  min-height: 48px;
  height: 48px;
  position: relative;
  overflow: visible;
  border-radius: 24px;

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 3px;
  }

  @media (min-width: 768px) {
    height: 48px;
  }
`

const Circle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: bold;
  font-size: 0.9rem;
  background-color: ${props => props.color};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  flex-shrink: 0;

  svg {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
  }

  @media (max-width: 767px) {
    width: 132px;
    height: 48px;
    padding: 0 1.5rem 0 1rem;
    justify-content: flex-start;
  }

  @media (min-width: 768px) {
    width: auto;
    height: 38px;
    border-radius: 19px;
    font-size: 0.95rem;
    padding: 0 14px 0 12px;
    justify-content: flex-start;
  }
`

const NavText = styled.span`
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1rem;
  font-weight: 600;
  margin-left: 8px;
  letter-spacing: -0.02em;
  white-space: nowrap;
  pointer-events: none;
`

const MenuButton = styled.button`
  ${cushy}
  display: none;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  min-width: 48px;
  min-height: 48px;
  padding: 8px;
  margin-right: 4px;
  transition: transform 0.2s ease, color 0.2s ease;

  &:hover {
    color: white;
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 3px;
  }

  @media (max-width: 767px) {
    display: block;
  }
`

const TitleGroup = styled.div`
  display: flex;
  align-items: left;
`

const TitleSection = styled.div`
  display: flex;
  align-items: center;
`

const ResetWord = styled.span`
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
  line-height: 1;
`

const QualityButton = styled.button`
  ${cushy}
  min-width: 48px;
  min-height: 48px;
  padding: 0 0.7rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 2px;
  color: white;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: lowercase;

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 3px;
  }
`

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )
  const navigate = useNavigate()
  const kioskLeave = useKioskLeave()
  const { mode, setMode } = usePresentation()

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => {
      const mobile = mq.matches
      setIsMobile(mobile)
      if (!mobile) setIsOpen(false)
    }
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    mq.addEventListener('change', apply)
    const vv = window.visualViewport
    vv?.addEventListener('resize', apply)
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
      mq.removeEventListener('change', apply)
      vv?.removeEventListener('resize', apply)
    }
  }, [])

  const handleTitleClick = (e) => {
    e.preventDefault()
    // Prefer station goHome — resets look-aside zoom + returns from wall boards
    if (kioskLeave?.goHome?.()) return
    navigate('/')
  }

  const handleMenuToggle = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleNavClick = (path) => (e) => {
    if (isMobile) {
      setIsOpen(false)
    }
    if (kioskLeave?.tryLeave?.(path)) {
      e.preventDefault()
    }
  }

  const handleReset = () => {
    if (kioskLeave?.goHome?.()) return
    navigate('/')
  }

  const renderNavItems = () => (
    <>
      <NavItem to="/photo" aria-label="Photo" title="Photo" onClick={handleNavClick('/photo')}>
        <Circle color={route.photo}>
          <FontAwesomeIcon icon={faCamera} />
        </Circle>
        <NavText>photo</NavText>
      </NavItem>
      <NavItem to="/video" aria-label="Video" title="Video" onClick={handleNavClick('/video')}>
        <Circle color={route.video}>
          <FontAwesomeIcon icon={faVideo} />
        </Circle>
        <NavText>video</NavText>
      </NavItem>
      <NavItem to="/about" aria-label="About" title="About" onClick={handleNavClick('/about')}>
        <Circle color={route.about}>
          <FontAwesomeIcon icon={faBook} />
        </Circle>
        <NavText>about</NavText>
      </NavItem>
    </>
  )

  return (
    <HeaderContainer>
      <HeaderContent>
        <TopSection>
          <TitleSection>
            {isMobile && (
              <MenuButton
                type="button"
                onClick={handleMenuToggle}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
                title={isOpen ? 'Close menu' : 'Menu'}
                aria-expanded={isOpen}
                aria-controls="site-nav"
              >
                <FontAwesomeIcon icon={faBars} size="lg" />
              </MenuButton>
            )}
            <TitleWrapper type="button" onClick={handleTitleClick} aria-label="metrotapes, home">
              <TitleGroup>
                <Title>metrotapes</Title>
              </TitleGroup>
            </TitleWrapper>
          </TitleSection>
          <RightCluster>
            {!isMobile && (
              <NavList id="site-nav" aria-label="Pages" $isOpen={isOpen}>
                {renderNavItems()}
              </NavList>
            )}
            <QualityButton
              type="button"
              aria-pressed={mode === 'full'}
              title={mode === 'full' ? 'Full station view' : 'Flat view'}
              onClick={() => setMode(mode === 'full' ? 'lite' : 'full')}
            >
              {mode === 'full' ? 'full' : 'lite'}
            </QualityButton>
            <ResetButton type="button" onClick={handleReset} aria-label="Reset to entrance" title="Reset to entrance">
              <img src="/lamp.png" alt="" width={160} height={267} />
              <ResetWord>reset</ResetWord>
            </ResetButton>
          </RightCluster>
        </TopSection>
        {isMobile && (
          <NavList id="site-nav" aria-label="Pages" $isOpen={isOpen}>
            {renderNavItems()}
          </NavList>
        )}
      </HeaderContent>
    </HeaderContainer>
  )
} 