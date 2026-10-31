import AppKit
import ApplicationServices

final class PointerController {
    var held=false
    var point=CGPoint.zero
    var lastPacket=Date.distantPast
    var watchdog:Timer?
    init(){watchdog=Timer.scheduledTimer(withTimeInterval:0.1,repeats:true){[weak self] _ in guard let self=self else{return};if self.held && Date().timeIntervalSince(self.lastPacket)>0.6{self.release()}}}
    func release(){if held{CGEvent(mouseEventSource:nil,mouseType:.leftMouseUp,mouseCursorPosition:point,mouseButton:.left)?.post(tap:.cghidEventTap)};held=false}
    func shortcut(_ operation:String) throws {
        guard AXIsProcessTrusted() else {throw NSError(domain:"Aster",code:1,userInfo:[NSLocalizedDescriptionKey:"Allow Aster in Privacy & Security → Accessibility first."])}
        let map:[String:(CGKeyCode,CGEventFlags)]=["lock":(12,[.maskControl,.maskCommand]),"next desktop":(124,[.maskControl]),"previous desktop":(123,[.maskControl]),"show desktop":(103,[]),"mission control":(126,[.maskControl]),"zoom in":(24,[.maskCommand]),"zoom out":(27,[.maskCommand]),"reset zoom":(29,[.maskCommand])]
        guard let (key,flags)=map[operation] else {throw NSError(domain:"Aster",code:2,userInfo:[NSLocalizedDescriptionKey:"Unsupported shortcut."])}
        release()
        for down in [true,false]{let e=CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:down);e?.flags=flags;e?.post(tap:.cghidEventTap)}
    }
    func handle(_ cmd:[String:Any]) {
        let kind=cmd["kind"] as? String ?? ""
        if kind=="release"{release();return}
        guard AXIsProcessTrusted() else{release();return}
        lastPacket=Date()
        let bounds=CGDisplayBounds(CGMainDisplayID())
        let x=max(0,min(1,cmd["x"] as? Double ?? 0.5)),y=max(0,min(1,cmd["y"] as? Double ?? 0.5))
        point=CGPoint(x:bounds.minX+x*(bounds.width-1),y:bounds.minY+y*(bounds.height-1))
        switch kind {
        case "move","drag":CGEvent(mouseEventSource:nil,mouseType:held ? .leftMouseDragged : .mouseMoved,mouseCursorPosition:point,mouseButton:.left)?.post(tap:.cghidEventTap)
        case "down":if !held{held=true;CGEvent(mouseEventSource:nil,mouseType:.leftMouseDown,mouseCursorPosition:point,mouseButton:.left)?.post(tap:.cghidEventTap)}
        case "up":release()
        case "click","doubleClick":
            release()
            for type:CGEventType in [.leftMouseDown,.leftMouseUp]{let e=CGEvent(mouseEventSource:nil,mouseType:type,mouseCursorPosition:point,mouseButton:.left);e?.setIntegerValueField(.mouseEventClickState,value:kind=="doubleClick" ? 2 : 1);e?.post(tap:.cghidEventTap)}
        case "scroll":CGEvent(scrollWheelEvent2Source:nil,units:.pixel,wheelCount:1,wheel1:Int32(max(-80,min(80,cmd["delta"] as? Double ?? 0))),wheel2:0,wheel3:0)?.post(tap:.cghidEventTap)
        case "zoomIn":try? shortcut("zoom in")
        case "zoomOut":try? shortcut("zoom out")
        case "desktopNext":try? shortcut("next desktop")
        case "desktopPrevious":try? shortcut("previous desktop")
        default:break
        }
    }
}
