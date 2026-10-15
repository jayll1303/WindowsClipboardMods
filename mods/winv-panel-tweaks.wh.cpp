// ==WindhawkMod==
// @id              winv-panel-tweaks
// @name            Win+V Panel Tweaks
// @description     Hide the tabs you don't use (Emoji, GIF, Kaomoji, Symbols, Most recently used) in the Win+V clipboard / Win+. emoji panel
// @version         0.1
// @author          jayll1303
// @github          https://github.com/jayll1303
// @include         TextInputHost.exe
// @architecture    x86-64
// @compilerOptions -lole32 -loleaut32 -lruntimeobject
// ==/WindhawkMod==

// ==WindhawkModReadme==
/*
# Win+V Panel Tweaks

The Win+V clipboard panel and the Win+. emoji panel are the same panel, with
tabs for Most recently used, Emoji, GIF, Kaomoji, Symbols and Clipboard. This
mod hides the tabs you turn off in its settings.

The Clipboard tab is always kept. Hiding a tab only removes its button: a
shortcut that opens a view directly still opens it (e.g. Win+. still opens
Emoji even when the Emoji tab is hidden).

## How it works

The panel is drawn by TextInputHost.exe. Its tab strip lives in a web page
hosted in a WebView inside the panel, so the mod finds that WebView through
XAML diagnostics and runs a small script in the page which marks the chosen
tabs as hidden in the page's own view model, re-applying it whenever the page
resets them.

Microsoft serves that page from its own servers and can change it at any time.
If the page changes in a way the mod doesn't recognize, the mod does nothing
and the panel keeps working as usual.

Tested on Windows 11 25H2 (build 26200).
*/
// ==/WindhawkModReadme==

// ==WindhawkModSettings==
/*
- hideRecent: false
  $name: Hide "Most recently used" tab
- hideEmoji: false
  $name: Hide "Emoji" tab
- hideGif: true
  $name: Hide "GIF" tab
- hideKaomoji: true
  $name: Hide "Kaomoji" tab
- hideSymbols: false
  $name: Hide "Symbols" tab
*/
// ==/WindhawkModSettings==

#include <windows.h>

#include <xamlom.h>

#include <atomic>
#include <mutex>
#include <set>
#include <string>
#include <vector>

#undef GetCurrentTime

#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.UI.Xaml.Controls.h>
#include <winrt/Windows.UI.Xaml.h>

namespace wf = winrt::Windows::Foundation;
namespace wux = winrt::Windows::UI::Xaml;
namespace wuxc = winrt::Windows::UI::Xaml::Controls;

////////////////////////////////////////////////////////////////////////////////
// Settings and the page script.

// Tab ids as the page names them (the part before any '/').
struct TabSetting {
    PCWSTR settingName;
    PCWSTR tabId;
};

constexpr TabSetting kTabSettings[] = {
    {L"hideRecent", L"recent"},   {L"hideEmoji", L"emoji"},
    {L"hideGif", L"gif"},         {L"hideKaomoji", L"kaomoji"},
    {L"hideSymbols", L"symbol"},
};

std::mutex g_settingsMutex;
std::wstring g_hiddenTabsJson = L"[]";

void LoadSettings() {
    std::wstring json = L"[";
    for (auto const& tab : kTabSettings) {
        if (Wh_GetIntSetting(tab.settingName)) {
            if (json.size() > 1) {
                json += L",";
            }
            json += L"'";
            json += tab.tabId;
            json += L"'";
        }
    }
    json += L"]";

    std::lock_guard lock(g_settingsMutex);
    g_hiddenTabsJson = json;
    Wh_Log(L"Hidden tabs: %s", json.c_str());
}

// Installs (or, with an empty list, removes) the tab hiding in the panel page.
// Idempotent: state lives in window.__winvPanelTweaks, and tabs this script
// hid but which are no longer listed are shown again. Waits for the page's
// Knockout bindings if they aren't ready yet, and gives up quietly if the page
// doesn't look as expected.
constexpr wchar_t kScriptTemplate[] = LR"JS((function (hidden) {
  var S = window.__winvPanelTweaks || (window.__winvPanelTweaks = { subs: [], changed: {} });
  S.subs.forEach(function (s) { s.dispose(); });
  S.subs = [];
  if (S.timer) { clearInterval(S.timer); S.timer = 0; }

  function baseId(id) { id = String(id || ''); var i = id.indexOf('/'); return i < 0 ? id : id.substring(0, i); }
  function isTarget(id) { return hidden.indexOf(baseId(id)) >= 0; }

  var style = document.getElementById('winv-panel-tweaks-style');
  if (hidden.length) {
    if (!style) {
      style = document.createElement('style');
      style.id = 'winv-panel-tweaks-style';
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = hidden.map(function (h) {
      return '[id^="navigation-menu-item-container-' + h + '"]{display:none!important}';
    }).join('\n');
  } else if (style) {
    style.parentNode.removeChild(style);
  }

  function install() {
    if (typeof ko === 'undefined') return false;
    var container = document.getElementById('navigation-menu-container');
    var root = container && ko.dataFor(container);
    var nav = root && root.navigationMenuViewModel;
    if (!nav || !nav.navigationMenuItems) return false;

    var itemSubs = [];
    function apply() {
      itemSubs.forEach(function (s) { s.dispose(); });
      itemSubs = [];
      (ko.unwrap(nav.navigationMenuItems) || []).forEach(function (item) {
        var flag = item.shouldBeHidden;
        if (!ko.isWriteableObservable(flag)) return;
        var id = baseId(ko.unwrap(item.id));
        if (isTarget(id)) {
          if (!flag.peek()) { flag(true); S.changed[id] = true; }
          itemSubs.push(flag.subscribe(function (v) { if (!v) flag(true); }));
        } else if (S.changed[id]) {
          flag(false);
          delete S.changed[id];
        }
      });
    }
    apply();
    S.subs.push({ dispose: function () { itemSubs.forEach(function (s) { s.dispose(); }); itemSubs = []; } });
    if (ko.isObservable(nav.navigationMenuItems)) {
      S.subs.push(nav.navigationMenuItems.subscribe(apply));
    }
    return true;
  }

  if (!install()) {
    var tries = 0;
    S.timer = setInterval(function () {
      if (install() || ++tries > 100) { clearInterval(S.timer); S.timer = 0; }
    }, 200);
    return 'waiting';
  }
  if (!hidden.length) {
    // Everything was shown again: drop the subscriptions and the state.
    S.subs.forEach(function (s) { s.dispose(); });
    delete window.__winvPanelTweaks;
    return 'removed';
  }
  return 'installed';
})(%HIDDEN%))JS";

std::wstring BuildScript(const std::wstring& hiddenTabsJson) {
    std::wstring script = kScriptTemplate;
    script.replace(script.find(L"%HIDDEN%"), 8, hiddenTabsJson);
    return script;
}

std::wstring CurrentScript() {
    std::lock_guard lock(g_settingsMutex);
    return BuildScript(g_hiddenTabsJson);
}

////////////////////////////////////////////////////////////////////////////////
// Per-thread WebView tracking. Runs on the XAML thread owning the WebViews.

std::atomic<bool> g_unloading;

// Script completions still to arrive; uninit waits for them so that no
// callback runs after the module is gone.
std::atomic<int> g_pendingScripts;

struct TrackedWebView {
    winrt::weak_ref<wuxc::WebView> webView;
    winrt::event_token navigationCompletedToken{};
};

struct ThreadState {
    // WebViews reported by XAML diagnostics, set up on the next dispatch so
    // that nothing touches XAML while it's in the middle of changing the tree.
    std::vector<winrt::weak_ref<wuxc::WebView>> pending;
    std::vector<TrackedWebView> tracked;
};

thread_local ThreadState* t_state;

std::mutex g_threadsMutex;
std::set<DWORD> g_threads;
// Signals the worker that some thread has WebViews pending.
HANDLE g_workEvent;

void RunScript(wuxc::WebView const& webView, const std::wstring& script) {
    try {
        auto op = webView.InvokeScriptAsync(L"eval", {winrt::hstring(script)});
        g_pendingScripts++;
        op.Completed([](auto const& op, wf::AsyncStatus status) {
            if (status == wf::AsyncStatus::Completed) {
                Wh_Log(L"Script result: %s", op.GetResults().c_str());
            } else if (status == wf::AsyncStatus::Error) {
                // Expected while the WebView has no page loaded yet.
                Wh_Log(L"Script error %08X", op.ErrorCode().value);
            }
            g_pendingScripts--;
        });
    } catch (...) {
        Wh_Log(L"InvokeScriptAsync error %08X", winrt::to_hresult());
    }
}

// Called from the XAML diagnostics callback: only records the element.
void RecordWebView(wf::IInspectable const& obj) {
    if (g_unloading) {
        return;
    }

    auto webView = obj.try_as<wuxc::WebView>();
    if (!webView) {
        return;
    }

    if (!t_state) {
        t_state = new ThreadState();
        std::lock_guard lock(g_threadsMutex);
        g_threads.insert(GetCurrentThreadId());
    }
    t_state->pending.push_back(winrt::make_weak(webView));
    SetEvent(g_workEvent);
}

void WINAPI SetUpPendingWebViews(PVOID) {
    if (!t_state || g_unloading) {
        return;
    }

    auto pending = std::move(t_state->pending);
    t_state->pending.clear();

    for (auto const& weakWebView : pending) {
        auto webView = weakWebView.get();
        if (!webView) {
            continue;
        }

        bool known = false;
        for (auto const& tracked : t_state->tracked) {
            if (tracked.webView.get() == webView) {
                known = true;
                break;
            }
        }
        if (known) {
            continue;
        }

        try {
            TrackedWebView tracked;
            tracked.webView = weakWebView;
            tracked.navigationCompletedToken = webView.NavigationCompleted(
                [](wuxc::WebView const& sender, auto const&) {
                    if (!g_unloading) {
                        RunScript(sender, CurrentScript());
                    }
                });
            t_state->tracked.push_back(tracked);
            Wh_Log(L"Tracking a WebView on thread %u", GetCurrentThreadId());
        } catch (...) {
            Wh_Log(L"NavigationCompleted error %08X", winrt::to_hresult());
        }

        // The page may already be loaded.
        RunScript(webView, CurrentScript());
    }
}

void WINAPI ApplyScriptToTrackedWebViews(PVOID param) {
    if (!t_state) {
        return;
    }
    const std::wstring& script = *static_cast<const std::wstring*>(param);
    for (auto const& tracked : t_state->tracked) {
        if (auto webView = tracked.webView.get()) {
            RunScript(webView, script);
        }
    }
}

void WINAPI ForgetCurrentThread(PVOID) {
    if (!t_state) {
        return;
    }
    for (auto const& tracked : t_state->tracked) {
        if (auto webView = tracked.webView.get()) {
            try {
                webView.NavigationCompleted(tracked.navigationCompletedToken);
            } catch (...) {
            }
        }
    }
    delete t_state;
    t_state = nullptr;
}

////////////////////////////////////////////////////////////////////////////////
// XAML diagnostics attachment (TAP), the same mechanism the Windhawk styler
// mods use.

// Windows.UI.Xaml.dll skips creating composition diagnostics, which corrupt
// the heap when several UI threads add visuals, if it reads
// HKLM\Software\Microsoft\XAML\Debug\DisableCompositionDiag as 1 while
// AdviseVisualTreeChange runs.
thread_local bool g_reportCompositionDiagAsDisabled;

HMODULE GetCurrentModuleHandle() {
    HMODULE module;
    if (!GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                               GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                           L"", &module)) {
        return nullptr;
    }
    return module;
}

class VisualTreeWatcher
    : public winrt::implements<VisualTreeWatcher,
                               IVisualTreeServiceCallback2,
                               winrt::non_agile> {
   public:
    explicit VisualTreeWatcher(winrt::com_ptr<IUnknown> site)
        : m_xamlDiagnostics(site.as<IXamlDiagnostics>()) {
        // Advising from the TAP's thread can hang, so it's done from a new one.
        AddRef();
        HANDLE thread = CreateThread(
            nullptr, 0,
            [](LPVOID param) -> DWORD {
                auto watcher = reinterpret_cast<VisualTreeWatcher*>(param);
                auto service =
                    watcher->m_xamlDiagnostics.as<IVisualTreeService3>();
                g_reportCompositionDiagAsDisabled = true;
                HRESULT hr = service->AdviseVisualTreeChange(watcher);
                g_reportCompositionDiagAsDisabled = false;
                if (FAILED(hr)) {
                    Wh_Log(L"AdviseVisualTreeChange error %08X", hr);
                }
                watcher->Release();
                return 0;
            },
            this, 0, nullptr);
        if (thread) {
            CloseHandle(thread);
        } else {
            Release();
        }
    }

    void Unadvise() {
        HRESULT hr = m_xamlDiagnostics.as<IVisualTreeService3>()
                         ->UnadviseVisualTreeChange(this);
        if (FAILED(hr)) {
            Wh_Log(L"UnadviseVisualTreeChange error %08X", hr);
        }
    }

   private:
    // Keep this light: doing XAML work here (walking the tree, creating
    // timers) while XAML is mid-change kills TextInputHost.
    HRESULT STDMETHODCALLTYPE
    OnVisualTreeChange(ParentChildRelation,
                       VisualElement element,
                       VisualMutationType mutationType) override {
        if (mutationType != Add || !element.Type ||
            wcscmp(element.Type, L"Windows.UI.Xaml.Controls.WebView") != 0) {
            return S_OK;
        }
        try {
            wf::IInspectable obj;
            winrt::check_hresult(m_xamlDiagnostics->GetIInspectableFromHandle(
                element.Handle,
                reinterpret_cast<::IInspectable**>(winrt::put_abi(obj))));
            RecordWebView(obj);
        } catch (...) {
            Wh_Log(L"OnVisualTreeChange error %08X", winrt::to_hresult());
        }
        // Returning an error stops further notifications.
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE OnElementStateChanged(InstanceHandle,
                                                    VisualElementState,
                                                    LPCWSTR) noexcept override {
        return S_OK;
    }

    winrt::com_ptr<IXamlDiagnostics> m_xamlDiagnostics;
};

winrt::com_ptr<VisualTreeWatcher> g_visualTreeWatcher;

// {4E3B0C71-8A5F-4D2E-B6C9-1F7A2D9E5B34}
static constexpr CLSID CLSID_WinvPanelTweaksTAP = {
    0x4e3b0c71,
    0x8a5f,
    0x4d2e,
    {0xb6, 0xc9, 0x1f, 0x7a, 0x2d, 0x9e, 0x5b, 0x34}};

class WinvPanelTweaksTAP : public winrt::implements<WinvPanelTweaksTAP,
                                                    IObjectWithSite,
                                                    winrt::non_agile> {
   public:
    HRESULT STDMETHODCALLTYPE SetSite(IUnknown* pUnkSite) override try {
        if (g_visualTreeWatcher) {
            g_visualTreeWatcher->Unadvise();
            g_visualTreeWatcher = nullptr;
        }

        m_site.copy_from(pUnkSite);
        if (m_site) {
            // Balance the reference InitializeXamlDiagnosticsEx took on the
            // module.
            FreeLibrary(GetCurrentModuleHandle());
            g_visualTreeWatcher = winrt::make_self<VisualTreeWatcher>(m_site);
        }
        return S_OK;
    } catch (...) {
        return winrt::to_hresult();
    }

    HRESULT STDMETHODCALLTYPE GetSite(REFIID riid,
                                      void** ppvSite) noexcept override {
        return m_site.as(riid, ppvSite);
    }

   private:
    winrt::com_ptr<IUnknown> m_site;
};

template <class T>
struct SimpleFactory
    : winrt::implements<SimpleFactory<T>, IClassFactory, winrt::non_agile> {
    HRESULT STDMETHODCALLTYPE CreateInstance(IUnknown* pUnkOuter,
                                             REFIID riid,
                                             void** ppvObject) override try {
        if (pUnkOuter) {
            return CLASS_E_NOAGGREGATION;
        }
        *ppvObject = nullptr;
        return winrt::make<T>().as(riid, ppvObject);
    } catch (...) {
        return winrt::to_hresult();
    }

    HRESULT STDMETHODCALLTYPE LockServer(BOOL) noexcept override { return S_OK; }
};

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdll-attribute-on-redeclaration"

__declspec(dllexport) _Use_decl_annotations_ STDAPI
    DllGetClassObject(REFCLSID rclsid, REFIID riid, LPVOID* ppv) try {
    if (rclsid != CLSID_WinvPanelTweaksTAP) {
        return CLASS_E_CLASSNOTAVAILABLE;
    }
    *ppv = nullptr;
    return winrt::make<SimpleFactory<WinvPanelTweaksTAP>>().as(riid, ppv);
} catch (...) {
    return winrt::to_hresult();
}

__declspec(dllexport) _Use_decl_annotations_ STDAPI DllCanUnloadNow() {
    return winrt::get_module_lock() ? S_FALSE : S_OK;
}

#pragma clang diagnostic pop

HRESULT InjectTAP() noexcept {
    HMODULE module = GetCurrentModuleHandle();
    if (!module) {
        return HRESULT_FROM_WIN32(GetLastError());
    }

    WCHAR location[MAX_PATH];
    switch (GetModuleFileName(module, location, ARRAYSIZE(location))) {
        case 0:
        case ARRAYSIZE(location):
            return HRESULT_FROM_WIN32(GetLastError());
    }

    HMODULE wux = LoadLibraryEx(L"Windows.UI.Xaml.dll", nullptr,
                                LOAD_LIBRARY_SEARCH_SYSTEM32);
    if (!wux) {
        return HRESULT_FROM_WIN32(GetLastError());
    }

    auto ixde = reinterpret_cast<decltype(&InitializeXamlDiagnosticsEx)>(
        GetProcAddress(wux, "InitializeXamlDiagnosticsEx"));
    if (!ixde) {
        return HRESULT_FROM_WIN32(GetLastError());
    }

    // The connection name isn't known, so try them in order until one exists.
    HRESULT hr = E_FAIL;
    for (int i = 0; i < 10000; i++) {
        WCHAR connectionName[256];
        wsprintf(connectionName, L"VisualDiagConnection%d", i + 1);
        hr = ixde(connectionName, GetCurrentProcessId(), L"", location,
                  CLSID_WinvPanelTweaksTAP, nullptr);
        if (hr != HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) {
            break;
        }
    }
    return hr;
}

////////////////////////////////////////////////////////////////////////////////
// Registry hooks answering the DisableCompositionDiag read.

using RegOpenKeyExW_t = decltype(&RegOpenKeyExW);
RegOpenKeyExW_t RegOpenKeyExW_Original;
LSTATUS WINAPI RegOpenKeyExW_Hook(HKEY hKey,
                                  LPCWSTR lpSubKey,
                                  DWORD ulOptions,
                                  REGSAM samDesired,
                                  PHKEY phkResult) {
    LSTATUS result = RegOpenKeyExW_Original(hKey, lpSubKey, ulOptions,
                                            samDesired, phkResult);
    if (result == ERROR_SUCCESS || !g_reportCompositionDiagAsDisabled ||
        hKey != HKEY_LOCAL_MACHINE || !lpSubKey ||
        _wcsicmp(lpSubKey, L"Software\\Microsoft\\XAML\\Debug") != 0) {
        return result;
    }
    // The value is only queried if the key opens, so hand out one that exists.
    return RegOpenKeyExW_Original(HKEY_LOCAL_MACHINE, L"Software\\Microsoft",
                                  ulOptions, samDesired, phkResult);
}

using RegQueryValueExW_t = decltype(&RegQueryValueExW);
RegQueryValueExW_t RegQueryValueExW_Original;
LSTATUS WINAPI RegQueryValueExW_Hook(HKEY hKey,
                                     LPCWSTR lpValueName,
                                     LPDWORD lpReserved,
                                     LPDWORD lpType,
                                     LPBYTE lpData,
                                     LPDWORD lpcbData) {
    if (!g_reportCompositionDiagAsDisabled || !lpValueName ||
        _wcsicmp(lpValueName, L"DisableCompositionDiag") != 0) {
        return RegQueryValueExW_Original(hKey, lpValueName, lpReserved, lpType,
                                         lpData, lpcbData);
    }

    if (lpType) {
        *lpType = REG_DWORD;
    }
    if (lpData && (!lpcbData || *lpcbData < sizeof(DWORD))) {
        if (lpcbData) {
            *lpcbData = sizeof(DWORD);
        }
        return ERROR_MORE_DATA;
    }
    if (lpData) {
        *reinterpret_cast<DWORD*>(lpData) = 1;
    }
    if (lpcbData) {
        *lpcbData = sizeof(DWORD);
    }
    return ERROR_SUCCESS;
}

////////////////////////////////////////////////////////////////////////////////
// Running code on the XAML threads.

using RunFromWindowThreadProc_t = void(WINAPI*)(PVOID parameter);

// Runs proc synchronously on hWnd's thread. Gives up after a few seconds if
// the thread doesn't respond, rather than hanging the caller.
bool RunFromWindowThread(HWND hWnd,
                         RunFromWindowThreadProc_t proc,
                         PVOID procParam) {
    static const UINT runFromWindowThreadRegisteredMsg =
        RegisterWindowMessage(L"Windhawk_RunFromWindowThread_" WH_MOD_ID);

    struct RUN_FROM_WINDOW_THREAD_PARAM {
        RunFromWindowThreadProc_t proc;
        PVOID procParam;
    };

    DWORD dwThreadId = GetWindowThreadProcessId(hWnd, nullptr);
    if (dwThreadId == 0) {
        return false;
    }

    if (dwThreadId == GetCurrentThreadId()) {
        proc(procParam);
        return true;
    }

    HHOOK hook = SetWindowsHookEx(
        WH_CALLWNDPROC,
        [](int nCode, WPARAM wParam, LPARAM lParam) -> LRESULT {
            if (nCode == HC_ACTION) {
                const CWPSTRUCT* cwp = (const CWPSTRUCT*)lParam;
                if (cwp->message == runFromWindowThreadRegisteredMsg) {
                    RUN_FROM_WINDOW_THREAD_PARAM* param =
                        (RUN_FROM_WINDOW_THREAD_PARAM*)cwp->lParam;
                    param->proc(param->procParam);
                }
            }
            return CallNextHookEx(nullptr, nCode, wParam, lParam);
        },
        nullptr, dwThreadId);
    if (!hook) {
        return false;
    }

    RUN_FROM_WINDOW_THREAD_PARAM param{proc, procParam};
    DWORD_PTR result;
    bool ok = SendMessageTimeout(hWnd, runFromWindowThreadRegisteredMsg, 0,
                                 (LPARAM)&param, SMTO_ABORTIFHUNG, 5000,
                                 &result) != 0;
    UnhookWindowsHookEx(hook);
    return ok;
}

// Every XAML UI thread owns a message-only XAMLMessageWindowClass window, which
// is a reliable way to reach the thread.
HWND FindXamlMessageWindow(DWORD threadId) {
    HWND hWnd = nullptr;
    while ((hWnd = FindWindowEx(HWND_MESSAGE, hWnd, L"XAMLMessageWindowClass",
                                nullptr))) {
        if (GetWindowThreadProcessId(hWnd, nullptr) == threadId) {
            return hWnd;
        }
    }
    return nullptr;
}

void RunOnEachTrackedThread(RunFromWindowThreadProc_t proc,
                            PVOID param = nullptr) {
    std::set<DWORD> threads;
    {
        std::lock_guard lock(g_threadsMutex);
        threads = g_threads;
    }
    for (DWORD threadId : threads) {
        if (HWND hWnd = FindXamlMessageWindow(threadId)) {
            if (!RunFromWindowThread(hWnd, proc, param)) {
                Wh_Log(L"Thread %u didn't respond", threadId);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////
// Worker: attaches diagnostics (retrying while XAML starts up), then sets up
// WebViews as they're reported.

constexpr int kInjectAttempts = 90;
constexpr DWORD kInjectRetryMs = 2000;

HANDLE g_stopEvent;
HANDLE g_workerThread;

DWORD WINAPI WorkerThread(LPVOID) {
    HRESULT hr = HRESULT_FROM_WIN32(ERROR_NOT_FOUND);
    for (int i = 0; i < kInjectAttempts; i++) {
        if (i > 0 && WaitForSingleObject(g_stopEvent, kInjectRetryMs) !=
                         WAIT_TIMEOUT) {
            return 0;
        }
        // Right after the process starts, XAML hasn't created its
        // diagnostics connection yet.
        hr = InjectTAP();
        if (hr != HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) {
            break;
        }
    }
    Wh_Log(L"InjectTAP result %08X", hr);
    if (FAILED(hr)) {
        return 0;
    }

    HANDLE events[] = {g_stopEvent, g_workEvent};
    while (WaitForMultipleObjects(ARRAYSIZE(events), events, FALSE,
                                  INFINITE) == WAIT_OBJECT_0 + 1) {
        RunOnEachTrackedThread(SetUpPendingWebViews);
    }
    return 0;
}

////////////////////////////////////////////////////////////////////////////////

BOOL Wh_ModInit() {
    Wh_Log(L">");

    LoadSettings();

    g_stopEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);
    g_workEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);

    HMODULE kernelBase = GetModuleHandle(L"kernelbase.dll");
    Wh_SetFunctionHook((void*)GetProcAddress(kernelBase, "RegOpenKeyExW"),
                       (void*)RegOpenKeyExW_Hook,
                       (void**)&RegOpenKeyExW_Original);
    Wh_SetFunctionHook((void*)GetProcAddress(kernelBase, "RegQueryValueExW"),
                       (void*)RegQueryValueExW_Hook,
                       (void**)&RegQueryValueExW_Original);
    return TRUE;
}

void Wh_ModAfterInit() {
    Wh_Log(L">");
    g_workerThread = CreateThread(nullptr, 0, WorkerThread, nullptr, 0, nullptr);
}

void Wh_ModSettingsChanged() {
    Wh_Log(L">");
    LoadSettings();
    std::wstring script = CurrentScript();
    RunOnEachTrackedThread(ApplyScriptToTrackedWebViews, &script);
}

void Wh_ModUninit() {
    Wh_Log(L">");
    g_unloading = true;

    if (g_workerThread) {
        SetEvent(g_stopEvent);
        WaitForSingleObject(g_workerThread, INFINITE);
        CloseHandle(g_workerThread);
        g_workerThread = nullptr;
    }

    if (g_visualTreeWatcher) {
        g_visualTreeWatcher->Unadvise();
        g_visualTreeWatcher = nullptr;
    }

    // Show every tab again.
    std::wstring restoreScript = BuildScript(L"[]");
    RunOnEachTrackedThread(ApplyScriptToTrackedWebViews, &restoreScript);

    // Script completions call into this module; give them a moment to land.
    for (int i = 0; i < 40 && g_pendingScripts > 0; i++) {
        Sleep(50);
    }

    RunOnEachTrackedThread(ForgetCurrentThread);

    CloseHandle(g_workEvent);
    CloseHandle(g_stopEvent);
}
