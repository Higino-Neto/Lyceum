import UIKit
import Capacitor

final class IncomingBookStore {
    static let shared = IncomingBookStore()

    private var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let folder = base.appendingPathComponent("IncomingBooks", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    func importURL(_ source: URL) {
        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }
        let safeName = source.lastPathComponent.replacingOccurrences(of: "__", with: "_")
        let destination = directory.appendingPathComponent("\(UUID().uuidString)__\(safeName)")
        do {
            try FileManager.default.copyItem(at: source, to: destination)
        } catch {
            NSLog("Lyceum could not stage incoming book: \(error.localizedDescription)")
        }
    }

    func pending() -> [URL] {
        (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        )) ?? []
    }

    func remove(_ url: URL) {
        try? FileManager.default.removeItem(at: url)
    }

    func displayName(for url: URL) -> String {
        let name = url.lastPathComponent
        guard let separator = name.range(of: "__") else { return name }
        return String(name[separator.upperBound...])
    }
}

@objc(IncomingBooksPlugin)
public class IncomingBooksPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IncomingBooksPlugin"
    public let jsName = "IncomingBooks"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPendingFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelRead", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise),
    ]
    private var cancelledRequests = Set<String>()
    private let cancellationQueue = DispatchQueue(label: "com.higino.lyceum.incoming.cancel")

    public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(incomingBookReceived),
            name: Notification.Name("LyceumIncomingBook"),
            object: nil
        )
    }

    @objc private func incomingBookReceived() {
        notifyListeners("incomingFiles", data: ["count": IncomingBookStore.shared.pending().count], retainUntilConsumed: true)
    }

    private func description(for url: URL) -> JSObject {
        let values = try? url.resourceValues(forKeys: [.fileSizeKey])
        return [
            "uri": url.absoluteString,
            "name": IncomingBookStore.shared.displayName(for: url),
            "size": values?.fileSize ?? 0,
            "mimeType": mimeType(for: url),
        ]
    }

    private func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "pdf": return "application/pdf"
        case "epub": return "application/epub+zip"
        case "txt": return "text/plain"
        default: return "application/octet-stream"
        }
    }

    @objc func getPendingFiles(_ call: CAPPluginCall) {
        call.resolve(["files": IncomingBookStore.shared.pending().map { description(for: $0) }])
    }

    @objc func readFile(_ call: CAPPluginCall) {
        guard let uri = call.getString("uri"), let url = URL(string: uri) else {
            call.reject("URI do arquivo ausente")
            return
        }
        let requestId = call.getString("requestId") ?? uri
        cancellationQueue.sync { cancelledRequests.remove(requestId) }
        DispatchQueue.global(qos: .userInitiated).async {
            guard let stream = InputStream(url: url) else {
                call.reject("Arquivo indisponivel")
                return
            }
            stream.open()
            defer { stream.close() }
            let total = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            var data = Data()
            var buffer = [UInt8](repeating: 0, count: 128 * 1024)
            while stream.hasBytesAvailable {
                if self.cancellationQueue.sync(execute: { self.cancelledRequests.contains(requestId) }) {
                    call.reject("Importacao cancelada", "IMPORT_CANCELLED")
                    return
                }
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count < 0 {
                    call.reject("Falha ao ler arquivo compartilhado")
                    return
                }
                if count == 0 { break }
                data.append(contentsOf: buffer[0..<count])
                self.notifyListeners("importProgress", data: [
                    "requestId": requestId,
                    "loaded": data.count,
                    "total": total,
                ])
            }
            call.resolve(["base64": data.base64EncodedString()])
        }
    }

    @objc func cancelRead(_ call: CAPPluginCall) {
        if let requestId = call.getString("requestId") {
            cancellationQueue.sync { cancelledRequests.insert(requestId) }
        }
        call.resolve()
    }

    @objc func acknowledge(_ call: CAPPluginCall) {
        if let uri = call.getString("uri"), let url = URL(string: uri) {
            IncomingBookStore.shared.remove(url)
        }
        call.resolve()
    }
}

class ViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IncomingBooksPlugin())
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if let url = launchOptions?[.url] as? URL {
            IncomingBookStore.shared.importURL(url)
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        IncomingBookStore.shared.importURL(url)
        NotificationCenter.default.post(name: Notification.Name("LyceumIncomingBook"), object: nil)
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
