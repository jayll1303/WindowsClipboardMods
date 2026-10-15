import React from 'react';
import {color, font} from '../theme';

// A mod settings card in the style of Windhawk's settings page. Each row is a
// number field or a toggle; `active` highlights the row being changed.
export type SettingRow =
  | {kind: 'number'; label: string; value: number; active?: boolean}
  | {kind: 'toggle'; label: string; on: number; active?: boolean};

const Toggle: React.FC<{on: number}> = ({on}) => (
  <div
    style={{
      width: 40,
      height: 20,
      borderRadius: 10,
      background: on > 0.5 ? color.accentStrong : 'transparent',
      border: `1.5px solid ${on > 0.5 ? color.accentStrong : 'rgba(255,255,255,0.6)'}`,
      position: 'relative',
      boxSizing: 'border-box',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 3,
        left: 3 + on * 20,
        width: 11,
        height: 11,
        borderRadius: 6,
        background: on > 0.5 ? '#fff' : 'rgba(255,255,255,0.8)',
      }}
    />
  </div>
);

export const SettingsCard: React.FC<{rows: SettingRow[]; width?: number}> = ({
  rows,
  width = 410,
}) => (
  <div
    style={{
      width,
      borderRadius: 10,
      background: 'rgba(30,32,38,0.96)',
      border: `1px solid ${color.panelBorder}`,
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      fontFamily: font.ui,
      color: color.text,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        padding: '14px 20px',
        fontSize: 15,
        fontWeight: 600,
        borderBottom: `1px solid ${color.panelBorder}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{fontFamily: font.icons, fontSize: 15, color: color.accent}}>{''}</span>
      Win+V Panel Tweaks · Settings
    </div>
    {rows.map((row, i) => (
      <div
        key={i}
        style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 14,
          background: row.active ? 'rgba(76,194,255,0.12)' : 'transparent',
          borderLeft: `3px solid ${row.active ? color.accent : 'transparent'}`,
        }}
      >
        <span style={{color: row.active ? color.text : color.textDim}}>{row.label}</span>
        {row.kind === 'number' ? (
          <span
            style={{
              minWidth: 64,
              textAlign: 'right',
              padding: '4px 10px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.07)',
              borderBottom: `2px solid ${row.active ? color.accent : 'rgba(255,255,255,0.3)'}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(row.value)}
          </span>
        ) : (
          <Toggle on={row.on} />
        )}
      </div>
    ))}
  </div>
);
