import Foundation

@main
struct WakeAudioTests {
    // Deterministic decaying bursts mixed into a steady background. The
    // detector receives ordinary PCM in the same chunks a microphone supplies.
    static func replay(_ times: [Double], amplitude: Double = 0.14, duration: Double = 0.002,
                       sensitivity: Double = 0.45, double: Bool = true, rate: Int = 48000,
                       chunk: Int = 1024, stride: Int = 1, background: Double = 0.002, standby: Bool = true) -> Int {
        let settings = WakeSettings(["wakeEnabled": true, "wakeMode": double ? "double" : "single",
                                     "wakeThreshold": sensitivity, "standby": standby])
        var detector = ImpulseWakeDetector(sampleRate: Double(rate))
        let starts = times.map { Int($0 * Double(rate)) }
        let total = (starts.last ?? rate) + rate / 3
        var offset = 0
        var wakes = 0
        while offset < total {
            let frames = min(chunk, total - offset)
            var pcm = [Float](repeating: 0.9, count: frames * stride)
            for i in 0..<frames {
                let frame = offset + i
                var value = background * sin(2 * Double.pi * 250 * Double(frame) / Double(rate))
                for start in starts {
                    let age = Double(frame - start) / Double(rate)
                    if age >= 0 && age < duration {
                        value += amplitude * exp(-4 * age / duration) * cos(2 * Double.pi * 2500 * age)
                    }
                }
                pcm[i * stride] = Float(value)
            }
            if pcm.withUnsafeBufferPointer({ detector.consume($0.baseAddress!, count: frames, stride: stride, settings: settings) }) {
                wakes += 1
            }
            offset += frames
        }
        return wakes
    }

    static func main() {
        for rate in [16000, 44100, 48000] {
            for chunk in [256, 1024, 4096] {
                precondition(replay([0.3098, 0.6198], rate: rate, chunk: chunk) == 1, "Quiet double snap")
                precondition(replay([0.4, 0.9], amplitude: 0.35, duration: 0.045, rate: rate, chunk: chunk) == 1, "Double clap")
            }
        }
        precondition(replay([0.3], standby: false) == 1, "One clap puts active Aster to sleep")
        precondition(replay([0.3], standby: true) == 0, "One clap does not wake Aster in double mode")
        precondition(replay([0.3, 0.39]) == 0, "Echo")
        precondition(replay([0.3, 1.7]) == 0, "Expired pair")
        precondition(replay([0.3, 1.7, 2.0]) == 1, "Fresh pair after timeout")
        precondition(replay([0.3, 0.6, 0.9, 1.2]) == 1, "Repeated wake")
        precondition(replay([0.3], amplitude: 0.055, sensitivity: 0.2, double: false, stride: 2) == 1, "High sensitivity")
        precondition(replay([0.3], amplitude: 0.055, sensitivity: 0.7, double: false) == 0, "Low sensitivity")
        precondition(replay([], double: false, background: 0.12) == 0, "Steady tone")
    }
}
