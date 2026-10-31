import AppKit
import ScreenCaptureKit
import AVFoundation

// ScreenCaptureKit supplies the macOS recording indicator and permission gate.
// Captures stay on disk. No microphone/system audio is added to the movie.
final class CaptureManager: NSObject, SCRecordingOutputDelegate, SCStreamDelegate {
    var stream: SCStream?
    var recording: SCRecordingOutput?
    var file: URL?
    var phase = "idle"
    var generation=0
    var finished: [(Result<URL,Error>)->Void]=[]
    var limit: Timer?
    var finishTimer: Timer?
    var folder: URL {FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Pictures/Aster Captures")}
    func destination(_ ext:String) throws -> URL {
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let stamp=ISO8601DateFormatter().string(from:Date()).replacingOccurrences(of:":",with:"-")
        return folder.appendingPathComponent("Aster-\(stamp)-\(UUID().uuidString.prefix(6)).\(ext)")
    }
    func configuration() async throws -> (SCContentFilter,SCStreamConfiguration) {
        guard CGPreflightScreenCaptureAccess() else {
            _=CGRequestScreenCaptureAccess()
            throw NSError(domain:"Aster",code:1,userInfo:[NSLocalizedDescriptionKey:"Allow Aster in Privacy & Security → Screen & System Audio Recording, then reopen Aster if macOS asks. Say the capture command again."])
        }
        let content=try await SCShareableContent.excludingDesktopWindows(false,onScreenWindowsOnly:true)
        guard let display=content.displays.first(where:{$0.displayID==CGMainDisplayID()}) ?? content.displays.first else {throw NSError(domain:"Aster",code:2,userInfo:[NSLocalizedDescriptionKey:"No display is available."])}
        let config=SCStreamConfiguration()
        // Limit to 1920 px width for manageable H.264 files; retain aspect ratio.
        let width=min(1920,display.width),height=Int(Double(display.height)*Double(width)/Double(display.width))
        config.width=width-width%2;config.height=height-height%2
        config.minimumFrameInterval=CMTime(value:1,timescale:30);config.queueDepth=5
        config.showsCursor=true;config.capturesAudio=false
        return (SCContentFilter(display:display,excludingWindows:[]),config)
    }
    func screenshot() async throws -> URL {
        let (filter,config)=try await configuration()
        let image=try await SCScreenshotManager.captureImage(contentFilter:filter,configuration:config)
        let bitmap=NSBitmapImageRep(cgImage:image)
        guard let data=bitmap.representation(using:.png,properties:[:]) else {throw NSError(domain:"Aster",code:3,userInfo:[NSLocalizedDescriptionKey:"Could not encode the screenshot."])}
        let url=try destination("png");try data.write(to:url,options:.atomic);return url
    }
    func start() async throws {
        guard phase=="idle" else {throw NSError(domain:"Aster",code:4,userInfo:[NSLocalizedDescriptionKey:"A recording is already starting, running or saving."])}
        phase="starting";generation+=1;let token=generation
        do {
            let (filter,config)=try await configuration(),url=try destination("mp4")
            guard token==generation else {throw CancellationError()}
            file=url
            let outputConfig=SCRecordingOutputConfiguration();outputConfig.outputURL=url;outputConfig.videoCodecType = .h264;outputConfig.outputFileType = .mp4
            let out=SCRecordingOutput(configuration:outputConfig,delegate:self)
            let capture=SCStream(filter:filter,configuration:config,delegate:self)
            recording=out;stream=capture
            try capture.addRecordingOutput(out)
            try await capture.startCapture()
        } catch {if token==generation{let old=stream;phase="idle";stream=nil;recording=nil;try? await old?.stopCapture()};throw error}
    }
    func stop(_ completion:@escaping(Result<URL,Error>)->Void) {
        if phase=="saving" {finished.append(completion);return}
        if phase=="starting" && stream==nil {generation+=1;phase="idle";output(["event":"capture","phase":"idle","message":"Recording start cancelled."]);completion(.failure(CancellationError()));return}
        guard let capture=stream,phase=="recording" || phase=="starting" else {completion(.failure(NSError(domain:"Aster",code:5,userInfo:[NSLocalizedDescriptionKey:phase=="saving" ? "The recording is still saving." : "No recording is running."])));return}
        phase="saving";finished.append(completion);limit?.invalidate()
        finishTimer=Timer.scheduledTimer(withTimeInterval:20,repeats:false){[weak self] _ in
            self?.complete(.failure(NSError(domain:"Aster",code:6,userInfo:[NSLocalizedDescriptionKey:"Recording finalization timed out. Check Aster Captures before recording again."])))
        }
        capture.stopCapture { [weak self] error in if let error=error {DispatchQueue.main.async {self?.complete(.failure(error))}}}
    }
    func complete(_ result:Result<URL,Error>) {
        guard phase != "idle" else{return}
        let callbacks=finished,old=stream;finished=[];limit?.invalidate();finishTimer?.invalidate();stream=nil;recording=nil;phase="idle";generation+=1
        if case .failure = result {old?.stopCapture{_ in}}
        switch result {
        case .success(let url):output(["event":"capture","phase":"idle","path":url.path,"message":"Recording saved in Pictures, Aster Captures."])
        case .failure(let error):output(["event":"capture","phase":"idle","error":error.localizedDescription])
        }
        for callback in callbacks{callback(result)}
    }
    func recordingOutputDidStartRecording(_ output:SCRecordingOutput) {
        DispatchQueue.main.async { [self] in
            guard self.recording === output else{return}
            if self.phase=="starting"{self.phase="recording"}
            self.limit=Timer.scheduledTimer(withTimeInterval:600,repeats:false){[weak self] _ in self?.stop{_ in}}
            self.announce()
        }
    }
    func announce(){output(["event":"capture","phase":phase,"startedAt":Date().timeIntervalSince1970*1000])}
    func recordingOutputDidFinishRecording(_ recordingOutput:SCRecordingOutput){DispatchQueue.main.async{guard self.recording === recordingOutput else{return};if let url=self.file{self.complete(.success(url))}}}
    func recordingOutput(_ recordingOutput:SCRecordingOutput,didFailWithError error:Error){DispatchQueue.main.async{guard self.recording === recordingOutput else{return};self.complete(.failure(error))}}
    func stream(_ stream:SCStream,didStopWithError error:Error){DispatchQueue.main.async{guard self.stream === stream else{return};self.complete(.failure(error))}}
}
