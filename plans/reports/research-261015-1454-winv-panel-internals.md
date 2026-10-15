# Win+V panel internals (Windows 11 25H2, build 26200.9711)

Research for a Windhawk mod that resizes the Win+V clipboard panel and hides
its tabs (Emoji, GIF, Kaomoji, Symbols, …). Evidence was collected with the
debug mod [`mods/winv-xaml-dump.wh.cpp`](../../mods/winv-xaml-dump.wh.cpp).

## Outcome

- **Hiding tabs: solved and verified live.** A script injected into the
  panel's WebView hides chosen tabs through the page's own Knockout view
  model, and the tabs stay hidden across close/reopen.
- **Resizing: blocked at the native host.** The panel's size is set by
  native code in `InputApp.dll`; changing XAML element sizes only scales the
  content inside a fixed 360x400 DIP island, which clips it.

## Process and threads

- The panel is drawn by `TextInputHost.exe`
  (`C:\Windows\SystemApps\MicrosoftWindows.Client.CBS_cw5n1h2txyewy`), not
  AppContainer. Its only top-level window is a full-screen
  `Windows.UI.Core.CoreWindow`, so the panel can't be resized as a window.
- UI Automation from another process can't see the panel (hit tests fall
  through to the window below), so in-process inspection is required.
- The process runs one XAML UI thread per experience, each a CoreWindow-less
  island with its own `XAMLMessageWindowClass` message-only window:
  dictation entry point, candidate window, input panel, touch keyboard, and
  the Win+V / Win+. panel (`ExpressiveSuggestionUIPage`).
- `Window.Current` doesn't reach the islands. XAML diagnostics
  (`InitializeXamlDiagnosticsEx`, as used by the Windhawk styler mods) does.

## Panel XAML (thread hosting `ExpressiveSuggestionUIPage`)

```
ScrollViewer (island root, set=360x400 by the host)
  … Frame > ContentPresenter
    InputApp.ExpressiveSuggestionUIPage  aname='Emoji and More menu'
      Grid #SuggestionUIGrid
        Grid (title row, 32 high): Grabber #Grabber, title text, #SuggestionUIContainerCloseButton
        Grid #SuggestionUIContainerGrid
          SuggestionUIUndocked.SuggestionUIContainer #SuggestionUIControl
            RelativePanel > Grid #WebUIRoot
              WebView (360x368, collapsed while the panel is hidden)
```

Only the title row is XAML. The tab strip and every tab's content live in
the `WebView`.

## Panel web content

- Engine: legacy EdgeHTML WebView in-process (`edgehtml.dll`, `chakra.dll`),
  so `WebView.InvokeScriptAsync("eval", …)` runs script in the page.
- Page: `https://inputsuggestions.msdxcdn.microsoft.com/_version_/WindowsInternal.ComposableShell.Experiences.SuggestionUI.min.html`.
  It is served remotely, so Microsoft can change it without a Windows update.
  The mod has to fail soft when selectors or view-model fields disappear.
- Framework: Knockout, global `ko`. The root view model is
  `ko.dataFor(document.getElementById('navigation-menu-container'))`.
- Tabs: `root.navigationMenuViewModel.navigationMenuItems`, ids `recent`,
  `search` (hidden by default), `emoji/…`, `gif/…`, `kaomoji/…`, `symbol/…`,
  `clipboard`. DOM: `#navigation-menu-item-container-<id>` with
  `data-navigation-item-id="<id>"`.
- Each item has `shouldBeHidden` (observable) and `isHidden` (computed from
  it). The template drops hidden items and updates `aria-setsize`, so
  keyboard navigation stays consistent.
- The page resets `shouldBeHidden` every time the panel is shown (8 resets
  seen in one close/reopen), so a one-shot change isn't enough.

### Verified tab-hiding technique

1. Add a `<style>` hiding `[id^="navigation-menu-item-container-<id>"]` so
   there's no flicker while the view model resets.
2. Set `shouldBeHidden(true)` on the target items, subscribe to each item's
   `shouldBeHidden` and to `navigationMenuItems`, and re-apply on every
   reset.
3. Keep the install idempotent (`window.__winvMod` holds the subscriptions)
   and re-run it whenever the WebView navigates.

Result: 4 of 6 tabs left with GIF and Kaomoji hidden, `aria-setsize=4`, and
the tabs stay hidden after closing and reopening the panel.

## Panel size

- The island root is sized by the host (`set=360x400`). The page receives its
  size from native through
  `viewDimensionsProvider.onContainerViewSizeInfoUpdated`
  (`totalViewWidth` / `totalViewHeight`); it never requests a size.
- Setting `Width`/`Height` on `ExpressiveSuggestionUIPage` and the `WebView`
  to 540x600 made the content larger, but the island stayed 360x400 and
  clipped it. Reverted.
- Native candidates, by string evidence: `InputApp.dll`
  (`ExpressiveSuggestionUIPage::ResetControlSize`,
  `ExpressiveSuggestionUIPage: OnAvailableSizeChanged`) and
  `WindowsInternal.ComposableShell.Experiences.SuggestionUIUndocked.dll`
  (`SuggestionUIContainer::OnWebViewSizeChanged`). Both ship public PDB
  names (`InputApp.pdb`, `…SuggestionUIUndocked.pdb`), so Windhawk symbol
  hooks (`WindhawkUtils::HookSymbols`) are the likely route. Finding the
  exact function and its arguments needs those PDBs.

## Safety lessons from the debug mod

- Creating a `DispatcherQueueTimer` (or walking the tree) inside the XAML
  diagnostics callback killed `TextInputHost` instantly, with no WER event,
  and Windows restarted it into a crash loop. The callback must only record
  elements; tree work runs later on the element's own thread
  (`SendMessageTimeout` to its `XAMLMessageWindowClass` window).
- `winrt::make_weak` on objects without `IWeakReferenceSource` dereferences
  null. Check first.
- A crash guard file stops re-attaching after a crash, so a bad build crashes
  at most once.
- Hot-reloading the mod (unadvise, then attach again in the same process)
  works.

## Unresolved questions

- Which native call sets the island to 360x400, and does it take a size the
  mod can scale before it's applied?
- Should a hidden tab still open when its shortcut is used (e.g. Win+. opens
  Emoji even if the Emoji tab is hidden)?
- Does the page's server-side version differ across machines or regions?
