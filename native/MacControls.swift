import Foundation
import AppKit
import ApplicationServices
import Contacts

final class MacControls {
    var captured:[AXUIElement]=[]
    var capturedPID:pid_t = 0
    var capturedWindow:AXUIElement?
    var capturedAt=Date.distantPast
    let contacts=CNContactStore()
    var dictationToken:String?
    var dictationPID:pid_t=0
    var dictationField:AXUIElement?
    func beginDictation() throws -> [String:Any] {
        let app=try front(),root=AXUIElementCreateApplication(app.processIdentifier)
        guard let value=attribute(root,kAXFocusedUIElementAttribute),CFGetTypeID(value)==AXUIElementGetTypeID() else {throw NSError(domain:"Aster",code:15,userInfo:[NSLocalizedDescriptionKey:"Focus an editable field first, then say Start dictation."])}
        let field=unsafeBitCast(value,to:AXUIElement.self)
        guard [kAXTextFieldRole,kAXTextAreaRole,kAXComboBoxRole].contains(string(field,kAXRoleAttribute)),string(field,kAXSubroleAttribute) != kAXSecureTextFieldSubrole else {throw NSError(domain:"Aster",code:16,userInfo:[NSLocalizedDescriptionKey:"Choose a normal text field first. Secure fields are excluded."])}
        guard !["com.apple.Terminal","com.googlecode.iterm2","dev.warp.Warp-Stable"].contains(app.bundleIdentifier ?? "") else {throw NSError(domain:"Aster",code:17,userInfo:[NSLocalizedDescriptionKey:"Terminal dictation is not enabled."])}
        dictationPID=app.processIdentifier;dictationField=field;dictationToken=UUID().uuidString
        return ["token":dictationToken!,"app":app.localizedName ?? "the active app"]
    }
    func attribute(_ element:AXUIElement,_ name:String) -> CFTypeRef? {var value:CFTypeRef?;return AXUIElementCopyAttributeValue(element,name as CFString,&value) == .success ? value : nil}
    func string(_ element:AXUIElement,_ name:String) -> String {attribute(element,name) as? String ?? ""}
    func front() throws -> NSRunningApplication {
        guard AXIsProcessTrusted() else {throw NSError(domain:"Aster",code:1,userInfo:[NSLocalizedDescriptionKey:"Enable Aster in System Settings, Privacy and Security, Accessibility for typing and clicking."])}
        guard let app=NSWorkspace.shared.frontmostApplication else {throw NSError(domain:"Aster",code:2,userInfo:[NSLocalizedDescriptionKey:"No active app."])}
        return app
    }
    func controls() throws -> [String:Any] {
        let app=try front();let root=AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(root,0.2)
        guard let value=attribute(root,kAXFocusedWindowAttribute),CFGetTypeID(value)==AXUIElementGetTypeID() else {throw NSError(domain:"Aster",code:3,userInfo:[NSLocalizedDescriptionKey:"This app does not expose an accessible window."])}
        let window=unsafeBitCast(value,to:AXUIElement.self)
        captured=[];capturedWindow=window;capturedPID=app.processIdentifier;capturedAt=Date();var items:[[String:Any]]=[];var visited=0;let deadline=Date().addingTimeInterval(1.5)
        let roles=[kAXButtonRole,kAXTextFieldRole,kAXTextAreaRole,"AXLink",kAXCheckBoxRole,kAXPopUpButtonRole,kAXRadioButtonRole,kAXMenuButtonRole]
        func walk(_ e:AXUIElement,_ depth:Int){
            guard Date()<deadline,depth<16,visited<2200,items.count<60 else{return};visited+=1
            let role=string(e,kAXRoleAttribute)
            if roles.contains(role),string(e,kAXSubroleAttribute) != kAXSecureTextFieldSubrole {
                let label=[string(e,kAXTitleAttribute),string(e,kAXDescriptionAttribute),string(e,kAXHelpAttribute)].first(where:{!$0.isEmpty}) ?? ""
                var usable=true
                if let enabled=attribute(e,kAXEnabledAttribute) as? Bool {usable=enabled}
                if !label.isEmpty,usable {
                    captured.append(e);items.append(["number":captured.count,"label":String(label.prefix(120)),"role":role])
                }
            }
            if let children=attribute(e,kAXChildrenAttribute) as? [AXUIElement] {for child in children{walk(child,depth+1)}}
        }
        walk(window,0)
        return ["app":app.localizedName ?? "Active app","controls":items]
    }
    func click(number:Int?,label:String?) throws -> [String:Any] {
        let app=try front()
        if let label=label {
            let list=try controls()["controls"] as? [[String:Any]] ?? []
            let matches=list.filter{($0["label"] as? String)?.caseInsensitiveCompare(label) == .orderedSame}
            guard matches.count==1,let n=matches.first?["number"] as? Int else {throw NSError(domain:"Aster",code:4,userInfo:[NSLocalizedDescriptionKey:matches.isEmpty ? "No uniquely named control found. Say Show controls, then Click followed by a number." : "More than one control has that name. Say Show controls and choose a number."])}
            return try click(number:n,label:nil)
        }
        guard app.processIdentifier==capturedPID,Date().timeIntervalSince(capturedAt)<45,let n=number,n>0,n<=captured.count else {throw NSError(domain:"Aster",code:5,userInfo:[NSLocalizedDescriptionKey:"The controls have changed or expired. Say Show controls again."])}
        let root=AXUIElementCreateApplication(app.processIdentifier)
        guard let window=attribute(root,kAXFocusedWindowAttribute),let previous=capturedWindow,CFEqual(window,previous) else {throw NSError(domain:"Aster",code:12,userInfo:[NSLocalizedDescriptionKey:"The focused window changed. Say Show controls again."])}
        let element=captured[n-1],role=string(element,kAXRoleAttribute)
        let result:AXError
        if role==kAXTextFieldRole || role==kAXTextAreaRole {result=AXUIElementSetAttributeValue(element,kAXFocusedAttribute as CFString,kCFBooleanTrue)}else{result=AXUIElementPerformAction(element,kAXPressAction as CFString)}
        guard result == .success else {throw NSError(domain:"Aster",code:6,userInfo:[NSLocalizedDescriptionKey:"That app did not accept the action. Refresh the controls or use Apple Voice Control."])}
        captured=[];return ["ok":true,"message":"Activated control \(n) in \(app.localizedName ?? "the active app")."]
    }
    func type(_ text:String,token:String?=nil) throws -> [String:Any] {
        let app=try front()
        let blocked=["com.apple.Terminal","com.googlecode.iterm2","dev.warp.Warp-Stable"]
        guard !blocked.contains(app.bundleIdentifier ?? "") else {throw NSError(domain:"Aster",code:7,userInfo:[NSLocalizedDescriptionKey:"Voice typing into terminals is not enabled."])}
        let root=AXUIElementCreateApplication(app.processIdentifier)
        guard let value=attribute(root,kAXFocusedUIElementAttribute),CFGetTypeID(value)==AXUIElementGetTypeID() else {throw NSError(domain:"Aster",code:8,userInfo:[NSLocalizedDescriptionKey:"Focus a text field first. Say Show controls, then Click its number."])}
        let element=unsafeBitCast(value,to:AXUIElement.self),role=string(element,kAXRoleAttribute)
        guard [kAXTextFieldRole,kAXTextAreaRole,kAXComboBoxRole].contains(role),string(element,kAXSubroleAttribute) != kAXSecureTextFieldSubrole else {throw NSError(domain:"Aster",code:9,userInfo:[NSLocalizedDescriptionKey:"Choose a normal editable text field first. Secure fields are excluded."])}
        if let token=token {
            guard token==dictationToken,app.processIdentifier==dictationPID,let previous=dictationField,CFEqual(previous,element) else {throw NSError(domain:"Aster",code:18,userInfo:[NSLocalizedDescriptionKey:"The dictation field changed. Focus your intended field and say Start dictation again."])}
        }
        for chunk in text.map({String($0)}) {
            let units=Array(chunk.utf16),down=CGEvent(keyboardEventSource:nil,virtualKey:0,keyDown:true),up=CGEvent(keyboardEventSource:nil,virtualKey:0,keyDown:false)
            units.withUnsafeBufferPointer {pointer in if let base=pointer.baseAddress {down?.keyboardSetUnicodeString(stringLength:units.count,unicodeString:base);up?.keyboardSetUnicodeString(stringLength:units.count,unicodeString:base)}}
            down?.postToPid(app.processIdentifier);up?.postToPid(app.processIdentifier)
        }
        return ["ok":true,"message":"Sent dictation to \(app.localizedName ?? "the active app"). I have not pressed Enter."]
    }
    func key(_ name:String) throws -> [String:Any] {
        let app=try front()
        guard !["com.apple.Terminal","com.googlecode.iterm2","dev.warp.Warp-Stable"].contains(app.bundleIdentifier ?? "") else {throw NSError(domain:"Aster",code:10,userInfo:[NSLocalizedDescriptionKey:"Terminal key control is not enabled."])}
        let map:[String:(CGKeyCode,CGEventFlags)]=["enter":(36,[]),"tab":(48,[]),"escape":(53,[]),"backspace":(51,[]),"up":(126,[]),"down":(125,[]),"left":(123,[]),"right":(124,[]),"select all":(0,[.maskCommand]),"copy":(8,[.maskCommand]),"paste":(9,[.maskCommand]),"undo":(6,[.maskCommand])]
        guard let (key,flags)=map[name] else {throw NSError(domain:"Aster",code:11,userInfo:[NSLocalizedDescriptionKey:"Unsupported key."])}
        let down=CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:true),up=CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:false)
        down?.flags=flags;up?.flags=flags;down?.postToPid(app.processIdentifier);up?.postToPid(app.processIdentifier)
        return ["ok":true,"message":"Pressed \(name) in \(app.localizedName ?? "the active app")."]
    }
    func findContacts(_ name:String,reply:@escaping ([String:Any])->Void){
        contacts.requestAccess(for:.contacts){allowed,error in
            guard allowed else {reply(["error":error?.localizedDescription ?? "Allow Contacts access to resolve a person's name, or say a phone number."]);return}
            do {
                let keys:[CNKeyDescriptor]=[CNContactGivenNameKey as CNKeyDescriptor,CNContactFamilyNameKey as CNKeyDescriptor,CNContactPhoneNumbersKey as CNKeyDescriptor,CNContactEmailAddressesKey as CNKeyDescriptor]
                let items=try self.contacts.unifiedContacts(matching:CNContact.predicateForContacts(matchingName:name),keysToFetch:keys).prefix(8).map{c -> [String:Any] in ["name":(c.givenName+" "+c.familyName).trimmingCharacters(in:.whitespaces),"phones":c.phoneNumbers.map{$0.value.stringValue},"emails":c.emailAddresses.map{String($0.value)}]}
                reply(["contacts":items])
            }catch{reply(["error":error.localizedDescription])}
        }
    }
}
