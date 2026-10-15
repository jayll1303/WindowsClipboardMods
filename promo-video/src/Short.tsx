import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Series,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Badge, Headline, Kicker, Subline, useEnter, useSceneFade} from './components/Text';
import {visibleCards, WinVPanel} from './components/WinVPanel';
import {background, color, font, FPS, PANEL_HEIGHT, PANEL_WIDTH, TabId} from './theme';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const SCENES = {
  hook: 4,
  taller: 10,
  tabs: 9,
  title: 7,
  howto: 6,
};

export const SHORT_DURATION = Object.values(SCENES).reduce((sum, s) => sum + s, 0) * FPS;

const Scene: React.FC<{children: React.ReactNode}> = ({children}) => {
  const opacity = useSceneFade(8);
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

// Text block in the top part of the frame, kept clear of the Shorts UI.
const Top: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      top: 170,
      left: 70,
      right: 70,
      display: 'flex',
      flexDirection: 'column',
      gap: 22,
      alignItems: 'center',
    }}
  >
    {children}
  </div>
);

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 14}});
  return (
    <Scene>
      <Top>
        <Headline size={92} align="center">
          Win+V only shows
        </Headline>
        <Headline delay={8} size={92} align="center" color={color.accent}>
          3 clipboard items?
        </Headline>
      </Top>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', top: 300}}>
        <div style={{transform: `scale(${interpolate(pop, [0, 1], [1.2, 2])})`, opacity: pop}}>
          <WinVPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Taller: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [45, 165], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const height = interpolate(t, [0, 1], [PANEL_HEIGHT, PANEL_HEIGHT * 2.25]);
  return (
    <Scene>
      <Top>
        <Headline size={84} align="center">
          Make it taller
        </Headline>
        <Badge delay={20} size={44}>
          {visibleCards(height)} items visible
        </Badge>
      </Top>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: 520}}>
        <div style={{transform: 'scale(1.55)', transformOrigin: 'top center'}}>
          <WinVPanel width={PANEL_WIDTH} height={height} />
        </div>
      </AbsoluteFill>
      {frame > 190 ? (
        <div style={{position: 'absolute', bottom: 260, left: 70, right: 70}}>
          <Subline delay={190} size={44} align="center">
            Same size items. Way more history.
          </Subline>
        </div>
      ) : null}
    </Scene>
  );
};

const HIDE: TabId[] = ['gif', 'kaomoji', 'symbols', 'emoji', 'recent'];

const Tabs: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const visibility: Partial<Record<TabId, number>> = {};
  HIDE.forEach((id, i) => {
    visibility[id] =
      1 - spring({frame: frame - (40 + i * 30), fps, config: {damping: 200}, durationInFrames: 16});
  });
  return (
    <Scene>
      <Top>
        <Headline size={84} align="center">
          Hide tabs you
        </Headline>
        <Headline delay={6} size={84} align="center" color={color.accent}>
          never use
        </Headline>
      </Top>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', top: 220}}>
        <div style={{transform: 'scale(2.2)'}}>
          <WinVPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} tabVisibility={visibility} />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame, fps, config: {damping: 16}});
  return (
    <Scene>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 36, padding: 70}}>
        <Kicker size={34}>Free Windhawk mod</Kicker>
        <div
          style={{
            fontFamily: font.display,
            fontWeight: 800,
            fontSize: 132,
            lineHeight: 1.05,
            textAlign: 'center',
            color: color.text,
            opacity: p,
            transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`,
          }}
        >
          Win+V Panel Tweaks
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center'}}>
          <Badge delay={20} size={40}>Resize width & height</Badge>
          <Badge delay={28} size={40}>Hide unused tabs</Badge>
          <Badge delay={36} size={40}>Open source</Badge>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const HowTo: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 34, padding: 80}}>
      <Headline size={84} align="center">
        Get it
      </Headline>
      {[
        '1. Install Windhawk',
        '2. Explore → "Win+V Panel Tweaks"',
        '3. Install & set your size',
      ].map((line, i) => (
        <div
          key={line}
          style={{
            ...useEnter(10 + i * 12),
            fontFamily: font.ui,
            fontSize: 50,
            fontWeight: 600,
            color: color.text,
            padding: '24px 40px',
            borderRadius: 18,
            background: 'rgba(255,255,255,0.07)',
            border: `1px solid ${color.panelBorder}`,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {line}
        </div>
      ))}
      <Subline delay={50} size={40} align="center">
        Follow for more Windows tweaks
      </Subline>
    </AbsoluteFill>
  </Scene>
);

export const Short: React.FC = () => (
  <AbsoluteFill style={{background}}>
    <Series>
      <Series.Sequence durationInFrames={SCENES.hook * FPS} premountFor={FPS}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.taller * FPS} premountFor={FPS}>
        <Taller />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.tabs * FPS} premountFor={FPS}>
        <Tabs />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.title * FPS} premountFor={FPS}>
        <Title />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.howto * FPS} premountFor={FPS}>
        <HowTo />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
