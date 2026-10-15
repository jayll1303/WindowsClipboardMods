// Shared look and sample data for the promo videos. The clipboard entries are
// made up; nothing comes from a real clipboard.

export const FPS = 30;

// Fonts the Win+V panel recreation uses, whatever the theme.
export const panelFont = {
  ui: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  icons: '"Segoe Fluent Icons", "Segoe MDL2 Assets"',
  emoji: '"Segoe UI Emoji", sans-serif',
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
