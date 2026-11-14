import Foundation
import AppKit
import ApplicationServices
import Speech
import AVFoundation
import EventKit

func output(_ data: [String:Any]) { if let bytes=try? JSONSerialization.data(withJSONObject:data), let text=String(data:bytes,encoding:.utf8) { print(text);fflush(stdout) } }
let application=NSApplication.shared
final class Bridge: NSObject, AVSpeechSynthesizerDelegate {
    let controls=MacControls()
    let capture=CaptureManager()
    let pointer=PointerController()
    let wakePreferences = WakePreferences()
    let store=EKEventStore()
    let engine=AVAudioEngine()
    var request:SFSpeechAudioBufferRecognitionRequest?
    var task:SFSpeechRecognitionTask?
    var recognizer=SFSpeechRecognizer(locale:Locale(identifier:"en-IN"))
    var timer:Timer?
    var deadline:Timer?
    var transcript=""
    var listening=false
    var tapped=false
    var generation=0
    let speaker=AVSpeechSynthesizer()
    var speechReplies:[ObjectIdentifier:Int]=[:]
    override init(){super.init();speaker.delegate=self}
    func availableVoices() -> [[String:Any]] {
        let all=AVSpeechSynthesisVoice.speechVoices().filter{$0.language.hasPrefix("en")}
        return all.filter{v in v.quality.rawValue>1 || ["Daniel","Samantha","Karen","Moira","Rishi"].contains(v.name)}.filter{v in !v.identifier.contains("super-compact") || !all.contains(where:{$0.name==v.name && !$0.identifier.contains("super-compact")})}.map{v in
            var name=v.name
            if v.identifier.contains("Akash"){name="Akash"}
            if v.identifier.contains("Riya"){name="Riya"}
            if v.identifier.contains("Simone"){name="Simone"}
            return ["id":v.identifier,"name":name,"language":v.language,"quality":v.quality.rawValue]
        }.sorted{($0["quality"] as? Int ?? 0)>($1["quality"] as? Int ?? 0)}
    }
    func stopOutput(){
        speaker.stopSpeaking(at:.immediate)
        let ids=Array(speechReplies.values);speechReplies.removeAll()
        for id in ids {output(["id":id,"ok":true,"cancelled":true])}
    }
    func speak(_ cmd:[String:Any],id:Int){
        guard let text=cmd["text"] as? String,!text.isEmpty,text.count<=2000 else {output(["id":id,"error":"Invalid speech text"]);return}
        let selected=cmd["voice"] as? String ?? "com.apple.siri.natural.Akash"
        guard let voice=AVSpeechSynthesisVoice(identifier:selected) else {output(["id":id,"error":"That voice is not available on this Mac. Choose another voice."]);return}
        stopOutput()
        let utterance=AVSpeechUtterance(string:text);utterance.voice=voice
        utterance.rate=Float(max(0.35,min(0.6,cmd["rate"] as? Double ?? 0.48)))
        utterance.pitchMultiplier=1;utterance.volume=1
        speechReplies[ObjectIdentifier(utterance)]=id
        speaker.speak(utterance)
    }
    func speechSynthesizer(_ synthesizer:AVSpeechSynthesizer,didFinish utterance:AVSpeechUtterance){if let id=speechReplies.removeValue(forKey:ObjectIdentifier(utterance)){output(["id":id,"ok":true])}}
    func speechSynthesizer(_ synthesizer:AVSpeechSynthesizer,didCancel utterance:AVSpeechUtterance){if let id=speechReplies.removeValue(forKey:ObjectIdentifier(utterance)){output(["id":id,"ok":true,"cancelled":true])}}
    func stopSpeech() {
        generation += 1; listening=false;timer?.invalidate();deadline?.invalidate();engine.stop()
        if tapped {engine.inputNode.removeTap(onBus:0);tapped=false}
        request?.endAudio();task?.cancel();task=nil;request=nil
    }
    func finishSpeech() {
        guard listening else{return};let text=transcript;stopSpeech()
        output(["event":"transcript","text":text])
    }
    func startSpeech(_ id:Int) {
        stopSpeech();transcript=""
        let token=generation
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard token==self.generation else {output(["id":id,"error":"Listening cancelled"]);return}
                guard status == .authorized else {output(["id":id,"error":"Allow Speech Recognition for Aster in System Settings → Privacy & Security."]);return}
                AVCaptureDevice.requestAccess(for:.audio) { allowed in
                    DispatchQueue.main.async {
                        guard token==self.generation else {output(["id":id,"error":"Listening cancelled"]);return}
                        guard allowed else {output(["id":id,"error":"Allow microphone access for Aster in System Settings."]);return}
                        guard let recognizer=self.recognizer,recognizer.isAvailable else {output(["id":id,"error":"Apple speech recognition is unavailable. Check your internet connection and Siri language settings."]);return}
                        let req=SFSpeechAudioBufferRecognitionRequest();req.shouldReportPartialResults=true;req.contextualStrings=["Aster","Open YouTube in the browser","Open Google Chrome","Open Safari","Search for","Show dashboard","Go to sleep","Wake up"]
                        if recognizer.supportsOnDeviceRecognition {req.requiresOnDeviceRecognition=true}
                        self.request=req
                        let input=self.engine.inputNode;let format=input.outputFormat(forBus:0)
                        guard format.sampleRate>0,format.channelCount>0 else {output(["id":id,"error":"No microphone is available."]);return}
                        var detector = ImpulseWakeDetector(sampleRate: format.sampleRate)
                        var settings = self.wakePreferences.get()
                        input.installTap(onBus:0,bufferSize:1024,format:format){buffer,_ in
                            req.append(buffer)
                            let current = self.wakePreferences.get()
                            if current != settings {
                                detector = ImpulseWakeDetector(sampleRate: format.sampleRate)
                                settings = current
                            }
                            guard settings.enabled, let samples = buffer.floatChannelData?[0] else { return }
                            if detector.consume(samples, count: Int(buffer.frameLength), stride: buffer.stride, settings: settings) {
                                DispatchQueue.main.async {
                                    if self.listening, self.generation == token, self.wakePreferences.get() == current {
                                        output(["event":current.standby ? "wakeSound" : "sleepSound"])
                                    }
                                }
                            }
                        };self.tapped=true
                        do {self.engine.prepare();try self.engine.start();self.listening=true} catch {self.stopSpeech();output(["id":id,"error":error.localizedDescription]);return}
                        self.task=recognizer.recognitionTask(with:req){result,error in
                            DispatchQueue.main.async {
                                guard self.listening,self.generation==token else{return}
                                if let result=result {
                                    let newText=result.bestTranscription.formattedString
                                    if newText != self.transcript {self.transcript=newText;output(["event":"partial","text":newText]);self.timer?.invalidate();self.timer=Timer.scheduledTimer(withTimeInterval:1.4,repeats:false){_ in self.finishSpeech()}}
                                    if result.isFinal {self.finishSpeech()}
                                } else if let error=error {if (error as NSError).code==1110{self.finishSpeech()}else{self.stopSpeech();output(["event":"speechError","error":error.localizedDescription])}}
                            }
                        }
                        self.deadline=Timer.scheduledTimer(withTimeInterval:45,repeats:false){_ in self.finishSpeech()}
                        output(["id":id,"ok":true])
                    }
                }
            }
        }
    }
    func applicationURL(_ name:String) -> URL? {
        let key=name.lowercased().trimmingCharacters(in:.whitespaces)
        let known=["safari":"com.apple.Safari","chrome":"com.google.Chrome","google chrome":"com.google.Chrome","finder":"com.apple.finder","notes":"com.apple.Notes","music":"com.apple.Music","spotify":"com.spotify.client","mail":"com.apple.mail","calendar":"com.apple.iCal","whatsapp":"net.whatsapp.WhatsApp","system settings":"com.apple.systempreferences","visual studio code":"com.microsoft.VSCode","code":"com.microsoft.VSCode"]
        if let bundle=known[key],let url=NSWorkspace.shared.urlForApplication(withBundleIdentifier:bundle){return url}
        let roots=["/Applications","/System/Applications","/System/Applications/Utilities",NSHomeDirectory()+"/Applications"]
        for root in roots {
            if let files=try? FileManager.default.contentsOfDirectory(at:URL(fileURLWithPath:root),includingPropertiesForKeys:nil,options:.skipsHiddenFiles),let match=files.first(where:{$0.pathExtension=="app" && $0.deletingPathExtension().lastPathComponent.lowercased()==key}) {return match}
        }
        return nil
    }
    func handle(_ cmd:[String:Any]) {
        let id=cmd["id"] as? Int ?? 0
        func reply(_ values:[String:Any]){var obj=values;if id>0{obj["id"]=id};output(obj)}
        switch cmd["action"] as? String ?? "" {
        case "captureStatus":reply(["phase":capture.phase])
        case "screenshot":Task { @MainActor in
            do {let url=try await capture.screenshot();reply(["ok":true,"path":url.path,"message":"Screenshot saved in Pictures, Aster Captures."])}catch{reply(["error":error.localizedDescription])}
        }
        case "recordStart":Task { @MainActor in
            do {try await capture.start();reply(["ok":true,"phase":capture.phase,"message":"Screen recording requested. Watch for the recording indicator. Say Stop recording to save. Video only, with a ten minute limit."])}catch{reply(["error":error.localizedDescription])}
        }
        case "recordStop":capture.stop{result in
            switch result {case .success(let url):reply(["ok":true,"path":url.path,"message":"Recording saved in Pictures, Aster Captures."]);case .failure(let error):reply(["error":error.localizedDescription])}
        }
        case "openCaptures":
            do{try FileManager.default.createDirectory(at:capture.folder,withIntermediateDirectories:true);reply(["ok":NSWorkspace.shared.open(capture.folder),"message":"Opened Aster Captures in Pictures."])}catch{reply(["error":error.localizedDescription])}
        case "shortcut":
            do {try pointer.shortcut(cmd["operation"] as? String ?? "");reply(["ok":true,"message":"Requested \(cmd["operation"] as? String ?? "shortcut")."])}catch{reply(["error":error.localizedDescription])}
        case "ttsVoices":reply(["voices":availableVoices()])
        case "ttsSpeak":speak(cmd,id:id)
        case "ttsStop":stopOutput();if id>0{reply(["ok":true])}
        case "status":reply(["screenCapture":CGPreflightScreenCaptureAccess(),"capturePhase":capture.phase,"accessibility":AXIsProcessTrusted(),"microphone":AVCaptureDevice.authorizationStatus(for:.audio).rawValue,"speech":SFSpeechRecognizer.authorizationStatus().rawValue])
        case "requestAccessibility":
            let options=[kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String:true] as CFDictionary
            reply(["accessibility":AXIsProcessTrustedWithOptions(options)])
        case "uiControls":
            do{reply(try controls.controls())}catch{reply(["error":error.localizedDescription])}
        case "uiClick":
            do{reply(try controls.click(number:cmd["number"] as? Int,label:cmd["label"] as? String))}catch{reply(["error":error.localizedDescription])}
        case "uiDictationStart":
            do{reply(try controls.beginDictation())}catch{reply(["error":error.localizedDescription])}
        case "uiType":
            guard let text=cmd["text"] as? String,!text.isEmpty,text.count<=2000 else{reply(["error":"Invalid dictation"]);return}
            do{reply(try controls.type(text,token:cmd["dictationToken"] as? String))}catch{reply(["error":error.localizedDescription])}
        case "uiKey":
            do{reply(try controls.key(cmd["key"] as? String ?? ""))}catch{reply(["error":error.localizedDescription])}
        case "contacts":controls.findContacts(cmd["name"] as? String ?? "",reply:reply)
        case "browse":
            guard let value=cmd["url"] as? String,let url=URL(string:value),["https","http"].contains(url.scheme ?? ""),url.user==nil,url.password==nil else {reply(["error":"Invalid website address"]);return}
            let bundle=cmd["bundle"] as? String ?? ""
            if bundle.isEmpty {
                reply(NSWorkspace.shared.open(url) ? ["ok":true] : ["error":"Could not open the default browser."])
            }else{
                guard let appURL=NSWorkspace.shared.urlForApplication(withBundleIdentifier:bundle) else {reply(["error":"That browser is not installed. Say Open browser to use your default browser."]);return}
                NSWorkspace.shared.open([url],withApplicationAt:appURL,configuration:NSWorkspace.OpenConfiguration()){_,error in
                    if let error=error{reply(["error":error.localizedDescription])}else{reply(["ok":true])}
                }
            }
        case "openApp":
            guard let name=cmd["name"] as? String,name.range(of:"^[\\p{L}\\p{N} .+-]{1,70}$",options:.regularExpression) != nil,
                  let url=applicationURL(name) else {reply(["error":"Application not found. Say its installed name, for example Open Safari."]);return}
            NSWorkspace.shared.openApplication(at:url,configuration:NSWorkspace.OpenConfiguration()){app,error in
                if let error=error{reply(["error":error.localizedDescription])}else{reply(["ok":true,"message":"Opened \(app?.localizedName ?? name)."])}
            }
        case "openSettings":
            guard let value=cmd["url"] as? String,value.hasPrefix("x-apple.systempreferences:"),let url=URL(string:value),NSWorkspace.shared.open(url) else {reply(["error":"Could not open System Settings."]);return}
            reply(["ok":true,"message":"Opened System Settings. macOS permission and security changes need your approval in that window."])
        case "browserControl":
            guard AXIsProcessTrusted() else {reply(["error":"Allow Aster in System Settings, Privacy and Security, Accessibility to control browser navigation."]);return}
            let supported=["com.apple.Safari","com.google.Chrome","com.microsoft.edgemac","org.mozilla.firefox","com.brave.Browser","company.thebrowser.Browser","company.thebrowser.dia","com.operasoftware.Opera"]
            guard let front=NSWorkspace.shared.frontmostApplication,supported.contains(front.bundleIdentifier ?? "") else {reply(["error":"A supported browser must be the frontmost app. Say Open Safari or Open Google Chrome first."]);return}
            let operation=cmd["operation"] as? String ?? ""
            if operation=="scroll down" || operation=="scroll up" {
                CGEvent(scrollWheelEvent2Source:nil,units:.pixel,wheelCount:1,wheel1:operation=="scroll down" ? -450 : 450,wheel2:0,wheel3:0)?.post(tap:.cghidEventTap)
            }else{
                let keys:[String:(CGKeyCode,CGEventFlags)]=["next tab":(48,[.maskControl]),"previous tab":(48,[.maskControl,.maskShift]),"new tab":(17,[.maskCommand]),"go back":(33,[.maskCommand]),"go forward":(30,[.maskCommand]),"reload page":(15,[.maskCommand])]
                guard let (key,flags)=keys[operation] else {reply(["error":"Unsupported browser action"]);return}
                let down=CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:true),up=CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:false)
                down?.flags=flags;up?.flags=flags;down?.post(tap:.cghidEventTap);up?.post(tap:.cghidEventTap)
            }
            reply(["ok":true,"message":"Browser command: \(operation)."])
        case "activeApp":reply(["name":NSWorkspace.shared.frontmostApplication?.localizedName ?? "Unknown"])
        case "speechStart":
            wakePreferences.set(WakeSettings(cmd));startSpeech(id)
        case "wakeConfigure":
            wakePreferences.set(WakeSettings(cmd));reply(["ok":true])
        case "speechStop":stopSpeech();if id>0{reply(["ok":true])}
        case "pointer":pointer.handle(cmd)
        case "calendar":
            store.requestFullAccessToEvents {allowed,error in
                DispatchQueue.main.async {
                    guard allowed else {reply(["error":error?.localizedDescription ?? "Calendar access was not granted. Enable it in System Settings."]);return}
                    let start=Calendar.current.startOfDay(for:Date()),end=Calendar.current.date(byAdding:.day,value:7,to:start)!
                    let predicate=self.store.predicateForEvents(withStart:start,end:end,calendars:nil)
                    let formatter=ISO8601DateFormatter()
                    let events=self.store.events(matching:predicate).sorted{$0.startDate<$1.startDate}.prefix(60).map{e -> [String:Any] in ["id":e.eventIdentifier ?? UUID().uuidString,"title":e.title ?? "Untitled event","start":formatter.string(from:e.startDate),"end":formatter.string(from:e.endDate),"allDay":e.isAllDay,"calendar":e.calendar.title]}
                    reply(["events":events])
                }
            }
        case "reminders":
            store.requestFullAccessToReminders{allowed,error in
                guard allowed else{reply(["error":error?.localizedDescription ?? "Reminders access was not granted."]);return}
                let predicate=self.store.predicateForIncompleteReminders(withDueDateStarting:nil,ending:nil,calendars:nil)
                self.store.fetchReminders(matching:predicate){items in
                    let reminders=(items ?? []).prefix(100).map{r -> [String:Any] in var item:[String:Any]=["id":r.calendarItemIdentifier,"title":r.title ?? "Untitled reminder"];if let components=r.dueDateComponents,let date=Calendar.current.date(from:components){item["due"]=ISO8601DateFormatter().string(from:date)};return item}
                    reply(["reminders":reminders])
                }
            }
        case "mail":
            let script="""
            tell application "Mail"
                set unreadMessages to (messages of inbox whose read status is false)
                set rows to {}
                set messageCount to count unreadMessages
                set limitCount to messageCount
                if limitCount > 12 then set limitCount to 12
                repeat with i from 1 to limitCount
                    set m to item i of unreadMessages
                    set end of rows to {subject of m, sender of m}
                end repeat
                return {messageCount, rows}
            end tell
            """
            DispatchQueue.global(qos:.userInitiated).async {
                var error:NSDictionary?
                guard let descriptor=NSAppleScript(source:script)?.executeAndReturnError(&error),error==nil else {reply(["error":"Mail access failed. Set up Apple Mail and allow Aster to control Mail in System Settings → Privacy & Security → Automation."]);return}
                let count=descriptor.atIndex(1)?.int32Value ?? 0;let list=descriptor.atIndex(2);var rows=[[String:String]]()
                if let list=list,list.numberOfItems>0{for i in 1...list.numberOfItems {if let row=list.atIndex(i){rows.append(["title":row.atIndex(1)?.stringValue ?? "No subject","sender":row.atIndex(2)?.stringValue ?? "Unknown sender"])}}}
                reply(["count":count,"messages":rows])
            }
        default:reply(["error":"Unsupported command"])
        }
    }
}
@main struct AsterBridgeMain {
    static func main(){
        application.setActivationPolicy(.accessory)
        let bridge=Bridge()
        DispatchQueue.global(qos:.userInitiated).async {
            while let line=readLine(){guard let bytes=line.data(using:.utf8),let cmd=(try? JSONSerialization.jsonObject(with:bytes)) as? [String:Any] else{continue};DispatchQueue.main.async{bridge.handle(cmd)}}
            DispatchQueue.main.async{bridge.pointer.release();bridge.stopSpeech();bridge.stopOutput();if bridge.capture.phase != "idle"{bridge.capture.stop{_ in application.terminate(nil)}}else{application.terminate(nil)}}
        }
        application.run()
    }
}
