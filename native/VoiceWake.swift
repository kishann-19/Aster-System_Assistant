import Foundation

struct WakeSettings: Equatable {
    let enabled: Bool
    let double: Bool
    let standby: Bool
    let threshold: Double

    init(_ command: [String: Any]) {
        enabled = command["wakeEnabled"] as? Bool ?? false
        standby = command["standby"] as? Bool ?? true
        double = standby && command["wakeMode"] as? String != "single"
        threshold = max(0.15, min(0.85, command["wakeThreshold"] as? Double ?? 0.45))
    }
}

// Settings arrive on the main thread. The tap takes one snapshot per buffer.
final class WakePreferences {
    private let lock = NSLock()
    private var settings = WakeSettings([:])

    func set(_ value: WakeSettings) {
        lock.lock()
        settings = value
        lock.unlock()
    }

    func get() -> WakeSettings {
        lock.lock()
        defer { lock.unlock() }
        return settings
    }
}

struct ImpulseWakeDetector {
    private let windowFrames: Int
    private let sampleRate: Double
    private var frames = 0
    private var elapsedFrames = 0
    private var peak = 0.0
    private var energy = 0.0
    private var noise = 0.003
    private var previousLevel = 0.003
    private var lastImpulse = -10.0
    private var firstImpulse: Double?
    private var lastWake = -10.0

    init(sampleRate: Double) {
        self.sampleRate = sampleRate
        windowFrames = max(1, Int((sampleRate * 0.01).rounded()))
    }

    // Short windows span tap boundaries so a snap is measured the same way
    // regardless of the buffer size chosen by Core Audio.
    mutating func consume(_ samples: UnsafePointer<Float>, count: Int, stride: Int, settings: WakeSettings) -> Bool {
        var woke = false
        for index in 0..<count {
            let value = Double(samples[index * stride])
            peak = max(peak, abs(value))
            energy += value * value
            frames += 1
            if frames == windowFrames {
                elapsedFrames += frames
                if evaluate(settings) { woke = true }
                frames = 0
                peak = 0
                energy = 0
            }
        }
        return woke
    }

    private mutating func evaluate(_ settings: WakeSettings) -> Bool {
        let now = Double(elapsedFrames) / sampleRate
        let rms = sqrt(energy / Double(windowFrames))
        let baseline = noise
        let prior = previousLevel
        noise += 0.025 * (min(rms, max(0.012, baseline * 3)) - baseline)
        previousLevel = rms
        let minPeak = 0.018 + 0.30 * settings.threshold * settings.threshold
        guard peak >= max(minPeak, baseline * 7),
              rms >= max(0.001, baseline * 1.8, prior * 1.5),
              peak >= rms * 1.7,
              now - lastImpulse >= 0.12, now - lastWake >= 8 else { return false }
        if let first = firstImpulse, now - first < 0.18 { return false }
        lastImpulse = now
        if settings.double && now - (firstImpulse ?? -10) > 1.2 {
            firstImpulse = now
            return false
        }
        firstImpulse = nil
        lastWake = now
        return true
    }
}
