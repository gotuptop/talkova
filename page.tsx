"use client";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Tutor = { name: string; initial: string; desc: string; tagline: string };

const TUTORS: Tutor[] = [
  { name: "Maya", initial: "M", desc: "Warm & bilingual. Grew up speaking Spanish, now teaches English.", tagline: "Warm & bilingual. Grew up speaking Spanish." },
  { name: "Leo",  initial: "L", desc: "Cool & energetic. Makes every lesson feel like a real conversation.", tagline: "Cool & energetic. Lessons that feel like a hang." },
  { name: "Nova", initial: "N", desc: "Patient & clear. Perfect for learners starting from zero.", tagline: "Patient & clear. Perfect for total beginners." },
];

export default function Home() {
  const [screen, setScreen] = useState<"landing" | "app">("landing");
  const [tutor, setTutor] = useState<Tutor>(TUTORS[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function startApp(t: Tutor = tutor) {
    setTutor(t);
    const greeting = `Hi! I'm ${t.name} 👋 I'm your English tutor at Talkova. We can talk in English or Spanish — whatever feels comfortable. What would you like to practice today?`;
    setMessages([{ role: "assistant", content: greeting }]);
    setScreen("app");
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory, tutorName: tutor.name, tutorDesc: tutor.desc }),
      });
      const data = await res.json();
      setMessages([...newHistory, { role: "assistant", content: data.reply }]);
      setSpeaking(true);
      setTimeout(() => setSpeaking(false), 2000);
    } catch {
      setMessages([...newHistory, { role: "assistant", content: "Oops! Something went wrong. Try again." }]);
    }
    setLoading(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const S = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500;600&display=swap');
    .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;color:var(--text)}
    .logo span{color:var(--purple-light)}
    nav{display:flex;align-items:center;justify-content:space-between;padding:1.2rem 2rem;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;background:rgba(13,12,26,0.9);backdrop-filter:blur(12px)}
    .btn-g{font-size:14px;color:var(--text-soft);background:none;border:1px solid var(--border);padding:8px 18px;border-radius:999px;cursor:pointer}
    .btn-g:hover{border-color:var(--purple-light);color:var(--text)}
    .btn-p{font-size:14px;font-weight:600;background:var(--purple);color:white;border:none;padding:9px 20px;border-radius:999px;cursor:pointer}
    .btn-p:hover{background:var(--purple-light)}
    .hero{text-align:center;padding:5rem 1.5rem 3rem;position:relative}
    .hero::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:600px;height:400px;background:radial-gradient(ellipse,rgba(83,74,183,0.18) 0%,transparent 70%);pointer-events:none}
    .eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--purple-light);background:rgba(83,74,183,0.15);border:1px solid rgba(83,74,183,0.3);padding:5px 14px;border-radius:999px;margin-bottom:1.5rem;letter-spacing:.04em;text-transform:uppercase}
    .pulse{width:6px;height:6px;border-radius:50%;background:var(--purple-light);animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    h1{font-family:'Syne',sans-serif;font-weight:800;font-size:clamp(36px,6vw,64px);line-height:1.05;margin-bottom:1.2rem;letter-spacing:-.02em}
    h1 em{font-style:normal;color:var(--purple-light)}
    .hsub{font-size:17px;color:var(--text-soft);max-width:440px;margin:0 auto 2.5rem;line-height:1.7;font-weight:300}
    .wlf{display:flex;gap:8px;justify-content:center;max-width:400px;margin:0 auto 1rem;flex-wrap:wrap}
    .wli{flex:1;min-width:200px;padding:13px 16px;font-size:14px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:12px;outline:none}
    .wli:focus{border-color:var(--purple)}
    .wli::placeholder{color:var(--text-muted)}
    .btn-cta{padding:13px 24px;font-size:14px;font-weight:600;background:var(--purple);color:white;border:none;border-radius:12px;cursor:pointer}
    .hint{font-size:12px;color:var(--text-muted)}
    .ts{padding:2rem 1.5rem;text-align:center}
    .slabel{font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:1.2rem}
    .trow{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:2rem}
    .tc{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:1.2rem 1rem;width:155px;cursor:pointer;transition:all 0.2s;text-align:center}
    .tc:hover,.tc.sel{border-color:var(--purple);background:var(--bg3);transform:translateY(-2px)}
    .tav{width:64px;height:64px;border-radius:50%;margin:0 auto 10px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;font-family:'Syne',sans-serif;color:var(--purple-light);border:2px solid var(--border)}
    .tc.sel .tav{border-color:var(--purple)}
    .tn{font-size:15px;font-weight:600;margin-bottom:3px}
    .td2{font-size:11px;color:var(--text-soft);line-height:1.4}
    .dbox{max-width:460px;margin:0 auto;background:var(--bg2);border:1px solid var(--border);border-radius:20px;overflow:hidden}
    .dhdr{padding:1rem 1.2rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-soft)}
    .ddot{width:8px;height:8px;border-radius:50%;background:var(--green)}
    .dmsgs{padding:1.2rem;display:flex;flex-direction:column;gap:14px}
    .dm{display:flex;gap:10px;align-items:flex-start}
    .dm.u{flex-direction:row-reverse}
    .dav{width:30px;height:30px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--purple-light);flex-shrink:0}
    .db{font-size:13px;line-height:1.6;padding:10px 14px;border-radius:14px;max-width:78%}
    .db.ai{background:var(--surface);color:var(--text);border-radius:4px 14px 14px 14px}
    .db.usr{background:var(--purple);color:white;border-radius:14px 4px 14px 14px}
    .tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;margin:2px 3px 2px 0}
    .tw{background:rgba(255,107,107,.15);color:var(--red)}
    .tr{background:rgba(46,204,138,.15);color:var(--green)}
    .bstart{display:block;width:calc(100% - 2.4rem);margin:0 1.2rem 1.2rem;padding:13px;font-size:14px;font-weight:600;background:var(--purple);color:white;border:none;border-radius:12px;cursor:pointer}
    .feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;padding:2rem 1.5rem 5rem;max-width:900px;margin:0 auto}
    .feat{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:1.4rem}
    .fi{font-size:24px;margin-bottom:10px}
    .ft{font-size:14px;font-weight:600;margin-bottom:5px}
    .fd{font-size:13px;color:var(--text-soft);line-height:1.5}
    .toast{position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--green);color:white;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:500;white-space:nowrap;z-index:999}
    .ahdr{padding:1rem 1.2rem;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0}
    .back{background:none;border:none;color:var(--text-soft);cursor:pointer;font-size:20px;line-height:1}
    .ainfo{display:flex;align-items:center;gap:10px;flex:1}
    .acirc{width:38px;height:38px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;font-family:'Syne',sans-serif;color:var(--purple-light);flex-shrink:0}
    .aname{font-size:15px;font-weight:600}
    .astat{font-size:12px;color:var(--green)}
    .badge{font-size:11px;background:rgba(83,74,183,.2);color:var(--purple-light);padding:3px 10px;border-radius:999px}
    .avzone{background:var(--bg2);border-bottom:1px solid var(--border);padding:1.2rem;display:flex;justify-content:center;flex-shrink:0}
    .avframe{width:100px;height:100px;border-radius:50%;border:3px solid var(--purple);background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;font-family:'Syne',sans-serif;color:var(--purple-light);transition:box-shadow .3s}
    .avframe.spk{box-shadow:0 0 0 8px rgba(83,74,183,.25),0 0 0 16px rgba(83,74,183,.1)}
    .carea{flex:1;overflow-y:auto;padding:1.2rem;display:flex;flex-direction:column;gap:12px}
    .carea::-webkit-scrollbar{width:3px}
    .carea::-webkit-scrollbar-thumb{background:var(--surface);border-radius:4px}
    .msg{display:flex;gap:10px;align-items:flex-start}
    .msg.u{flex-direction:row-reverse}
    .mav{width:30px;height:30px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--purple-light);flex-shrink:0}
    .bbl{font-size:13px;line-height:1.6;padding:10px 14px;border-radius:14px;max-width:80%;white-space:pre-wrap}
    .bbl.ai{background:var(--surface);color:var(--text);border-radius:4px 14px 14px 14px}
    .bbl.usr{background:var(--purple);color:white;border-radius:14px 4px 14px 14px}
    .typing{display:flex;gap:4px;align-items:center;padding:10px 14px;background:var(--surface);border-radius:4px 14px 14px 14px;width:fit-content}
    .tdot{width:6px;height:6px;border-radius:50%;background:var(--text-muted);animation:td 1.2s ease-in-out infinite}
    .tdot:nth-child(2){animation-delay:.2s}.tdot:nth-child(3){animation-delay:.4s}
    @keyframes td{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    .iarea{padding:1rem 1.2rem;border-top:1px solid var(--border);display:flex;gap:10px;align-items:flex-end;flex-shrink:0}
    .cinput{flex:1;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-size:14px;font-family:'Inter',sans-serif;color:var(--text);resize:none;outline:none;max-height:100px;line-height:1.5}
    .cinput:focus{border-color:var(--purple)}
    .cinput::placeholder{color:var(--text-muted)}
    .sbtn{width:40px;height:40px;border-radius:50%;background:var(--purple);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sbtn:hover{background:var(--purple-light)}
  `;

  if (screen === "landing") return (
    <div style={{ minHeight:"100vh" }}>
      <style>{S}</style>
      <nav>
        <div className="logo">talk<span>ova</span></div>
        <div style={{ display:"flex", gap:12 }}>
          <button className="btn-g" onClick={() => startApp()}>Try free</button>
          <button className="btn-p" onClick={() => startApp()}>Start learning</button>
        </div>
      </nav>
      <section className="hero">
        <div className="eyebrow"><div className="pulse"/> AI-powered · Available 24/7</div>
        <h1>Speak English<br/>with <em>real confidence</em></h1>
        <p className="hsub">Practice natural conversations with an AI tutor that corrects you gently, explains why, and adapts to your level — in Spanish or English.</p>
        <div className="wlf">
          <input className="wli" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)}/>
          <button className="btn-cta" onClick={() => { if (!email.includes("@")) { showToast("Please enter a valid email 📧"); return; } showToast("¡You're on the list! 🎉"); setEmail(""); }}>Get early access</button>
        </div>
        <p className="hint">Free to start — no credit card needed</p>
      </section>
      <section className="ts">
        <p className="slabel">Choose your tutor</p>
        <div className="trow">
          {TUTORS.map(t => (
            <div key={t.name} className={`tc${tutor.name===t.name?" sel":""}`} onClick={() => setTutor(t)}>
              <div className="tav">{t.initial}</div>
              <div className="tn">{t.name}</div>
              <div className="td2">{t.tagline}</div>
            </div>
          ))}
        </div>
        <div className="dbox">
          <div className="dhdr"><div className="ddot"/> Live preview — {tutor.name} is online</div>
          <div className="dmsgs">
            <div className="dm"><div className="dav">{tutor.initial}</div><div className="db ai">Hi! I'm {tutor.name} 👋 Let's practice ordering at a restaurant. You go first!</div></div>
            <div className="dm u"><div className="dav" style={{background:"var(--purple)",color:"white"}}>U</div><div className="db usr">I want order a coffee please.</div></div>
            <div className="dm"><div className="dav">{tutor.initial}</div><div className="db ai">Almost perfect! <span className="tag tw">I want order</span>→<span className="tag tr">I'd like to order ✓</span> We add "to" after "want." Try again!</div></div>
          </div>
          <button className="bstart" onClick={() => startApp()}>Start your free session with {tutor.name} →</button>
        </div>
      </section>
      <div className="feats">
        {[{icon:"💬",title:"Real conversations",desc:"Practice everyday situations with a patient AI partner."},{icon:"✨",title:"Instant corrections",desc:"Learn from mistakes without embarrassment."},{icon:"🌎",title:"Built for Latinos",desc:"Switch to Spanish whenever you need to."},{icon:"📈",title:"Track your growth",desc:"See your progress week by week."}].map(f=>(
          <div key={f.title} className="feat"><div className="fi">{f.icon}</div><div className="ft">{f.title}</div><div className="fd">{f.desc}</div></div>
        ))}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" }}>
      <style>{S}</style>
      <div className="ahdr">
        <button className="back" onClick={() => setScreen("landing")}>←</button>
        <div className="ainfo">
          <div className="acirc">{tutor.initial}</div>
          <div><div className="aname">{tutor.name}</div><div className="astat">● Online</div></div>
        </div>
        <span className="badge">Beginner</span>
      </div>
      <div className="avzone">
        <div className={`avframe${speaking?" spk":""}`}>{tutor.initial}</div>
      </div>
      <div className="carea" ref={chatRef}>
        {messages.map((m,i) => (
          <div key={i} className={`msg${m.role==="user"?" u":""}`}>
            <div className="mav" style={m.role==="user"?{background:"var(--purple)",color:"white"}:{}}>{m.role==="user"?"U":tutor.initial}</div>
            <div className={`bbl ${m.role==="user"?"usr":"ai"}`}>{m.content}</div>
          </div>
        ))}
        {loading && <div className="msg"><div className="mav">{tutor.initial}</div><div className="typing"><div className="tdot"/><div className="tdot"/><div className="tdot"/></div></div>}
      </div>
      <div className="iarea">
        <textarea className="cinput" rows={1} placeholder="Type in English or Spanish..." value={input}
          onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
          onKeyDown={handleKey}/>
        <button className="sbtn" onClick={send}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  );
}
