import Foundation
import CoreImage
import CoreGraphics
import ImageIO
import Vision
import UniformTypeIdentifiers
let args = CommandLine.arguments
if args[1] == "generate" {
    let filter = CIFilter(name: "CIQRCodeGenerator")!
    filter.setValue(Data(args[2].utf8), forKey: "inputMessage")
    filter.setValue("Q", forKey: "inputCorrectionLevel")
    let code = filter.outputImage!
    let image = CIContext(options: [.useSoftwareRenderer: true]).createCGImage(code, from: code.extent)!
    let scale = 10, border = 4
    let width = (image.width + border * 2) * scale
    let context = CGContext(data: nil, width: width, height: width, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: width))
    context.interpolationQuality = .none
    context.draw(image, in: CGRect(x: border * scale, y: border * scale, width: image.width * scale, height: image.height * scale))
    let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[3]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, context.makeImage()!, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("Could not save QR") }
    print("Saved accurate QR with quiet zone: \(width)x\(width)")
} else {
    for path in args.dropFirst(2) {
        let request = VNDetectBarcodesRequest()
        request.symbologies = [.qr]
        try VNImageRequestHandler(url: URL(fileURLWithPath: path)).perform([request])
        let values = (request.results ?? []).compactMap { $0.payloadStringValue }
        let json = try JSONSerialization.data(withJSONObject: ["file": path, "payloads": values], options: [.sortedKeys])
        print(String(data: json, encoding: .utf8)!)
    }
}
