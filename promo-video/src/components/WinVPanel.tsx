import React from 'react';
import {clipboardItems, color, emojiGrid, font, TabId, tabIds} from '../theme';

// A recreation of the Windows 11 Win+V panel, in display-scaled pixels.
// `tabVisibility` maps each tab to 0 (hidden) .. 1 (shown) so tabs can animate
// out. `contentScale` scales the content inside, for the "scale content with
// the panel" option.
export type WinVPanelProps = {
  width: number;
  height: number;
  view?: 'clipboard' | 'emoji';
  tabVisibility?: Partial<Record<TabId, number>>;
  contentScale?: number;
  highlightTabs?: number;
  highlightList?: number;
};

const ROW_TITLE = 32;
const ROW_TABS = 52;
const ROW_HEADER = 44;
export const CARD_HEIGHT = 78;
export const CARD_GAP = 10;

const TabGlyph: React.FC<{id: TabId}> = ({id}) => {
  const icon = (glyph: string) => (
    <span style={{fontFamily: font.icons, fontSize: 18}}>{glyph}</span>
  );
  switch (id) {
    case 'recent':
      return icon('');
    case 'emoji':
      return icon('');
    case 'gif':
      return (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            border: '1.5px solid currentColor',
            borderRadius: 3,
            padding: '1px 3px',
          }}
        >
          GIF
        </span>
      );
    case 'kaomoji':
      return <span style={{fontSize: 14, fontWeight: 600}}>;-)</span>;
    case 'symbols':
      return <span style={{fontSize: 17}}>Ω</span>;
    case 'clipboard':
      return icon('');
  }
};

const ClipboardCard: React.FC<{text: string; selected: boolean}> = ({text, selected}) => (
  <div
    style={{
      height: CARD_HEIGHT,
      flexShrink: 0,
      borderRadius: 6,
      background: color.card,
      border: selected ? '2px solid rgba(255,255,255,0.9)' : `1px solid ${color.cardBorder}`,
      boxSizing: 'border-box',
      padding: '10px 12px',
      display: 'flex',
      gap: 8,
    }}
  >
    <div
      style={{
        flex: 1,
        fontSize: 13,
        lineHeight: '18px',
        color: color.text,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}
    >
      {text}
    </div>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: font.icons,
        fontSize: 12,
        color: color.textDim,
      }}
    >
      <span>{''}</span>
      <span>{''}</span>
    </div>
  </div>
);

export const WinVPanel: React.FC<WinVPanelProps> = ({
  width,
  height,
  view = 'clipboard',
  tabVisibility = {},
  contentScale = 1,
  highlightTabs = 0,
  highlightList = 0,
}) => {
  const innerWidth = width / contentScale;
  const innerHeight = height / contentScale;
  const listHeight = innerHeight - ROW_TITLE - ROW_TABS - ROW_HEADER;
  const selectedTab: TabId = view === 'emoji' ? 'emoji' : 'clipboard';

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 8,
        background: color.panel,
        border: `1px solid ${color.panelBorder}`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        fontFamily: font.ui,
        color: color.text,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: innerWidth,
          height: innerHeight,
          transform: `scale(${contentScale})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Title row */}
        <div
          style={{
            height: ROW_TITLE,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            fontSize: 12,
            justifyContent: 'space-between',
          }}
        >
          <span>Emoji and more</span>
          <span style={{fontFamily: font.icons, fontSize: 11}}>{''}</span>
        </div>

        {/* Tabs */}
        <div
          style={{
            height: ROW_TABS,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            position: 'relative',
            borderRadius: 6,
            margin: '0 4px',
            boxShadow: highlightTabs
              ? `0 0 0 ${2 * highlightTabs}px rgba(255,200,60,${0.9 * highlightTabs}), 0 0 ${24 * highlightTabs}px rgba(255,200,60,${0.5 * highlightTabs})`
              : undefined,
          }}
        >
          {tabIds.map((id) => {
            const v = tabVisibility[id] ?? 1;
            const selected = id === selectedTab;
            return (
              <div
                key={id}
                style={{
                  width: 41 * v,
                  height: 40,
                  opacity: v,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: selected ? color.text : color.textDim,
                  position: 'relative',
                }}
              >
                <TabGlyph id={id} />
                {selected ? (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      width: 16,
                      height: 3,
                      borderRadius: 2,
                      background: color.accent,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Section header */}
        <div
          style={{
            height: ROW_HEADER,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
          }}
        >
          <span style={{fontSize: 14}}>{view === 'emoji' ? 'Most used' : 'Clipboard'}</span>
          {view === 'clipboard' ? (
            <span
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.08)',
              }}
            >
              Clear all
            </span>
          ) : null}
        </div>

        {/* Content */}
        <div
          style={{
            height: listHeight,
            overflow: 'hidden',
            padding: '0 16px',
            position: 'relative',
            boxShadow: highlightList
              ? `inset 0 -${60 * highlightList}px 40px -30px rgba(255,90,90,${0.5 * highlightList})`
              : undefined,
          }}
        >
          {view === 'clipboard' ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: CARD_GAP}}>
              {clipboardItems.map((text, i) => (
                <ClipboardCard key={i} text={text} selected={i === 0} />
              ))}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                fontFamily: font.emoji,
                fontSize: 22,
              }}
            >
              {emojiGrid.map((e, i) => (
                <div
                  key={i}
                  style={{
                    width: 41,
                    height: 41,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {e}
                </div>
              ))}
            </div>
          )}
          {/* Scrollbar */}
          <div
            style={{
              position: 'absolute',
              right: 4,
              top: 4,
              width: 3,
              height: Math.max(40, listHeight * 0.4),
              borderRadius: 2,
              background: 'rgba(255,255,255,0.3)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

// How many clipboard cards are fully visible at a given panel height.
export const visibleCards = (height: number) =>
  Math.floor((height - ROW_TITLE - ROW_TABS - ROW_HEADER + CARD_GAP) / (CARD_HEIGHT + CARD_GAP));

// How many emoji fit in one row at a given panel width.
export const emojiPerRow = (width: number) => Math.floor((width - 32) / 41);
