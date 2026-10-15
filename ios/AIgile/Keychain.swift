import Foundation
import Security

/// The paired board: its https address, device id and device key.
struct Pairing: Equatable {
    var url: URL
    var id: String
    var key: String

    /// Reads the pairing QR text: aigile://pair?url=<https url>&id=<d>&key=<K>
    /// (id is optional for older boards).
    static func parse(qr text: String) -> Pairing? {
        guard let c = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
              c.scheme == "aigile", c.host == "pair" else { return nil }
        let items = c.queryItems ?? []
        func value(_ name: String) -> String? { items.first { $0.name == name }?.value }
        guard let u = value("url"), let key = value("key"), !key.isEmpty,
              let url = Pairing.boardURL(u) else { return nil }
        return Pairing(url: url, id: value("id") ?? "", key: key)
    }

    /// Typed addresses: "pc.tailnet.ts.net" or "https://pc.tailnet.ts.net". Always https.
    static func boardURL(_ text: String) -> URL? {
        var s = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.lowercased().hasPrefix("http://") { s = String(s.dropFirst(7)) }
        if s.lowercased().hasPrefix("https://") { s = String(s.dropFirst(8)) }
        while s.hasSuffix("/") { s.removeLast() }
        guard !s.isEmpty, !s.contains(" "), let url = URL(string: "https://" + s),
              url.host != nil else { return nil }
        return url
    }
}

/// Stores the pairing in the Keychain (this device only, after first unlock).
enum Keychain {
    private static let service = "lol.aigile.app"
    private static let account = "pairing"

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    static func save(_ p: Pairing) {
        let payload: [String: String] = ["url": p.url.absoluteString, "id": p.id, "key": p.key]
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }

    static func load() -> Pairing? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess,
              let data = out as? Data,
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String],
              let u = obj["url"], let url = URL(string: u), let key = obj["key"] else { return nil }
        return Pairing(url: url, id: obj["id"] ?? "", key: key)
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
    }
}
