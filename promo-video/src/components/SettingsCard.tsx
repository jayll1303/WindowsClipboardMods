import React from 'react';
import {Theme, useTheme} from '../themes';

// A mod settings card in the style of Windhawk's settings page, dressed in the
// current theme. Each row is a number field or a toggle; `active` highlights
// the row being changed.
export type SettingRow =
  | {kind: 'number'; label: string; value: number; active?: boolean}
  | {kind: 'toggle'; label: string; on: number; active?: boolean};

const Toggle: React.FC<{on: number; theme: Theme}> = ({on, theme}) => (
  <div
    style={{
      width: 40,
      height: 20,
      borderRadius: 10,
      background: on > 0.5 ? theme.accent : 'transparent',
      border: `1.5px solid ${on > 0.5 ? theme.accent : theme.textDim}`,
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
        background: on > 0.5 ? '#fff' : theme.textDim,
      }}
    />
  </div>
);

export const SettingsCard: React.FC<{rows: SettingRow[]; width?: number}> = ({
  rows,
  width = 410,
}) => {
  const theme = useTheme();
  return (
    <div
      style={{
        ...theme.surface,
        width,
        fontFamily: theme.fontUi,
        color: theme.text,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          fontSize: 15,
          fontWeight: 700,
          borderBottom: theme.surface.border.replace(/^\S+/, '1px'),
        }}
      >
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
            background: row.active ? `${theme.accent}22` : 'transparent',
            borderLeft: `4px solid ${row.active ? theme.accent : 'transparent'}`,
          }}
        >
          <span style={{color: row.active ? theme.text : theme.textDim}}>{row.label}</span>
          {row.kind === 'number' ? (
            <span
              style={{
                minWidth: 64,
                textAlign: 'right',
                padding: '4px 10px',
                borderBottom: `2px solid ${row.active ? theme.accent : theme.textDim}`,
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 700,
              }}
            >
              {Math.round(row.value)}
            </span>
          ) : (
            <Toggle on={row.on} theme={theme} />
          )}
        </div>
      ))}
    </div>
  );
};
