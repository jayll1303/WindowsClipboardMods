// Shared look and sample data for the promo videos. The clipboard entries are
// made up; nothing comes from a real clipboard.

export const FPS = 30;

export const font = {
  ui: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  display: '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
  icons: '"Segoe Fluent Icons", "Segoe MDL2 Assets"',
  emoji: '"Segoe UI Emoji", sans-serif',
};

export const color = {
  text: '#ffffff',
  textDim: 'rgba(255,255,255,0.72)',
  textFaint: 'rgba(255,255,255,0.5)',
  accent: '#4cc2ff',
  accentStrong: '#0078d4',
  good: '#6ccb5f',
  panel: 'rgba(36,36,40,0.97)',
  panelBorder: 'rgba(255,255,255,0.09)',
  card: 'rgba(255,255,255,0.06)',
  cardBorder: 'rgba(255,255,255,0.05)',
};

// Default panel size in display-scaled pixels, as Windows sets it.
export const PANEL_WIDTH = 360;
export const PANEL_HEIGHT = 400;

export const clipboardItems = [
  'Meeting moved to 3:30 PM — same room',
  'https://windhawk.net',
  'git commit -m "fix: typo in README"',
  '#4F46E5',
  'TODO: order more coffee beans ☕',
  'Thanks! I\'ll send the slides tonight.',
  '221B Baker Street, London',
  'npm run build && npm test',
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Happy birthday! 🎉',
];

export const emojiGrid = [
  '😀', '😂', '🥹', '😍', '🤩', '😎', '🤔', '😴', '😭', '😡', '👍', '👏',
  '🙏', '💪', '🔥', '✨', '🎉', '❤️', '💙', '💚', '⭐', '🌈', '☕', '🍕',
  '🚀', '💡', '📌', '✅', '❌', '⚡', '🎯', '🧠', '👀', '🙌', '🤝', '😅',
  '😇', '🥳', '😬', '🤯', '😱', '🤗', '😏', '🙃', '😉', '😋', '😜', '🤓',
  '🐱', '🐶', '🦊', '🐼', '🐸', '🐧', '🌸', '🌻', '🍀', '🍓', '🍩', '🎮',
];

export type TabId = 'recent' | 'emoji' | 'gif' | 'kaomoji' | 'symbols' | 'clipboard';
export const tabIds: TabId[] = ['recent', 'emoji', 'gif', 'kaomoji', 'symbols', 'clipboard'];

export const background =
  'radial-gradient(1200px 800px at 15% 20%, #1d3a6b 0%, transparent 60%),' +
  'radial-gradient(1000px 900px at 85% 85%, #3a1d5c 0%, transparent 60%),' +
  '#0b0f1a';
