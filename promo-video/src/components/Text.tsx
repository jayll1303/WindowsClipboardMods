import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, font} from '../theme';

// Entrance that slides up and fades in, starting at `delay` frames.
export const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - delay, fps, config: {damping: 200}});
  return {
    opacity: p,
    transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px)`,
  };
};

// Fades a whole scene in and out over `edge` frames.
export const useSceneFade = (edge = 10) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return interpolate(
    frame,
    [0, edge, durationInFrames - edge, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
};

export const Headline: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  align?: 'left' | 'center';
  color?: string;
}> = ({children, delay = 0, size = 64, align = 'left', color: c = color.text}) => (
  <div
    style={{
      ...useEnter(delay),
      fontFamily: font.display,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1.1,
      letterSpacing: -0.5,
      color: c,
      textAlign: align,
    }}
  >
    {children}
  </div>
);

export const Subline: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  align?: 'left' | 'center';
}> = ({children, delay = 0, size = 30, align = 'left'}) => (
  <div
    style={{
      ...useEnter(delay),
      fontFamily: font.ui,
      fontSize: size,
      lineHeight: 1.35,
      color: color.textDim,
      textAlign: align,
    }}
  >
    {children}
  </div>
);

export const Kicker: React.FC<{children: React.ReactNode; delay?: number; size?: number}> = ({
  children,
  delay = 0,
  size = 22,
}) => (
  <div
    style={{
      ...useEnter(delay),
      fontFamily: font.ui,
      fontSize: size,
      fontWeight: 600,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: color.accent,
    }}
  >
    {children}
  </div>
);

// A pill with a number, e.g. "3 → 7 entries visible".
export const Badge: React.FC<{children: React.ReactNode; delay?: number; size?: number}> = ({
  children,
  delay = 0,
  size = 28,
}) => (
  <div
    style={{
      ...useEnter(delay),
      display: 'inline-block',
      fontFamily: font.ui,
      fontSize: size,
      fontWeight: 600,
      padding: `${size * 0.35}px ${size * 0.8}px`,
      borderRadius: 999,
      background: 'rgba(76,194,255,0.14)',
      border: '1px solid rgba(76,194,255,0.5)',
      color: color.text,
      fontVariantNumeric: 'tabular-nums',
    }}
  >
    {children}
  </div>
);
