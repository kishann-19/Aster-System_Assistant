using System;
using System.Collections.Generic;
using System.Speech.Recognition;
using System.Web.Script.Serialization;
using System.Threading;

class AsterBridge {
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static readonly object Gate = new object();
    static SpeechRecognitionEngine recognition;
    static Timer deadline;
    static int generation;

    static void Send(object value) {
        lock (Gate) {
            Console.WriteLine(Json.Serialize(value));
            Console.Out.Flush();
        }
    }
    static Dictionary<string, object> Message(string line) {
        return Json.Deserialize<Dictionary<string, object>>(line);
    }
    static int Id(Dictionary<string, object> cmd) {
        return cmd.ContainsKey("id") ? Convert.ToInt32(cmd["id"]) : 0;
    }
    static void Reply(int id, object value) {
        var result = value as Dictionary<string, object> ?? new Dictionary<string, object>();
        if (id > 0) result["id"] = id;
        Send(result);
    }
    static Dictionary<string, object> Result(string key, object value) {
        return new Dictionary<string, object> { { key, value } };
    }
    static void StopSpeech() {
        Interlocked.Increment(ref generation);
        if (deadline != null) { deadline.Dispose(); deadline = null; }
        var old = recognition;
        recognition = null;
        if (old != null) {
            try { old.RecognizeAsyncCancel(); } catch {}
            old.Dispose();
        }
    }
    static void StartSpeech(int id) {
        StopSpeech();
        int token = generation;
        var engine = new SpeechRecognitionEngine();
        engine.LoadGrammar(new DictationGrammar());
        engine.SetInputToDefaultAudioDevice();
        engine.SpeechRecognized += (sender, args) => {
            if (String.IsNullOrWhiteSpace(args.Result.Text) ||
                Interlocked.CompareExchange(ref generation, token + 1, token) != token) return;
            string text = args.Result.Text;
            ThreadPool.QueueUserWorkItem(_ => {
                if (generation != token + 1) return;
                StopSpeech();
                Send(new Dictionary<string, object> { { "event", "transcript" }, { "text", text } });
            });
        };
        recognition = engine;
        engine.RecognizeAsync(RecognizeMode.Multiple);
        deadline = new Timer(_ => {
            if (Interlocked.CompareExchange(ref generation, token + 1, token) != token) return;
            StopSpeech();
            Send(new Dictionary<string, object> { { "event", "transcript" }, { "text", "" } });
        }, null, 45000, Timeout.Infinite);
        Reply(id, Result("ok", true));
    }
    static void Handle(Dictionary<string, object> cmd) {
        int id = Id(cmd);
        string action = cmd.ContainsKey("action") ? Convert.ToString(cmd["action"]) : "";
        try {
            switch (action) {
                case "speechStart": StartSpeech(id); break;
                case "speechStop": StopSpeech(); Reply(id, Result("ok", true)); break;
                case "wakeConfigure": Reply(id, Result("ok", true)); break;
                case "ttsVoices": Reply(id, Result("voices", new object[0])); break;
                case "ttsStop": Reply(id, Result("ok", true)); break;
                case "activeApp": Reply(id, Result("name", "")); break;
                case "status":
                    Reply(id, new Dictionary<string, object> { { "accessibility", false }, { "platform", "windows" } });
                    break;
                case "captureStatus": Reply(id, Result("phase", "idle")); break;
                case "recordStop": Reply(id, Result("ok", true)); break;
                default: Reply(id, Result("error", "This feature is not available in the Windows preview.")); break;
            }
        } catch (Exception ex) {
            if (action == "speechStart") StopSpeech();
            Reply(id, Result("error", ex.Message));
        }
    }
    static void Main() {
        Console.InputEncoding = System.Text.Encoding.UTF8;
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        string line;
        while ((line = Console.ReadLine()) != null) {
            try { Handle(Message(line)); } catch {}
        }
        StopSpeech();
    }
}
