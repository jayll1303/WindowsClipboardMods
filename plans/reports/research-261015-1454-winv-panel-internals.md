# Win+V panel internals (Windows 11 25H2, build 26200.9711)

Research for a Windhawk mod that resizes the Win+V clipboard panel and hides
its tabs (Emoji, GIF, Kaomoji, Symbols, …). Evidence was collected with the
debug mod [`mods/winv-xaml-dump.wh.cpp`](../../mods/winv-xaml-dump.wh.cpp).

## Outcome

- **Hiding tabs: solved and verified live.** A script injected into the
  panel's WebView hides chosen tabs through the page's own Knockout view
  model, and the tabs stay hidden across close/reopen.
- **Resizing: solved and verified live.** The size is set by native code in
  `InputApp.dll`. Changing XAML element sizes only scales content inside the
  fixed island, which clips it. Hooking
  `ExpressiveSuggestionUIPage::ResetControlSize` by symbol resizes the panel
  itself. Width and height scale separately; 150% x 150% and each axis at
  50% and 300% (the setting limits) were checked visually and displayed
  correctly. See "Panel size" below.

Both are implemented in [`mods/winv-panel-tweaks.wh.cpp`](../../mods/winv-panel-tweaks.wh.cpp).

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
  That host doesn't resolve publicly; the WebView maps it to a local package,
  `WindowsInternal.ComposableShell.Experiences.SuggestionUIUndocked\app.appx`
  (a zip) under the InpApp SystemApps folder. The script is
  `app/WindowsInternal.ComposableShell.Experiences.SuggestionUI.min.js`.
  `SuggestionUIUndocked.dll` also references
  `…/%%version%%/app.appx`, `config.json` and `version.json` on the same host,
  and the page can take down deprecated package versions, so the web app can
  be updated outside Windows updates. The mod has to fail soft when selectors
  or view-model fields disappear.
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
- The size comes from
  `private: void __cdecl WindowsInternal::ComposableShell::Experiences::TextInputUndocked::InputApp::ExpressiveSuggestionUIPage::ResetControlSize(class Windows::Foundation::Size)`
  in `InputApp.dll` (public PDB `InputApp.pdb`, GUID
  `E98787A4B6DF4D9AABC6771261165F0C`, age 1 on this build). Disassembly
  (dbgeng on the image with the downloaded PDB) shows:
  - `Size.Width < 0` means "default": width is the constant 360.0f and
    height is a page virtual method (the 32 DIP title row) plus the constant
    368.0, i.e. 360x400.
  - Otherwise the given `Size` is used.
  - Either way, width and height are capped (`minss`) by the
    `TextInputViewAvailableSize` looked up for the requested position type,
    written into a 0xAC-byte `SizePositionInfo` (offsets +4/+8 and
    +0xC/+0x10), and passed to
    `IViewPositionAndSizeManager::TrySetPositionAndSize`, which sizes the
    island.
- Scaling the `Size` argument in a hook (default case replaced by
  360x400 times the factor) resizes the island; the WebView and page reflow
  to fill it. The availability cap still keeps the panel on screen.
- The page then scales its content up with the panel.
  `ViewDimensionsProvider.onContainerViewSizeInfoUpdated(info)` sets
  `scalingInfo` to `viewWidthFactor = totalViewWidth / 360` and
  `expandedViewFactor = (totalViewHeight - collapsedViewHeight) / 360`
  (`totalViewWidth`/`totalViewHeight` are the web content size in DIPs,
  360x368 by default). `refreshCssVariables` publishes `expandedViewFactor`
  as `--expanded-view-scale-ratio`, which the CSS multiplies into most sizes
  (text, padding, item heights), and GIF/thumbnail sizes use it too.
- To keep the content at its normal scale, the page script overrides
  `onContainerViewSizeInfoUpdated` on the provider instance and passes it the
  default content size (360 x `collapsedViewHeight` + 368). The rest of the
  page, including `refreshCssVariables`, still gets the real size, so the
  lists fill the bigger panel and show more items. Verified at 200% height:
  clipboard items keep their size and more of them fit.
- `InputApp.dll` is normally loaded after Windhawk injects the mod, so the
  mod hooks it from `LoadLibraryExW` when it appears.

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

- What `Size` do the callers of `ResetControlSize` pass in practice (default
  or explicit)? The mod logs it; only the visual result has been checked.
- Should a hidden tab still open when its shortcut is used (e.g. Win+. opens
  Emoji even if the Emoji tab is hidden)?
- How often is `app.appx` updated outside Windows updates, and does its
  version differ across machines or regions?
