import SwiftUI

/// First launch: pair. After that: the board.
struct RootView: View {
    @State private var pairing: Pairing? = Keychain.load()

    var body: some View {
        if let p = pairing {
            BoardScreen(pairing: p) {
                Keychain.clear()
                pairing = nil
            }
        } else {
            PairView { p in
                Keychain.save(p)
                pairing = p
            }
        }
    }
}

struct PairView: View {
    var onPaired: (Pairing) -> Void
    @State private var scanning = false
    @State private var typing = false
    @State private var address = ""
    @State private var key = ""
    @State private var message = ""

    private var canPair: Bool {
        Pairing.boardURL(address) != nil
            && !key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Text("AI-gile").font(.largeTitle).bold()
            Text("On your computer open Setup, Phone, Pair the app, then scan the QR here.")
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
            Button("Scan the pairing QR") { message = ""; scanning = true }
                .buttonStyle(.borderedProminent)
            Button("Type the address") { message = ""; typing = true }
            if !message.isEmpty {
                Text(message).foregroundColor(.red).multilineTextAlignment(.center)
            }
            Spacer()
        }
        .padding(24)
        .sheet(isPresented: $scanning) {
            ScannerView(onCode: { text in
                scanning = false
                if let p = Pairing.parse(qr: text) {
                    onPaired(p)
                } else {
                    message = "That QR is not an AI-gile pairing code."
                }
            }, onFail: { reason in
                scanning = false
                message = reason
            })
        }
        .sheet(isPresented: $typing) {
            NavigationView {
                Form {
                    Section(header: Text("Board address")) {
                        TextField("pc.tailnet.ts.net", text: $address)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled(true)
                            .keyboardType(.URL)
                    }
                    Section(header: Text("Device key")) {
                        SecureField("Key from Pair the app", text: $key)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled(true)
                    }
                }
                .navigationTitle("Type the address")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { typing = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Pair") {
                            if let url = Pairing.boardURL(address) {
                                typing = false
                                onPaired(Pairing(url: url, id: "",
                                                 key: key.trimmingCharacters(in: .whitespacesAndNewlines)))
                            }
                        }
                        .disabled(!canPair)
                    }
                }
            }
        }
    }
}
