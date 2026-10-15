import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {useTheme} from '../themes';

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
  accent?: boolean;
}> = ({children, delay = 0, size = 64, align = 'left', accent = false}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        ...useEnter(delay),
        fontFamily: theme.fontDisplay,
        fontWeight: theme.displayWeight,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: theme.displayTracking,
        color: accent ? theme.accent : theme.text,
        textShadow: theme.textShadow,
        textAlign: align,
      }}
    >
      {children}
    </div>
  );
};

export const Subline: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  align?: 'left' | 'center';
}> = ({children, delay = 0, size = 30, align = 'left'}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        ...useEnter(delay),
        fontFamily: theme.fontUi,
        fontSize: size,
        lineHeight: 1.35,
        color: theme.textDim,
        textAlign: align,
      }}
    >
      {children}
    </div>
  );
};

export const Kicker: React.FC<{children: React.ReactNode; delay?: number; size?: number}> = ({
  children,
  delay = 0,
  size = 22,
}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        ...useEnter(delay),
        fontFamily: theme.fontUi,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: theme.kicker,
        textShadow: theme.textShadow,
      }}
    >
      {children}
    </div>
  );
};

// A pill with a number, e.g. "3 → 7 entries visible".
export const Badge: React.FC<{children: React.ReactNode; delay?: number; size?: number}> = ({
  children,
  delay = 0,
  size = 28,
}) => {
  const theme = useTheme();
  const {color, ...surface} = theme.badge;
  return (
    <div
      style={{
        ...useEnter(delay),
        ...surface,
        display: 'inline-block',
        alignSelf: 'flex-start',
        fontFamily: theme.fontUi,
        fontSize: size,
        fontWeight: 700,
        padding: `${size * 0.35}px ${size * 0.8}px`,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </div>
  );
};
