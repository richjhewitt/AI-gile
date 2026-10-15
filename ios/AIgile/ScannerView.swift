import SwiftUI
import AVFoundation

/// Camera QR scanner. Calls onCode once with the first QR text it reads.
struct ScannerView: UIViewControllerRepresentable {
    var onCode: (String) -> Void
    var onFail: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let c = ScannerController()
        c.onCode = onCode
        c.onFail = onFail
        return c
    }

    func updateUIViewController(_ uiViewController: ScannerController, context: Context) {}
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    var onFail: ((String) -> Void)?
    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private var done = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            setUp()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { ok in
                DispatchQueue.main.async {
                    if ok { self.setUp() } else { self.fail("Camera access is off. Type the address instead.") }
                }
            }
        default:
            fail("Camera access is off. Allow it in Settings, or type the address instead.")
        }
    }

    private func setUp() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            fail("No camera found. Type the address instead.")
            return
        }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else {
            fail("The camera cannot scan here. Type the address instead.")
            return
        }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        preview = layer
        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning { session.stopRunning() }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard !done,
              let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let text = obj.stringValue else { return }
        done = true
        onCode?(text)
    }

    private func fail(_ reason: String) {
        guard !done else { return }
        done = true
        onFail?(reason)
    }
}
