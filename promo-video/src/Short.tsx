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
import {Soundtrack} from './components/Soundtrack';
import {Backdrop, ThemeProvider, useTheme} from './themes';
import {sceneTimings} from './timing';
import {Badge, Headline, Kicker, Subline, useEnter, useSceneFade} from './components/Text';
import {visibleCards, WinVPanel} from './components/WinVPanel';
import {FPS, PANEL_HEIGHT, PANEL_WIDTH, TabId} from './theme';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

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
  const theme = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 14}});
  return (
    <Scene>
      <Top>
        <Headline size={92} align="center">
          Win+V only shows
        </Headline>
        <Headline delay={8} size={92} align="center" accent>
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
  // Twice the default height keeps the panel's bottom above the Shorts UI.
  const height = interpolate(t, [0, 1], [PANEL_HEIGHT, PANEL_HEIGHT * 2]);
  return (
    <Scene>
      <Top>
        <Headline size={84} align="center">
          Make it taller
        </Headline>
        <Badge align="center" delay={20} size={44}>
          {visibleCards(height)} items visible
        </Badge>
        {frame > 190 ? (
          <Subline delay={190} size={42} align="center">
            Same size items. Way more history.
          </Subline>
        ) : null}
      </Top>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: 520}}>
        <div style={{transform: 'scale(1.55)', transformOrigin: 'top center'}}>
          <WinVPanel width={PANEL_WIDTH} height={height} />
        </div>
      </AbsoluteFill>
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
        <Headline delay={6} size={84} align="center" accent>
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
  const theme = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame, fps, config: {damping: 16}});
  return (
    <Scene>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 36, padding: 70}}>
        <Kicker size={34}>Free Windhawk mod</Kicker>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontWeight: theme.displayWeight,
            fontSize: 132,
            lineHeight: 1.05,
            textAlign: 'center',
            letterSpacing: theme.displayTracking,
            color: theme.text,
            textShadow: theme.textShadow,
            opacity: p,
            transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`,
          }}
        >
          Win+V Panel Tweaks
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center'}}>
          <Badge align="center" delay={20} size={40}>Resize width & height</Badge>
          <Badge align="center" delay={28} size={40}>Hide unused tabs</Badge>
          <Badge align="center" delay={36} size={40}>Open source</Badge>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const HowTo: React.FC = () => {
  const theme = useTheme();
  return (
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
            fontFamily: theme.fontUi,
            fontSize: 50,
            fontWeight: 600,
            color: theme.text,
            ...theme.surface,
            padding: '24px 40px',
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
};

const SCENE_COMPONENTS: Record<string, React.FC> = {
  hook: Hook,
  taller: Taller,
  tabs: Tabs,
  title: Title,
  howto: HowTo,
};

export const Short: React.FC<{themeId: string}> = ({themeId}) => (
  <ThemeProvider themeId={themeId}>
  <AbsoluteFill>
    <Backdrop />
    <Series>
      {sceneTimings('short').map((scene) => {
        const Scene = SCENE_COMPONENTS[scene.id];
        return (
          <Series.Sequence key={scene.id} durationInFrames={scene.frames} premountFor={FPS}>
            <Scene />
          </Series.Sequence>
        );
      })}
    </Series>
    <Soundtrack video="short" />
  </AbsoluteFill>
  </ThemeProvider>
);
