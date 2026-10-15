import React, {createContext, useContext} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {loadFont as loadArchivoBlack} from '@remotion/google-fonts/ArchivoBlack';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import {loadFont as loadJetBrainsMono} from '@remotion/google-fonts/JetBrainsMono';
import {loadFont as loadOutfit} from '@remotion/google-fonts/Outfit';
import {loadFont as loadPlusJakartaSans} from '@remotion/google-fonts/PlusJakartaSans';
import {loadFont as loadSpaceGrotesk} from '@remotion/google-fonts/SpaceGrotesk';

// Visual themes for the promo videos. Each one restyles the frame around the
// Win+V panel (background, type, cards) and picks the panel's light or dark
// mode; the panel itself stays a faithful recreation.

const archivoBlack = loadArchivoBlack().fontFamily;
const inter = loadInter().fontFamily;
const jetBrainsMono = loadJetBrainsMono().fontFamily;
const outfit = loadOutfit().fontFamily;
const plusJakartaSans = loadPlusJakartaSans().fontFamily;
const spaceGrotesk = loadSpaceGrotesk().fontFamily;
const segoe = '"Segoe UI Variable Display", "Segoe UI", sans-serif';

export type Surface = {
  background: string;
  border: string;
  boxShadow: string;
  borderRadius: number;
};

export type Overlay = 'none' | 'dots' | 'swiss-grid' | 'scanlines' | 'vaporwave';

export type Theme = {
  id: string;
  name: string;
  background: string;
  overlay: Overlay;
  text: string;
  textDim: string;
  accent: string;
  kicker: string;
  textShadow: string;
  fontDisplay: string;
  fontUi: string;
  displayWeight: number;
  displayTracking: number;
  // Cards around the panel: settings, install steps.
  surface: Surface;
  badge: Surface & {color: string};
  panelMode: 'dark' | 'light';
  panelFrame: {border: string; boxShadow: string; borderRadius: number};
};

export const themes: Record<string, Theme> = {
  neubrutalism: {
    id: 'neubrutalism',
    name: 'Neubrutalism',
    background: '#FFF1C9',
    overlay: 'dots',
    text: '#0A0A0A',
    textDim: '#2E2E2E',
    accent: '#FF5A5F',
    kicker: '#0A0A0A',
    textShadow: 'none',
    fontDisplay: archivoBlack,
    fontUi: spaceGrotesk,
    displayWeight: 400,
    displayTracking: -1,
    surface: {
      background: '#FFFFFF',
      border: '3px solid #0A0A0A',
      boxShadow: '6px 6px 0 #0A0A0A',
      borderRadius: 4,
    },
    badge: {
      background: '#FFD23F',
      border: '3px solid #0A0A0A',
      boxShadow: '4px 4px 0 #0A0A0A',
      borderRadius: 4,
      color: '#0A0A0A',
    },
    panelMode: 'dark',
    panelFrame: {border: '3px solid #0A0A0A', boxShadow: '12px 12px 0 #0A0A0A', borderRadius: 8},
  },
  swiss: {
    id: 'swiss',
    name: 'Swiss Modernism',
    background: '#F3F2EE',
    overlay: 'swiss-grid',
    text: '#0B0B0B',
    textDim: '#4A4A4A',
    accent: '#E3120B',
    kicker: '#E3120B',
    textShadow: 'none',
    fontDisplay: inter,
    fontUi: inter,
    displayWeight: 800,
    displayTracking: -3,
    surface: {
      background: '#FFFFFF',
      border: '1.5px solid #0B0B0B',
      boxShadow: 'none',
      borderRadius: 0,
    },
    badge: {
      background: 'transparent',
      border: '2px solid #0B0B0B',
      boxShadow: 'none',
      borderRadius: 0,
      color: '#0B0B0B',
    },
    panelMode: 'light',
    panelFrame: {border: '1.5px solid #0B0B0B', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', borderRadius: 8},
  },
  terminal: {
    id: 'terminal',
    name: 'Retro Terminal',
    background: 'radial-gradient(ellipse at center, #0B1A10 0%, #030604 75%)',
    overlay: 'scanlines',
    text: '#7CFF9E',
    textDim: 'rgba(124,255,158,0.68)',
    accent: '#FFB000',
    kicker: '#FFB000',
    textShadow: '0 0 12px rgba(124,255,158,0.45)',
    fontDisplay: jetBrainsMono,
    fontUi: jetBrainsMono,
    displayWeight: 700,
    displayTracking: -1,
    surface: {
      background: 'rgba(124,255,158,0.05)',
      border: '1px solid rgba(124,255,158,0.55)',
      boxShadow: '0 0 28px rgba(124,255,158,0.15)',
      borderRadius: 0,
    },
    badge: {
      background: 'rgba(255,176,0,0.08)',
      border: '1px solid #FFB000',
      boxShadow: '0 0 18px rgba(255,176,0,0.25)',
      borderRadius: 0,
      color: '#FFB000',
    },
    panelMode: 'dark',
    panelFrame: {
      border: '1px solid rgba(124,255,158,0.6)',
      boxShadow: '0 0 60px rgba(124,255,158,0.22)',
      borderRadius: 8,
    },
  },
  bento: {
    id: 'bento',
    name: 'Bento',
    background: '#F5F5F7',
    overlay: 'none',
    text: '#1D1D1F',
    textDim: '#6E6E73',
    accent: '#0071E3',
    kicker: '#0071E3',
    textShadow: 'none',
    fontDisplay: plusJakartaSans,
    fontUi: plusJakartaSans,
    displayWeight: 800,
    displayTracking: -2,
    surface: {
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.04)',
      boxShadow: '0 12px 36px rgba(0,0,0,0.08)',
      borderRadius: 24,
    },
    badge: {
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      borderRadius: 999,
      color: '#1D1D1F',
    },
    panelMode: 'light',
    panelFrame: {border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 40px 90px rgba(0,0,0,0.18)', borderRadius: 12},
  },
  vaporwave: {
    id: 'vaporwave',
    name: 'Vaporwave',
    background: 'linear-gradient(180deg, #12002E 0%, #3A0A5E 45%, #B0307C 80%, #FF71CE 100%)',
    overlay: 'vaporwave',
    text: '#FFFFFF',
    textDim: 'rgba(255,255,255,0.82)',
    accent: '#01CDFE',
    kicker: '#05FFA1',
    textShadow: '0 0 18px rgba(255,113,206,0.55)',
    fontDisplay: outfit,
    fontUi: outfit,
    displayWeight: 800,
    displayTracking: -1,
    surface: {
      background: 'rgba(18,0,46,0.72)',
      border: '1px solid rgba(255,113,206,0.65)',
      boxShadow: '0 0 36px rgba(255,113,206,0.35)',
      borderRadius: 14,
    },
    badge: {
      background: 'rgba(1,205,254,0.14)',
      border: '1px solid rgba(1,205,254,0.8)',
      boxShadow: '0 0 20px rgba(1,205,254,0.35)',
      borderRadius: 999,
      color: '#FFFFFF',
    },
    panelMode: 'dark',
    panelFrame: {
      border: '1px solid rgba(1,205,254,0.5)',
      boxShadow: '0 0 70px rgba(1,205,254,0.35)',
      borderRadius: 8,
    },
  },
  fluent: {
    id: 'fluent',
    name: 'Fluent (Windows 11)',
    background:
      'radial-gradient(120% 90% at 50% 125%, #0F6CBD 0%, #3B8EEA 28%, transparent 62%),' +
      'radial-gradient(70% 60% at 85% 100%, #7FC1FF 0%, transparent 60%),' +
      'linear-gradient(180deg, #EEF4FB 0%, #CFE2F8 100%)',
    overlay: 'none',
    text: '#1A1A1A',
    textDim: '#4F5560',
    accent: '#005FB8',
    kicker: '#005FB8',
    textShadow: 'none',
    fontDisplay: segoe,
    fontUi: '"Segoe UI Variable Text", "Segoe UI", sans-serif',
    displayWeight: 700,
    displayTracking: -1,
    surface: {
      background: 'rgba(255,255,255,0.78)',
      border: '1px solid rgba(0,0,0,0.06)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      borderRadius: 8,
    },
    badge: {
      background: 'rgba(255,255,255,0.85)',
      border: '1px solid rgba(0,95,184,0.35)',
      boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
      borderRadius: 999,
      color: '#1A1A1A',
    },
    panelMode: 'light',
    panelFrame: {border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 32px 64px rgba(0,0,0,0.22)', borderRadius: 8},
  },
};

export const themeIds = Object.keys(themes);

const ThemeContext = createContext<Theme>(themes.fluent);

export const ThemeProvider: React.FC<{themeId: string; children: React.ReactNode}> = ({
  themeId,
  children,
}) => <ThemeContext.Provider value={themes[themeId] ?? themes.fluent}>{children}</ThemeContext.Provider>;

export const useTheme = () => useContext(ThemeContext);

// The frame's background, with the theme's texture on top.
export const Backdrop: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: theme.background, overflow: 'hidden'}}>
      {theme.overlay === 'dots' ? (
        <AbsoluteFill
          style={{
            backgroundImage: 'radial-gradient(rgba(0,0,0,0.16) 1.6px, transparent 1.8px)',
            backgroundSize: '30px 30px',
          }}
        />
      ) : null}
      {theme.overlay === 'swiss-grid' ? (
        <AbsoluteFill
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.07) 0 1px, transparent 1px calc(100% / 12))',
          }}
        />
      ) : null}
      {theme.overlay === 'scanlines' ? (
        <>
          <AbsoluteFill
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 4px)',
            }}
          />
          <AbsoluteFill
            style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.6) 100%)'}}
          />
        </>
      ) : null}
      {theme.overlay === 'vaporwave' ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '30%',
              width: 520,
              height: 520,
              marginLeft: -260,
              borderRadius: '50%',
              background:
                'repeating-linear-gradient(180deg, #FFD319 0 26px, #FF2975 26px 30px), linear-gradient(180deg, #FFD319, #FF2975)',
              opacity: 0.35,
              filter: 'blur(1px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '-50%',
              right: '-50%',
              bottom: 0,
              height: '45%',
              transform: 'perspective(500px) rotateX(62deg)',
              transformOrigin: 'bottom center',
              backgroundImage:
                'linear-gradient(rgba(255,113,206,0.7) 2px, transparent 2px), linear-gradient(90deg, rgba(255,113,206,0.7) 2px, transparent 2px)',
              backgroundSize: '80px 80px',
              backgroundPosition: `0 ${(frame * 2) % 80}px`,
              opacity: 0.6,
            }}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
