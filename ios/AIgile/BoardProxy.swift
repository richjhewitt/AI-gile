import Foundation
import WebKit

/// The board answers only requests that carry the device key, and a web view cannot add a header to the
/// page's scripts and pictures. So the page lives on a private scheme (aigile-app://<host>/...) and this
/// handler repeats each request to https://<host>/... with `Authorization: Bearer <key>`.
/// It sends no Origin, which is what the board expects from the app.
final class BoardProxy: NSObject, WKURLSchemeHandler, URLSessionDataDelegate {
    static let scheme = "aigile-app"

    private let pairing: Pairing
    private var session: URLSession!
    private var tasks: [Int: WKURLSchemeTask] = [:]   // URLSession task id -> web view task

    init(pairing: Pairing) {
        self.pairing = pairing
        super.init()
        // Delegate callbacks come on the main queue, which WKURLSchemeTask requires.
        session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
    }

    /// aigile-app://<host><path> for a path on the board.
    func pageURL(for path: String) -> URL? {
        guard let host = pairing.url.host else { return nil }
        var c = URLComponents()
        c.scheme = BoardProxy.scheme
        c.host = host
        c.port = pairing.url.port
        c.percentEncodedPath = path
        return c.url
    }

    private func boardURL(from page: URL) -> URL? {
        guard var c = URLComponents(url: page, resolvingAgainstBaseURL: false),
              c.host == pairing.url.host else { return nil }   // never send the key to another host
        c.scheme = "https"
        return c.url
    }

    // MARK: WKURLSchemeHandler

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let original = urlSchemeTask.request
        guard let page = original.url, let target = boardURL(from: page) else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var req = URLRequest(url: target)
        req.httpMethod = original.httpMethod
        req.httpBody = original.httpBody
        req.timeoutInterval = 30
        for (name, value) in original.allHTTPHeaderFields ?? [:] {
            let n = name.lowercased()
            if n == "origin" || n == "referer" || n == "authorization" || n == "host" { continue }
            req.setValue(value, forHTTPHeaderField: name)
        }
        req.setValue("Bearer " + pairing.key, forHTTPHeaderField: "Authorization")
        let task = session.dataTask(with: req)
        tasks[task.taskIdentifier] = urlSchemeTask
        task.resume()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        let ids = tasks.filter { $0.value === urlSchemeTask }.map { $0.key }
        for id in ids {
            tasks[id] = nil
            session.getAllTasks { all in
                all.first { $0.taskIdentifier == id }?.cancel()
            }
        }
    }

    // MARK: URLSessionDataDelegate

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask,
                    didReceive response: URLResponse,
                    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        if let t = tasks[dataTask.taskIdentifier], let http = response as? HTTPURLResponse,
           let page = t.request.url {
            var headers: [String: String] = [:]
            for (k, v) in http.allHeaderFields {
                guard let name = k as? String, let value = v as? String else { continue }
                let n = name.lowercased()
                // The data arrives already decoded.
                if n == "content-encoding" || n == "content-length" || n == "set-cookie" { continue }
                headers[name] = value
            }
            let out = HTTPURLResponse(url: page, statusCode: http.statusCode,
                                      httpVersion: "HTTP/1.1", headerFields: headers)
            t.didReceive(out ?? response)
        }
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        tasks[dataTask.taskIdentifier]?.didReceive(data)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let t = tasks.removeValue(forKey: task.taskIdentifier) else { return }
        if let error = error { t.didFailWithError(error) } else { t.didFinish() }
    }

    // Redirects stay on the board and keep the key; any other host gets nothing.
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        if request.url?.host == pairing.url.host {
            var r = request
            r.setValue("Bearer " + pairing.key, forHTTPHeaderField: "Authorization")
            completionHandler(r)
        } else {
            completionHandler(nil)
        }
    }
}
