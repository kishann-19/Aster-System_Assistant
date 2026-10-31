import Foundation

// Deliberately an impulse detector, not a claim of clap/snap classification.
// A double impulse reduces accidental wake-ups from ordinary speech.
struct ImpulseWakeDetector {
    var lastImpulse:Double = -100
    var firstImpulse:Double = -100
    var lastWake:Double = -100
    var noise:Double = 0.008
    mutating func sample(peak:Double,rms:Double,now:Double,threshold:Double,double:Bool) -> Bool {
        let baseline=noise
        noise=0.97*noise+0.03*min(rms,0.08)
        guard now-lastWake>8,now-lastImpulse>0.16,peak>=threshold,rms>max(0.009,baseline*2.0),peak/max(rms,0.0001)>3.2 else{return false}
        lastImpulse=now
        if !double || (now-firstImpulse>=0.18 && now-firstImpulse<=1.2) {
            lastWake=now;firstImpulse = -100;return true
        }
        firstImpulse=now;return false
    }
}
