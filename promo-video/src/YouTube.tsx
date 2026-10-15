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
import {SettingsCard} from './components/SettingsCard';
import {Soundtrack} from './components/Soundtrack';
import {Backdrop, ThemeProvider, useTheme} from './themes';
import {sceneTimings} from './timing';
import {Badge, Headline, Kicker, Subline, useEnter, useSceneFade} from './components/Text';
import {emojiPerRow, visibleCards, WinVPanel} from './components/WinVPanel';
import {FPS, PANEL_HEIGHT, PANEL_WIDTH, TabId} from './theme';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const Scene: React.FC<{children: React.ReactNode}> = ({children}) => {
  const opacity = useSceneFade(12);
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const Scaled: React.FC<{scale: number; children: React.ReactNode}> = ({scale, children}) => (
  <div style={{transform: `scale(${scale})`, transformOrigin: 'center center'}}>{children}</div>
);

const Hook: React.FC = () => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 14}});
  return (
    <Scene>
      <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 140px', gap: 120}}>
        <div style={{transform: `scale(${interpolate(pop, [0, 1], [0.85, 1.6])})`, opacity: pop, marginLeft: 120}}>
          <WinVPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 24, marginLeft: 200}}>
          <Kicker delay={10}>Windows 11 · Win+V</Kicker>
          <Headline delay={18} size={76}>
            Your clipboard keeps 25 items.
          </Headline>
          <Headline delay={60} size={76} accent>
            Win+V shows 3.
          </Headline>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const tabsGlow = interpolate(frame, [30, 50, 170, 190], [0, 1, 1, 0], clamp);
  const listGlow = interpolate(frame, [200, 220, 360, 380], [0, 1, 1, 0], clamp);
  return (
    <Scene>
      <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 140px'}}>
        <div style={{marginLeft: 120}}>
          <Scaled scale={1.6}>
            <WinVPanel
              width={PANEL_WIDTH}
              height={PANEL_HEIGHT}
              highlightTabs={tabsGlow}
              highlightList={listGlow}
            />
          </Scaled>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 28, marginLeft: 260, width: 760}}>
          {frame < 195 ? (
            <>
              <Kicker delay={30}>Crowded</Kicker>
              <Headline delay={36} size={68}>
                Six tabs on top.
              </Headline>
              <Subline delay={70}>
                Emoji, GIF, kaomoji, symbols, most used… when all you wanted was what you copied.
              </Subline>
            </>
          ) : (
            <>
              <Kicker delay={200}>Cramped</Kicker>
              <Headline delay={206} size={68}>
                A 360 × 400 window.
              </Headline>
              <Subline delay={240}>
                Everything you copied earlier is a scroll away, and the panel can't be resized.
              </Subline>
            </>
          )}
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
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 28}}>
        <Kicker delay={4} size={26}>
          A free Windhawk mod
        </Kicker>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontWeight: theme.displayWeight,
            fontSize: 132,
            letterSpacing: theme.displayTracking,
            color: theme.text,
            textShadow: theme.textShadow,
            transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`,
            opacity: p,
          }}
        >
          Win+V Panel Tweaks
        </div>
        <div style={{display: 'flex', gap: 20, marginTop: 10}}>
          <Badge delay={24}>Resize the panel</Badge>
          <Badge delay={32}>Hide unused tabs</Badge>
          <Badge delay={40}>Open source</Badge>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const HeightScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = interpolate(frame, [90, 210], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const percent = interpolate(t, [0, 1], [100, 200]);
  const height = (PANEL_HEIGHT * percent) / 100;
  const shown = visibleCards(height);
  return (
    <Scene>
      <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 120px', gap: 90}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 560}}>
          <Kicker delay={6}>Feature 1 · Size</Kicker>
          <Headline delay={12} size={64}>
            Make it taller. See more history.
          </Headline>
          <div style={{...useEnter(30), zoom: 1.35, transformOrigin: 'left top'}}>
            <SettingsCard
              rows={[
                {kind: 'number', label: 'Panel width (%)', value: 100},
                {kind: 'number', label: 'Panel height (%)', value: percent, active: frame > 70},
                {kind: 'toggle', label: 'Scale content with the panel', on: 0},
              ]}
            />
          </div>
          <Badge delay={60}>
            {shown} entries visible{frame > 230 ? ` (was ${visibleCards(PANEL_HEIGHT)})` : ''}
          </Badge>
          {frame > 300 ? (
            <Subline delay={300}>Items keep their normal size. The panel just shows more of them.</Subline>
          ) : null}
        </div>
        <div style={{height: 900, display: 'flex', alignItems: 'center', marginLeft: 120}}>
          <div style={{transform: `scale(1.15)`, opacity: spring({frame: frame - 20, fps, config: {damping: 200}})}}>
            <WinVPanel width={PANEL_WIDTH} height={height} />
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const WidthScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [70, 170], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const percent = interpolate(t, [0, 1], [100, 150]);
  const width = (PANEL_WIDTH * percent) / 100;
  return (
    <Scene>
      <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 120px', gap: 90}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 560}}>
          <Kicker delay={6}>Width works too</Kicker>
          <Headline delay={12} size={64}>
            Wider panel, more emoji per row.
          </Headline>
          <div style={{...useEnter(30), zoom: 1.35, transformOrigin: 'left top'}}>
            <SettingsCard
              rows={[
                {kind: 'number', label: 'Panel width (%)', value: percent, active: frame > 50},
                {kind: 'number', label: 'Panel height (%)', value: 100},
              ]}
            />
          </div>
          <Badge delay={60}>{emojiPerRow(width)} emoji per row</Badge>
          <Subline delay={190}>Width and height go from 50% to 300%, each on its own.</Subline>
        </div>
        <div style={{marginLeft: 60}}>
          <Scaled scale={1.35}>
            <WinVPanel width={width} height={PANEL_HEIGHT} view="emoji" />
          </Scaled>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const HIDE_ORDER: {id: TabId; label: string}[] = [
  {id: 'gif', label: 'Hide "GIF" tab'},
  {id: 'kaomoji', label: 'Hide "Kaomoji" tab'},
  {id: 'symbols', label: 'Hide "Symbols" tab'},
  {id: 'emoji', label: 'Hide "Emoji" tab'},
  {id: 'recent', label: 'Hide "Most recently used" tab'},
];

const TabsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const switches = HIDE_ORDER.map((tab, i) =>
    spring({frame: frame - (70 + i * 55), fps, config: {damping: 200}, durationInFrames: 18}),
  );
  const visibility: Partial<Record<TabId, number>> = {};
  HIDE_ORDER.forEach((tab, i) => {
    visibility[tab.id] = 1 - switches[i];
  });
  return (
    <Scene>
      <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 120px', gap: 90}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 600}}>
          <Kicker delay={6}>Feature 2 · Tabs</Kicker>
          <Headline delay={12} size={64}>
            Hide the tabs you never use.
          </Headline>
          <div style={{...useEnter(30), zoom: 1.35, transformOrigin: 'left top'}}>
            <SettingsCard
              rows={HIDE_ORDER.map((tab, i) => ({
                kind: 'toggle' as const,
                label: tab.label,
                on: switches[i],
                active: frame > 60 + i * 55 && frame < 115 + i * 55,
              }))}
            />
          </div>
          {frame > 360 ? (
            <Subline delay={360}>Just the clipboard. Changes apply right away, and turning the mod off brings every tab back.</Subline>
          ) : null}
        </div>
        <div style={{marginLeft: 100}}>
          <Scaled scale={1.5}>
            <WinVPanel width={PANEL_WIDTH} height={PANEL_HEIGHT} tabVisibility={visibility} />
          </Scaled>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const ScaleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const on = spring({frame: frame - 70, fps, config: {damping: 200}, durationInFrames: 20});
  const contentScale = interpolate(on, [0, 1], [1, 1.5]);
  return (
    <Scene>
      <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', padding: '0 120px', gap: 90}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 560}}>
          <Kicker delay={6}>Prefer bigger items?</Kicker>
          <Headline delay={12} size={60}>
            One switch scales the content with the panel.
          </Headline>
          <div style={{...useEnter(30), zoom: 1.35, transformOrigin: 'left top'}}>
            <SettingsCard
              rows={[
                {kind: 'number', label: 'Panel height (%)', value: 150},
                {kind: 'toggle', label: 'Scale content with the panel', on, active: frame > 55},
              ]}
            />
          </div>
        </div>
        <div style={{marginLeft: 120}}>
          <Scaled scale={1.2}>
            <WinVPanel width={PANEL_WIDTH * 1.5} height={PANEL_HEIGHT * 1.5} contentScale={contentScale} />
          </Scaled>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const Step: React.FC<{n: number; title: string; detail: string; delay: number}> = ({
  n,
  title,
  detail,
  delay,
}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        ...useEnter(delay),
        ...theme.surface,
        width: 470,
        padding: 36,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: theme.accent,
          fontFamily: theme.fontDisplay,
          fontWeight: 700,
          fontSize: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        {n}
      </div>
      <div style={{fontFamily: theme.fontDisplay, fontWeight: theme.displayWeight, fontSize: 36, color: theme.text}}>
        {title}
      </div>
      <div style={{fontFamily: theme.fontUi, fontSize: 24, color: theme.textDim, lineHeight: 1.4}}>{detail}</div>
    </div>
  );
};

const Install: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 56}}>
      <Headline delay={4} size={68} align="center">
        Get it in a minute
      </Headline>
      <div style={{display: 'flex', gap: 36}}>
        <Step n={1} delay={20} title="Install Windhawk" detail="Free customization app for Windows, from windhawk.net" />
        <Step n={2} delay={45} title="Find the mod" detail={'Explore → search "Win+V Panel Tweaks" → Install'} />
        <Step n={3} delay={70} title="Tweak it" detail="Set the width, the height and the tabs you want in its settings" />
      </div>
    </AbsoluteFill>
  </Scene>
);

const Outro: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 30}}>
      <Headline delay={4} size={96} align="center">
        Win+V Panel Tweaks
      </Headline>
      <Subline delay={16} size={34} align="center">
        Free · Open source (MIT) · Tested on Windows 11 25H2
      </Subline>
      <Badge delay={30} size={30}>
        github.com/jayll1303/WindowsClipboardMods
      </Badge>
      <Subline delay={60} size={30} align="center">
        Found it useful? Like and subscribe for more Windows tweaks.
      </Subline>
    </AbsoluteFill>
  </Scene>
);

const SCENE_COMPONENTS: Record<string, React.FC> = {
  hook: Hook,
  problem: Problem,
  title: Title,
  height: HeightScene,
  width: WidthScene,
  tabs: TabsScene,
  scale: ScaleScene,
  install: Install,
  outro: Outro,
};

export const YouTube: React.FC<{themeId: string}> = ({themeId}) => (
  <ThemeProvider themeId={themeId}>
  <AbsoluteFill>
    <Backdrop />
    <Series>
      {sceneTimings('youtube').map((scene) => {
        const Scene = SCENE_COMPONENTS[scene.id];
        return (
          <Series.Sequence key={scene.id} durationInFrames={scene.frames} premountFor={FPS}>
            <Scene />
          </Series.Sequence>
        );
      })}
    </Series>
    <Soundtrack video="youtube" />
  </AbsoluteFill>
  </ThemeProvider>
);
