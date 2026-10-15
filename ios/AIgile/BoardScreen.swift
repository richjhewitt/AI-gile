import SwiftUI
import WebKit

/// The board's phone pages in a web view, with pull to refresh and a plain offline message.
struct BoardScreen: View {
    let pairing: Pairing
    var onForget: () -> Void
    @State private var offline = false
    @State private var reloadTick = 0
    @State private var confirmForget = false

    var body: some View {
        ZStack {
            BoardWebView(pairing: pairing, offline: $offline, reloadTick: reloadTick)
                .ignoresSafeArea(edges: .bottom)
            if offline {
                VStack(spacing: 16) {
                    Text("You are offline, or the board is not reachable.")
                        .multilineTextAlignment(.center)
                    Button("Try again") { offline = false; reloadTick += 1 }
                        .buttonStyle(.borderedProminent)
                    Button("Pair again") { confirmForget = true }
                }
                .padding(24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(.systemBackground))
            }
        }
        .alert("Forget this board?", isPresented: $confirmForget) {
            Button("Forget", role: .destructive) { onForget() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The saved address and key are removed from this phone.")
        }
    }
}

struct BoardWebView: UIViewRepresentable {
    let pairing: Pairing
    @Binding var offline: Bool
    let reloadTick: Int

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Every request of the page goes through the proxy, which adds the Bearer key.
        config.setURLSchemeHandler(context.coordinator.proxy, forURLScheme: BoardProxy.scheme)
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.pulled(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh
        context.coordinator.web = web
        context.coordinator.load()
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        context.coordinator.parent = self
        if context.coordinator.lastTick != reloadTick {
            context.coordinator.lastTick = reloadTick
            context.coordinator.load()
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var parent: BoardWebView
        var web: WKWebView?
        var lastTick: Int
        let proxy: BoardProxy

        init(_ parent: BoardWebView) {
            self.parent = parent
            self.lastTick = parent.reloadTick
            self.proxy = BoardProxy(pairing: parent.pairing)
            super.init()
        }

        func load() {
            guard let web = web, let start = proxy.pageURL(for: "/") else { return }
            web.load(URLRequest(url: start))
        }

        @objc func pulled(_ sender: UIRefreshControl) {
            if web?.url == nil { load() } else { web?.reload() }
        }

        private func finish(offline: Bool) {
            web?.scrollView.refreshControl?.endRefreshing()
            DispatchQueue.main.async { self.parent.offline = offline }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finish(offline: false) }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            finish(offline: true)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) {
            finish(offline: true)
        }

        // Links to other sites open in Safari; the board stays in the app.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, let scheme = url.scheme?.lowercased(),
               scheme == "http" || scheme == "https" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
