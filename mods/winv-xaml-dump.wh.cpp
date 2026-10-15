// ==WindhawkMod==
// @id              winv-xaml-dump
// @name            Win+V XAML Tree Dump (debug)
// @description     Dumps the XAML visual trees of TextInputHost.exe (Win+V / emoji panel) to %TEMP%\winv-xaml for mod development
// @version         0.7
// @author          tienthichdoc
// @include         TextInputHost.exe
// @architecture    x86-64
// @compilerOptions -lole32 -loleaut32 -lruntimeobject
// ==/WindhawkMod==

// ==WindhawkModReadme==
/*
# Win+V XAML Tree Dump (debug)

Development helper. TextInputHost.exe (the process that draws the Win+V
clipboard / emoji panel) hosts several XAML UI threads, most of them without a
CoreWindow. The mod attaches XAML diagnostics to learn about elements on every
thread. A worker thread then asks each XAML thread every 1.5 seconds to walk
its trees, and whenever a thread's visible tree changes a new dump is written:

`%TEMP%\winv-xaml\dump-<n>-t<thread id>.txt` (at most 80 files per session)

Each line shows the element type, x:Name, automation name, text, actual size,
explicit size, visibility and position relative to its root. The panel's
content is an EdgeHTML WebView; whenever its page changes it is serialized to
`%TEMP%\winv-xaml\webview-<n>.html`, with long text and attribute values
replaced by their length so clipboard contents aren't written. Experiment
commands can be written to `%TEMP%\winv-xaml\cmd.txt` (see the comment above
ExecCommandOnCurrentThread); their results go to `results.txt`. A log is kept in
`%TEMP%\winv-xaml\log.txt`.

Crash guard: if TextInputHost dies within 10 seconds of the diagnostics being
attached, later starts of the process skip attaching until
`%TEMP%\winv-xaml\attach-guard` is deleted.
*/
// ==/WindhawkModReadme==

#include <windows.h>

#include <xamlom.h>

#include <atomic>
#include <chrono>
#include <cmath>
#include <map>
#include <mutex>
#include <string>
#include <vector>

#undef GetCurrentTime

#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.UI.Xaml.Automation.h>
#include <winrt/Windows.UI.Xaml.Controls.Primitives.h>
#include <winrt/Windows.UI.Xaml.Controls.h>
#include <winrt/Windows.UI.Xaml.Media.h>
#include <winrt/Windows.UI.Xaml.h>

namespace wf = winrt::Windows::Foundation;
namespace wux = winrt::Windows::UI::Xaml;
namespace wuxc = winrt::Windows::UI::Xaml::Controls;
namespace wuxm = winrt::Windows::UI::Xaml::Media;

constexpr int kMaxDepth = 80;
constexpr size_t kMaxElements = 20000;
constexpr int kMaxDumps = 80;
constexpr DWORD kDumpIntervalMs = 1500;
constexpr int kInjectAttempts = 90;
constexpr DWORD kInjectRetryMs = 2000;
// Attaching is considered safe once the process survived this long.
constexpr ULONGLONG kGuardClearMs = 10000;

std::atomic<bool> g_unloading;
HANDLE g_stopEvent;
HANDLE g_workerThread;

// Ids of the XAML threads elements were reported from.
std::mutex g_threadsMutex;
std::map<DWORD, bool> g_threads;
std::atomic<int> g_dumpCount;

////////////////////////////////////////////////////////////////////////////////
// Files and logging. Windhawk logging is off by default, so everything is also
// appended to %TEMP%\winv-xaml\log.txt.

std::wstring DumpDir() {
    WCHAR temp[MAX_PATH];
    GetTempPathW(ARRAYSIZE(temp), temp);
    std::wstring dir = std::wstring(temp) + L"winv-xaml";
    CreateDirectoryW(dir.c_str(), nullptr);
    return dir;
}

void WriteUtf8File(const std::wstring& path,
                   const std::wstring& text,
                   bool append) {
    int size = WideCharToMultiByte(CP_UTF8, 0, text.c_str(), (int)text.size(),
                                   nullptr, 0, nullptr, nullptr);
    std::string utf8(size, '\0');
    WideCharToMultiByte(CP_UTF8, 0, text.c_str(), (int)text.size(), utf8.data(),
                        size, nullptr, nullptr);
    HANDLE file = CreateFileW(
        path.c_str(), append ? FILE_APPEND_DATA : GENERIC_WRITE,
        FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
        append ? OPEN_ALWAYS : CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) {
        return;
    }
    DWORD written;
    WriteFile(file, utf8.data(), (DWORD)utf8.size(), &written, nullptr);
    CloseHandle(file);
}

std::mutex g_logMutex;

void FileLog(PCWSTR format, ...) {
    WCHAR message[1024];
    va_list args;
    va_start(args, format);
    _vsnwprintf_s(message, _TRUNCATE, format, args);
    va_end(args);

    WCHAR line[1100];
    SYSTEMTIME st;
    GetLocalTime(&st);
    swprintf_s(line, L"%02d:%02d:%02d.%03d [%u:%u] %s\r\n", st.wHour,
               st.wMinute, st.wSecond, st.wMilliseconds, GetCurrentProcessId(),
               GetCurrentThreadId(), message);

    std::lock_guard lock(g_logMutex);
    WriteUtf8File(DumpDir() + L"\\log.txt", line, true);
}

#define LOG(...)              \
    do {                      \
        Wh_Log(__VA_ARGS__);  \
        FileLog(__VA_ARGS__); \
    } while (0)

std::wstring GuardPath() {
    return DumpDir() + L"\\attach-guard";
}

// Milliseconds since the guard file was written, or 0 if there is none.
ULONGLONG GuardAgeMs() {
    WIN32_FILE_ATTRIBUTE_DATA data;
    if (!GetFileAttributesExW(GuardPath().c_str(), GetFileExInfoStandard,
                              &data)) {
        return 0;
    }
    FILETIME now;
    GetSystemTimeAsFileTime(&now);
    ULARGE_INTEGER a{{now.dwLowDateTime, now.dwHighDateTime}};
    ULARGE_INTEGER b{{data.ftLastWriteTime.dwLowDateTime,
                      data.ftLastWriteTime.dwHighDateTime}};
    return a.QuadPart > b.QuadPart ? (a.QuadPart - b.QuadPart) / 10000 + 1 : 1;
}

////////////////////////////////////////////////////////////////////////////////
// Per-thread tracking and dumping. Runs on the UI thread owning the elements.

struct ThreadState {
    // Elements reported by diagnostics, resolved to roots on the next dump so
    // that nothing walks the tree while XAML is in the middle of changing it.
    std::vector<winrt::weak_ref<wux::UIElement>> pending;
    std::vector<winrt::weak_ref<wux::UIElement>> roots;
    std::wstring lastSignature;
    size_t lastHtmlHash = 0;
    int reported = 0;
};

thread_local ThreadState* t_state;

// Script completions still to arrive; uninit waits for them so that no
// callback runs after the module is gone.
std::atomic<int> g_pendingScripts;
std::atomic<int> g_domDumpCount;

// Serializes the page with long text and long attribute values replaced by
// their length, so clipboard contents never reach the dump.
constexpr wchar_t kDomScript[] = LR"JS((function () {
  var c = document.documentElement.cloneNode(true);
  var w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, null, false);
  var n;
  while ((n = w.nextNode())) {
    var t = n.nodeValue;
    if (n.parentNode && n.parentNode.nodeName === 'STYLE') continue;
    if (t.trim().length > 24) n.nodeValue = '[text ' + t.length + ']';
  }
  var els = c.getElementsByTagName('*');
  for (var i = 0; i < els.length; i++) {
    var e = els[i];
    if (e.nodeName === 'SCRIPT' && !e.src) e.text = '[inline script ' + e.text.length + ']';
    for (var j = 0; j < e.attributes.length; j++) {
      var a = e.attributes[j];
      if (a.value.indexOf('data:') === 0) a.value = 'data:...';
      else if (a.name !== 'class' && a.name !== 'id' && a.name !== 'style' && a.value.length > 40)
        a.value = '[attr ' + a.value.length + ']';
    }
  }
  var h = c.outerHTML;
  return location.href + '\n' + h.length + '\n' + h.substring(0, 400000);
})())JS";

void DumpWebViewDom(wuxc::WebView const& webView) {
    if (g_domDumpCount >= kMaxDumps) {
        return;
    }

    auto op = webView.InvokeScriptAsync(L"eval", {winrt::hstring(kDomScript)});
    g_pendingScripts++;
    op.Completed([](auto const& op, wf::AsyncStatus status) {
        try {
            if (status != wf::AsyncStatus::Completed) {
                LOG(L"DOM script status %d", (int)status);
            } else if (t_state && !g_unloading) {
                std::wstring html = op.GetResults().c_str();
                size_t hash = std::hash<std::wstring>{}(html);
                if (hash != t_state->lastHtmlHash) {
                    t_state->lastHtmlHash = hash;
                    int n = ++g_domDumpCount;
                    std::wstring path =
                        DumpDir() + L"\\webview-" + std::to_wstring(n) + L".html";
                    WriteUtf8File(path, html, false);
                    LOG(L"Wrote %s (%zu chars)", path.c_str(), html.size());
                }
            }
        } catch (...) {
            LOG(L"DOM script error %08X", winrt::to_hresult());
        }
        g_pendingScripts--;
    });
}

// Called from the diagnostics callback: only records the element.
void RecordElement(wf::IInspectable const& obj, PCWSTR typeName) {
    if (g_unloading) {
        return;
    }

    if (!t_state) {
        t_state = new ThreadState();
        std::lock_guard lock(g_threadsMutex);
        g_threads[GetCurrentThreadId()] = true;
    }

    if (t_state->reported++ < 3) {
        LOG(L"Reported element %d: %s", t_state->reported, typeName);
    }

    auto element = obj.try_as<wux::UIElement>();
    // make_weak dereferences null for objects without weak reference support
    // instead of failing, so those are skipped.
    if (!element || !element.try_as<winrt::impl::IWeakReferenceSource>()) {
        return;
    }
    t_state->pending.push_back(winrt::make_weak(element));
}

void ResolvePendingRoots() {
    auto pending = std::move(t_state->pending);
    t_state->pending.clear();

    for (auto const& weakElement : pending) {
        auto element = weakElement.get();
        if (!element) {
            continue;
        }

        wux::DependencyObject top = element;
        while (auto parent = wuxm::VisualTreeHelper::GetParent(top)) {
            top = parent;
        }

        auto root = top.try_as<wux::UIElement>();
        if (!root || !root.try_as<winrt::impl::IWeakReferenceSource>()) {
            continue;
        }

        bool known = false;
        for (auto it = t_state->roots.begin(); it != t_state->roots.end();) {
            auto existing = it->get();
            if (!existing) {
                it = t_state->roots.erase(it);
                continue;
            }
            if (existing == root) {
                known = true;
                break;
            }
            ++it;
        }
        if (!known) {
            t_state->roots.push_back(winrt::make_weak(root));
        }
    }
}

std::wstring OneLine(std::wstring s) {
    for (auto& c : s) {
        if (c == L'\r' || c == L'\n' || c == L'\t') {
            c = L' ';
        }
    }
    if (s.size() > 60) {
        s = s.substr(0, 60) + L"...";
    }
    return s;
}

struct DumpState {
    std::wstring text;
    std::wstring signature;
    size_t count = 0;
    std::vector<wuxc::WebView> webViews;
};

void DumpElement(wux::DependencyObject const& obj,
                 wux::UIElement const& root,
                 int depth,
                 DumpState& state) {
    if (state.count++ >= kMaxElements) {
        return;
    }

    std::wstring line(depth * 2, L' ');
    line += winrt::get_class_name(obj).c_str();

    bool visible = true;
    if (auto fe = obj.try_as<wux::FrameworkElement>()) {
        auto name = fe.Name();
        if (!name.empty()) {
            line += L" #";
            line += name.c_str();
        }

        auto automationName = wux::Automation::AutomationProperties::GetName(fe);
        if (!automationName.empty()) {
            line += L" aname='" + OneLine(automationName.c_str()) + L"'";
        }

        if (auto tb = fe.try_as<wuxc::TextBlock>()) {
            line += L" text='" + OneLine(tb.Text().c_str()) + L"'";
        }

        visible = fe.Visibility() == wux::Visibility::Visible;
        WCHAR buf[160];
        swprintf_s(buf, L" size=%.0fx%.0f", fe.ActualWidth(), fe.ActualHeight());
        line += buf;
        if (!std::isnan(fe.Width()) || !std::isnan(fe.Height())) {
            swprintf_s(buf, L" set=%.0fx%.0f", fe.Width(), fe.Height());
            line += buf;
        }
        if (!visible) {
            line += L" COLLAPSED";
        }
        if (visible && fe.ActualWidth() > 0) {
            try {
                auto pt = fe.TransformToVisual(root).TransformPoint({0, 0});
                swprintf_s(buf, L" at=%.0f,%.0f", pt.X, pt.Y);
                line += buf;
            } catch (...) {
            }

            state.signature += winrt::get_class_name(obj).c_str();
            state.signature += name.c_str();
            state.signature += L'|';

            if (auto webView = fe.try_as<wuxc::WebView>()) {
                state.webViews.push_back(webView);
            }
        }
    }

    state.text += line;
    state.text += L'\n';

    if (!visible || depth >= kMaxDepth) {
        return;
    }

    int n = wuxm::VisualTreeHelper::GetChildrenCount(obj);
    for (int i = 0; i < n; i++) {
        DumpElement(wuxm::VisualTreeHelper::GetChild(obj, i), root, depth + 1,
                    state);
    }
}

void WINAPI DumpOnCurrentThread(PVOID) {
    if (!t_state || g_unloading) {
        return;
    }

    try {
        ResolvePendingRoots();

        DumpState state;
        for (auto const& weakRoot : t_state->roots) {
            auto root = weakRoot.get();
            // Subtrees reported before being attached have no XamlRoot; they
            // show up again under their real root once attached.
            if (!root || !root.XamlRoot()) {
                continue;
            }
            state.text += L"=== Root\n";
            DumpElement(root, root, 0, state);
        }

        // The page inside can change (e.g. switching tabs) without any XAML
        // change, so web views are checked on every tick.
        for (auto const& webView : state.webViews) {
            DumpWebViewDom(webView);
        }

        if (state.signature == t_state->lastSignature) {
            return;
        }
        t_state->lastSignature = state.signature;

        int n = ++g_dumpCount;
        if (n > kMaxDumps) {
            return;
        }

        std::wstring path = DumpDir() + L"\\dump-" + std::to_wstring(n) +
                            L"-t" + std::to_wstring(GetCurrentThreadId()) +
                            L".txt";
        WriteUtf8File(path, state.text, false);
        LOG(L"Wrote %s (%zu elements, %zu roots)", path.c_str(), state.count,
            t_state->roots.size());
    } catch (...) {
        LOG(L"Dump error %08X", winrt::to_hresult());
    }
}

void WINAPI ForgetCurrentThread(PVOID) {
    delete t_state;
    t_state = nullptr;
}

////////////////////////////////////////////////////////////////////////////////
// Experiment commands, read from %TEMP%\winv-xaml\cmd.txt (one per line):
//   js <script>                    eval in every visible WebView
//   set <selector> <prop> <value>  set a property on matching elements
//   dump                           force fresh tree and DOM dumps
// <selector> is #Name or a type name (full, or the part after the last dot).
// <prop> is Width, Height, MinWidth, MinHeight, MaxWidth, MaxHeight (number
// or auto), Scale (number), Opacity (number) or Visibility (Visible or
// Collapsed). Results are appended to results.txt.

std::atomic<int> g_resultCount;

void AppendResult(const std::wstring& text) {
    std::lock_guard lock(g_logMutex);
    WriteUtf8File(DumpDir() + L"\\results.txt", text + L"\r\n", true);
}

template <typename F>
void ForEachElement(wux::DependencyObject const& obj, int depth, F&& f) {
    f(obj);
    if (depth >= kMaxDepth) {
        return;
    }
    int n = wuxm::VisualTreeHelper::GetChildrenCount(obj);
    for (int i = 0; i < n; i++) {
        ForEachElement(wuxm::VisualTreeHelper::GetChild(obj, i), depth + 1, f);
    }
}

template <typename F>
void ForEachThreadElement(F&& f) {
    for (auto const& weakRoot : t_state->roots) {
        auto root = weakRoot.get();
        if (root && root.XamlRoot()) {
            ForEachElement(root, 0, f);
        }
    }
}

bool MatchesSelector(wux::DependencyObject const& obj,
                     std::wstring_view selector) {
    if (selector.starts_with(L'#')) {
        auto fe = obj.try_as<wux::FrameworkElement>();
        return fe && fe.Name() == selector.substr(1);
    }
    std::wstring_view className = winrt::get_class_name(obj);
    if (className == selector) {
        return true;
    }
    auto dot = className.rfind(L'.');
    return dot != className.npos && className.substr(dot + 1) == selector;
}

double ParseLength(const std::wstring& value) {
    return value == L"auto" ? std::nan("") : _wtof(value.c_str());
}

bool SetProperty(wux::FrameworkElement const& fe,
                 const std::wstring& prop,
                 const std::wstring& value) {
    if (prop == L"Width") {
        fe.Width(ParseLength(value));
    } else if (prop == L"Height") {
        fe.Height(ParseLength(value));
    } else if (prop == L"MinWidth") {
        fe.MinWidth(ParseLength(value));
    } else if (prop == L"MinHeight") {
        fe.MinHeight(ParseLength(value));
    } else if (prop == L"MaxWidth") {
        fe.MaxWidth(value == L"auto" ? INFINITY : _wtof(value.c_str()));
    } else if (prop == L"MaxHeight") {
        fe.MaxHeight(value == L"auto" ? INFINITY : _wtof(value.c_str()));
    } else if (prop == L"Opacity") {
        fe.Opacity(_wtof(value.c_str()));
    } else if (prop == L"Visibility") {
        fe.Visibility(value == L"Collapsed" ? wux::Visibility::Collapsed
                                            : wux::Visibility::Visible);
    } else if (prop == L"Scale") {
        wuxm::ScaleTransform scale;
        scale.ScaleX(_wtof(value.c_str()));
        scale.ScaleY(_wtof(value.c_str()));
        fe.RenderTransform(scale);
    } else {
        return false;
    }
    return true;
}

void RunJs(const std::wstring& script) {
    std::vector<wuxc::WebView> webViews;
    ForEachThreadElement([&](wux::DependencyObject const& obj) {
        auto webView = obj.try_as<wuxc::WebView>();
        if (webView && webView.Visibility() == wux::Visibility::Visible) {
            webViews.push_back(webView);
        }
    });

    for (auto const& webView : webViews) {
        int n = ++g_resultCount;
        auto op = webView.InvokeScriptAsync(L"eval", {winrt::hstring(script)});
        g_pendingScripts++;
        op.Completed([n](auto const& op, wf::AsyncStatus status) {
            try {
                if (status == wf::AsyncStatus::Completed) {
                    AppendResult(L"[js " + std::to_wstring(n) + L"] " +
                                 op.GetResults().c_str());
                } else {
                    AppendResult(L"[js " + std::to_wstring(n) +
                                 L"] status " +
                                 std::to_wstring((int)status) + L" hr " +
                                 std::to_wstring(op.ErrorCode().value));
                }
            } catch (...) {
                AppendResult(L"[js " + std::to_wstring(n) + L"] error " +
                             std::to_wstring(winrt::to_hresult().value));
            }
            g_pendingScripts--;
        });
    }
}

void WINAPI ExecCommandOnCurrentThread(PVOID param) {
    if (!t_state || g_unloading) {
        return;
    }
    const std::wstring& command = *static_cast<const std::wstring*>(param);

    try {
        ResolvePendingRoots();

        if (command.starts_with(L"js ")) {
            RunJs(command.substr(3));
        } else if (command == L"dump") {
            t_state->lastSignature.clear();
            t_state->lastHtmlHash = 0;
        } else if (command.starts_with(L"set ")) {
            std::wstring selector, prop, value;
            size_t a = command.find(L' ', 4);
            size_t b = a == command.npos ? a : command.find(L' ', a + 1);
            if (b == command.npos) {
                AppendResult(L"[set] usage: set <selector> <prop> <value>");
                return;
            }
            selector = command.substr(4, a - 4);
            prop = command.substr(a + 1, b - a - 1);
            value = command.substr(b + 1);

            int matched = 0;
            ForEachThreadElement([&](wux::DependencyObject const& obj) {
                if (!MatchesSelector(obj, selector)) {
                    return;
                }
                if (auto fe = obj.try_as<wux::FrameworkElement>()) {
                    if (SetProperty(fe, prop, value)) {
                        matched++;
                    }
                }
            });
            if (matched) {
                AppendResult(L"[set] thread " +
                             std::to_wstring(GetCurrentThreadId()) + L": " +
                             command + L" -> " + std::to_wstring(matched) +
                             L" element(s)");
            }
        }
    } catch (...) {
        AppendResult(L"[" + command + L"] error " +
                     std::to_wstring(winrt::to_hresult().value));
    }
}

std::wstring ReadUtf8File(const std::wstring& path) {
    HANDLE file = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ,
                              nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL,
                              nullptr);
    if (file == INVALID_HANDLE_VALUE) {
        return {};
    }
    std::string utf8(GetFileSize(file, nullptr), '\0');
    DWORD read = 0;
    ReadFile(file, utf8.data(), (DWORD)utf8.size(), &read, nullptr);
    CloseHandle(file);
    utf8.resize(read);
    if (utf8.starts_with("\xEF\xBB\xBF")) {
        utf8.erase(0, 3);
    }
    int size = MultiByteToWideChar(CP_UTF8, 0, utf8.data(), (int)utf8.size(),
                                   nullptr, 0);
    std::wstring text(size, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, utf8.data(), (int)utf8.size(), text.data(),
                        size);
    return text;
}

// Takes the pending commands, one per line, and removes the file.
std::vector<std::wstring> TakeCommands() {
    std::wstring path = DumpDir() + L"\\cmd.txt";
    std::wstring text = ReadUtf8File(path);
    if (text.empty()) {
        return {};
    }
    DeleteFileW(path.c_str());

    std::vector<std::wstring> commands;
    size_t start = 0;
    while (start < text.size()) {
        size_t end = text.find(L'\n', start);
        if (end == text.npos) {
            end = text.size();
        }
        std::wstring line = text.substr(start, end - start);
        while (!line.empty() && (line.back() == L'\r' || line.back() == L' ')) {
            line.pop_back();
        }
        if (!line.empty()) {
            commands.push_back(line);
        }
        start = end + 1;
    }
    return commands;
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
                LOG(L"AdviseVisualTreeChange start");
                g_reportCompositionDiagAsDisabled = true;
                HRESULT hr = service->AdviseVisualTreeChange(watcher);
                g_reportCompositionDiagAsDisabled = false;
                LOG(L"AdviseVisualTreeChange returned %08X", hr);
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
        LOG(L"UnadviseVisualTreeChange returned %08X", hr);
    }

   private:
    HRESULT STDMETHODCALLTYPE
    OnVisualTreeChange(ParentChildRelation,
                       VisualElement element,
                       VisualMutationType mutationType) override {
        if (mutationType != Add) {
            return S_OK;
        }
        try {
            wf::IInspectable obj;
            winrt::check_hresult(m_xamlDiagnostics->GetIInspectableFromHandle(
                element.Handle,
                reinterpret_cast<::IInspectable**>(winrt::put_abi(obj))));
            RecordElement(obj, element.Type ? element.Type : L"?");
        } catch (...) {
            LOG(L"OnVisualTreeChange error %08X", winrt::to_hresult());
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

// {9C1B6F4E-2D7A-4C55-9E1B-6A3F0D8B7C21}
static constexpr CLSID CLSID_WinvDumpTAP = {
    0x9c1b6f4e,
    0x2d7a,
    0x4c55,
    {0x9e, 0x1b, 0x6a, 0x3f, 0x0d, 0x8b, 0x7c, 0x21}};

class WinvDumpTAP
    : public winrt::implements<WinvDumpTAP, IObjectWithSite, winrt::non_agile> {
   public:
    HRESULT STDMETHODCALLTYPE SetSite(IUnknown* pUnkSite) override try {
        LOG(L"TAP SetSite %p", pUnkSite);
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
    if (rclsid != CLSID_WinvDumpTAP) {
        return CLASS_E_CLASSNOTAVAILABLE;
    }
    *ppv = nullptr;
    return winrt::make<SimpleFactory<WinvDumpTAP>>().as(riid, ppv);
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
                  CLSID_WinvDumpTAP, nullptr);
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

void RunOnEachXamlThread(RunFromWindowThreadProc_t proc, PVOID param = nullptr) {
    std::map<DWORD, bool> threads;
    {
        std::lock_guard lock(g_threadsMutex);
        threads = g_threads;
    }
    for (auto const& [threadId, _] : threads) {
        if (HWND hWnd = FindXamlMessageWindow(threadId)) {
            if (!RunFromWindowThread(hWnd, proc, param)) {
                LOG(L"Thread %u didn't respond", threadId);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////
// Worker: attaches diagnostics (retrying while XAML starts up), then drives
// the periodic dumps.

DWORD WINAPI WorkerThread(LPVOID) {
    // A guard left behind means the previous attach killed the process.
    if (ULONGLONG guardAge = GuardAgeMs()) {
        LOG(L"Previous attach (%llu ms ago) didn't survive, not attaching; "
            L"delete attach-guard to retry",
            guardAge);
        return 0;
    }

    HRESULT hr = HRESULT_FROM_WIN32(ERROR_NOT_FOUND);
    for (int i = 0; i < kInjectAttempts; i++) {
        if (i > 0 && WaitForSingleObject(g_stopEvent, kInjectRetryMs) !=
                         WAIT_TIMEOUT) {
            return 0;
        }
        WriteUtf8File(GuardPath(), L"attaching", false);
        hr = InjectTAP();
        if (hr != HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) {
            break;
        }
        DeleteFileW(GuardPath().c_str());
    }
    LOG(L"InjectTAP result %08X", hr);
    if (FAILED(hr)) {
        DeleteFileW(GuardPath().c_str());
        return 0;
    }

    ULONGLONG attachedAt = GetTickCount64();
    bool guardCleared = false;
    while (WaitForSingleObject(g_stopEvent, kDumpIntervalMs) == WAIT_TIMEOUT) {
        if (!guardCleared && GetTickCount64() - attachedAt > kGuardClearMs) {
            DeleteFileW(GuardPath().c_str());
            guardCleared = true;
            LOG(L"Survived %llu ms after attaching", kGuardClearMs);
        }
        for (auto const& command : TakeCommands()) {
            LOG(L"Command: %s", command.c_str());
            RunOnEachXamlThread(ExecCommandOnCurrentThread, (PVOID)&command);
        }
        RunOnEachXamlThread(DumpOnCurrentThread);
    }
    return 0;
}

////////////////////////////////////////////////////////////////////////////////

BOOL Wh_ModInit() {
    LOG(L"Init");
    g_stopEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);

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
    g_workerThread = CreateThread(nullptr, 0, WorkerThread, nullptr, 0, nullptr);
}

void Wh_ModUninit() {
    LOG(L"Uninit");
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

    // Script completions call into this module; give them a moment to land.
    for (int i = 0; i < 40 && g_pendingScripts > 0; i++) {
        Sleep(50);
    }
    RunOnEachXamlThread(ForgetCurrentThread);
    DeleteFileW(GuardPath().c_str());
}
