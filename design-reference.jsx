import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════
// REPRIME TERMINAL — INVESTOR PORTAL V3 (LIGHT THEME)
// Visual prototype — all data is illustrative
// ═══════════════════════════════════════════════════════════

const C = {
  navy: "#0E3470", gold: "#BC9C45", black: "#0A0A0A", white: "#FFFFFF",
  blue: "#1D5FB8", brightBlue: "#00A1FF", teal: "#009080", green: "#0B8A4D",
  greenLight: "#ECFDF5", greenBorder: "#A7F3D0",
  red: "#DC2626", redLight: "#FEF2F2", redBorder: "#FECACA",
  amber: "#D97706", amberLight: "#FFFBEB", amberBorder: "#FDE68A",
  gray100: "#F7F8FA", gray200: "#EEF0F4", gray300: "#D1D5DB",
  gray400: "#9CA3AF", gray500: "#6B7280", gray600: "#4B5563", gray700: "#374151",
  goldSoft: "#D4B96A", goldBg: "#FDF8ED", goldBorder: "#ECD9A0",
  pageBg: "#F2F4F8", cardBg: "#FFFFFF",
};

const FONT = "'Poppins', sans-serif";
const DISPLAY = "'Bodoni Moda', Georgia, serif";

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Bodoni+Moda:ital,wght@0,400;0,700;1,400&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
@keyframes stampIn { 0%{transform:scale(3) rotate(-15deg);opacity:0}60%{transform:scale(1) rotate(-6deg);opacity:1}100%{transform:scale(1) rotate(-6deg);opacity:1} }
@keyframes confettiDrop { 0%{transform:translateY(-100vh) rotate(0)}100%{transform:translateY(100vh) rotate(720deg)} }
@keyframes liveDot { 0%,100%{opacity:1}50%{opacity:0.3} }
@keyframes slideIn { from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)} }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: ${C.gray100}; }
::-webkit-scrollbar-thumb { background: ${C.gray300}; border-radius: 3px; }
`;

// ─── COUNTDOWN HOOK ───
function useCountdown(targetDate) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, new Date(targetDate).getTime() - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
    total: diff,
  };
}

// ─── FLIP DIGIT (for big countdown) ───
function FlipDigit({ value, label, urgent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 58, height: 68, borderRadius: 8,
        background: urgent ? "#1C0A0A" : C.navy,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT, fontSize: 32, fontWeight: 800,
        color: urgent ? "#FF4444" : C.white,
        position: "relative", overflow: "hidden",
        boxShadow: urgent ? "0 4px 16px rgba(220,38,38,0.25)" : "0 4px 16px rgba(14,52,112,0.3)",
        border: urgent ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.08)" }} />
        {String(value).padStart(2, "0")}
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, color: urgent ? C.red : C.gray500, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</span>
    </div>
  );
}

// ─── BIG COUNTDOWN ───
function BigCountdown({ targetDate, label, subLabel }) {
  const { days, hours, mins, secs, total } = useCountdown(targetDate);
  const urgent = days <= 2 && total > 0;
  if (total === 0) return (
    <div style={{ textAlign: "center", padding: 16, background: C.gray100, borderRadius: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: 1 }}>{label} — EXPIRED</span>
    </div>
  );
  return (
    <div style={{
      background: urgent ? "#FEF2F2" : C.white, borderRadius: 14, padding: "18px 20px",
      border: `1px solid ${urgent ? C.redBorder : C.gray200}`,
      boxShadow: urgent ? "0 0 0 3px rgba(220,38,38,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: urgent ? C.red : C.green,
            animation: urgent ? "pulse 1.2s infinite" : "liveDot 2s infinite",
            boxShadow: `0 0 6px ${urgent ? C.red : C.green}`,
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: urgent ? C.red : C.navy, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
        </div>
        {urgent && <span style={{ fontSize: 9, fontWeight: 700, color: C.white, background: C.red, padding: "2px 8px", borderRadius: 4, letterSpacing: 1 }}>URGENT</span>}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <FlipDigit value={days} label="Days" urgent={urgent} />
        <div style={{ fontSize: 24, fontWeight: 300, color: C.gray300, alignSelf: "flex-start", marginTop: 16 }}>:</div>
        <FlipDigit value={hours} label="Hours" urgent={urgent} />
        <div style={{ fontSize: 24, fontWeight: 300, color: C.gray300, alignSelf: "flex-start", marginTop: 16 }}>:</div>
        <FlipDigit value={mins} label="Min" urgent={urgent} />
        <div style={{ fontSize: 24, fontWeight: 300, color: C.gray300, alignSelf: "flex-start", marginTop: 16 }}>:</div>
        <FlipDigit value={secs} label="Sec" urgent={urgent} />
      </div>
      {subLabel && <div style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: C.gray500, fontWeight: 400 }}>{subLabel}</div>}
    </div>
  );
}

// ─── SPARKLINE (Tufte) ───
function Sparkline({ data, color = C.navy, width = 100, height = 28 }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((data[data.length - 1] - min) / range) * height} r="2.5" fill={color} />
    </svg>
  );
}

// ─── MARKET CYCLE (Howard Marks) ───
function CycleIndicator() {
  const pos = 68;
  return (
    <div style={{ background: C.white, borderRadius: 12, padding: "14px 18px", border: `1px solid ${C.gray200}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: 1 }}>Market Cycle Position</span>
        <span style={{ fontSize: 9, color: C.gray400 }}>Howard Marks Framework</span>
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: 5, background: C.gray200, overflow: "visible" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 5, background: `linear-gradient(90deg, ${C.green} 0%, ${C.gold} 40%, ${C.amber} 60%, ${C.red} 100%)`, opacity: 0.6 }} />
        <div style={{ position: "absolute", top: -3, left: `${pos}%`, transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: C.gold, border: "3px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 9, color: C.green, fontWeight: 600 }}>OPPORTUNITY</span>
        <span style={{ fontSize: 9, color: C.amber, fontWeight: 700 }}>← WE ARE HERE</span>
        <span style={{ fontSize: 9, color: C.red, fontWeight: 600 }}>CAUTION</span>
      </div>
    </div>
  );
}

// ─── ACTIVITY FEED (Nir Eyal) ───
const activityItems = [
  { time: "2 min ago", text: "New appraisal report uploaded to DD Room", type: "doc" },
  { time: "14 min ago", text: "Terminal member from New York scheduled a call", type: "meeting" },
  { time: "38 min ago", text: "Insurance quotes received — 3 carriers responded", type: "update" },
  { time: "1 hr ago", text: "Rent roll verified against bank statements", type: "verified" },
  { time: "2 hr ago", text: "Terminal member from Tel Aviv viewed this deal", type: "view" },
  { time: "4 hr ago", text: "Phase I ESA report marked as verified", type: "verified" },
];
function ActivityFeed() {
  const icons = { doc: "📄", meeting: "📅", update: "🔔", verified: "✓", view: "👁" };
  const colors = { doc: C.blue, meeting: C.gold, update: C.amber, verified: C.green, view: C.gray500 };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {activityItems.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: i < activityItems.length - 1 ? `1px solid ${C.gray200}` : "none", animation: `slideIn 0.3s ease ${i * 0.06}s both` }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: `${colors[item.type]}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: item.type === "verified" ? 11 : 12, color: colors[item.type], fontWeight: 700 }}>{icons[item.type]}</div>
          <div>
            <div style={{ fontSize: 12, color: C.gray700, fontWeight: 400, lineHeight: 1.4 }}>{item.text}</div>
            <div style={{ fontSize: 10, color: C.gray400, marginTop: 1 }}>{item.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CONFETTI ───
function Confetti() {
  const pcs = Array.from({ length: 30 }, () => ({
    left: Math.random() * 100, delay: Math.random() * 2, dur: 2 + Math.random() * 3,
    color: [C.gold, C.goldSoft, "#E8D5A0", C.white, C.navy][Math.floor(Math.random() * 5)],
    size: 4 + Math.random() * 6,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 5 }}>
      {pcs.map((p, i) => <div key={i} style={{ position: "absolute", left: `${p.left}%`, top: -20, width: p.size, height: p.size * 1.5, background: p.color, borderRadius: 1, animation: `confettiDrop ${p.dur}s linear ${p.delay}s infinite`, opacity: 0.8 }} />)}
    </div>
  );
}

// ─── IMAGE CAROUSEL ───
function ImageCarousel({ photos }) {
  const [idx, setIdx] = useState(0);
  const len = photos.length;
  const go = d => setIdx((idx + d + len) % len);
  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", height: 360, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)", transform: `translateX(-${idx * 100}%)`, height: "100%" }}>
        {photos.map((p, i) => <div key={i} style={{ minWidth: "100%", height: "100%", background: `url(${p}) center/cover no-repeat` }} />)}
      </div>
      {len > 1 && <>
        <button onClick={() => go(-1)} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", color: C.navy, fontSize: 18, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>‹</button>
        <button onClick={() => go(1)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 42, height: 42, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", color: C.navy, fontSize: 18, cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>›</button>
        <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
          {photos.map((_, i) => <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 24 : 8, height: 8, borderRadius: 4, cursor: "pointer", background: i === idx ? C.gold : "rgba(255,255,255,0.6)", transition: "all 0.3s", boxShadow: i === idx ? `0 0 8px ${C.gold}` : "none" }} />)}
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, background: "rgba(0,0,0,0.5)", color: C.white, padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, backdropFilter: "blur(8px)" }}>{idx + 1} / {len}</div>
      </>}
    </div>
  );
}

// ─── IRR CALCULATOR ───
function IRRCalculator({ deal }) {
  const [opt, setOpt] = useState("assignment");
  const [split, setSplit] = useState(80);
  const [pref, setPref] = useState(8);
  const [acq, setAcq] = useState(1);
  const base = parseFloat(deal.gplpIRR);
  const custom = (base + (split - 80) * 0.15 - (acq - 1) * 0.8 + (pref - 8) * -0.3).toFixed(1);

  return (
    <div style={{ background: C.navy, borderRadius: 16, padding: 28, color: C.white, boxShadow: "0 4px 20px rgba(14,52,112,0.2)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>Returns Calculator</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[{ k: "assignment", l: "Assignment" }, { k: "gplp", l: "GP / LP" }, { k: "custom", l: "Custom Terms" }].map(o => (
          <button key={o.k} onClick={() => setOpt(o.k)} style={{ flex: 1, padding: "10px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: FONT, fontSize: 11, fontWeight: 600, background: opt === o.k ? C.gold : "rgba(255,255,255,0.08)", color: opt === o.k ? C.navy : "rgba(255,255,255,0.5)", transition: "all 0.2s" }}>{o.l}</button>
        ))}
      </div>

      {opt === "assignment" && <div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: "#34D399", lineHeight: 1 }}>{deal.assignmentIRR}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>Projected IRR — Assignment</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 14, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.5)" }}><span>Assignment Fee</span><span style={{ color: C.white, fontWeight: 600 }}>{deal.assignmentFee}</span></div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 0" }} />
          <div style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>All fees included in IRR above</div>
        </div>
      </div>}

      {opt === "gplp" && <div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: "#34D399", lineHeight: 1 }}>{deal.gplpIRR}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>Projected IRR — GP/LP Partnership</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: 14, fontSize: 12 }}>
          {[["Acquisition Fee", deal.acqFee], ["Asset Management", deal.assetMgmtFee + " annually"], ["GP Carry", deal.gpCarry], ["Equity Required", deal.equityRequired]].map(([l, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}><span>{l}</span><span style={{ color: C.white, fontWeight: 600 }}>{v}</span></div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 0" }} />
          <div style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>All fees included in IRR above</div>
        </div>
      </div>}

      {opt === "custom" && <div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: "#60A5FA", lineHeight: 1 }}>{custom}%</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>Projected IRR — Your Custom Terms</div>
        </div>
        {[{ label: "Your LP Split", value: split, set: setSplit, min: 50, max: 95 }, { label: "Preferred Return", value: pref, set: setPref, min: 5, max: 12 }, { label: "Acquisition Fee", value: acq, set: setAcq, min: 0, max: 3 }].map((s, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{s.value}%</span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.label === "Acquisition Fee" ? 0.25 : 1} value={s.value} onChange={e => s.set(Number(e.target.value))} style={{ width: "100%", accentColor: C.gold, height: 4, cursor: "pointer" }} />
          </div>
        ))}
        <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, marginTop: 4 }}>All fees included in projected IRR</div>
      </div>}
    </div>
  );
}

// ─── MEETING SCHEDULER ───
function MeetingScheduler() {
  const [sel, setSel] = useState(null);
  const [done, setDone] = useState(false);
  const slots = [
    { day: "Tomorrow", time: "10:00 AM EST", ok: true }, { day: "Tomorrow", time: "2:00 PM EST", ok: true },
    { day: "Wed, Mar 19", time: "9:00 AM EST", ok: true }, { day: "Wed, Mar 19", time: "11:30 AM EST", ok: false },
    { day: "Thu, Mar 20", time: "10:00 AM EST", ok: true }, { day: "Thu, Mar 20", time: "3:00 PM EST", ok: true },
  ];
  if (done) return (
    <div style={{ background: C.greenLight, borderRadius: 12, padding: 28, border: `1px solid ${C.greenBorder}`, textAlign: "center" }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>Meeting Confirmed</div>
      <div style={{ fontSize: 13, color: C.navy, fontWeight: 500, marginTop: 4 }}>{slots[sel]?.day} at {slots[sel]?.time}</div>
      <div style={{ fontSize: 11, color: C.gray500, marginTop: 8 }}>Calendar invite sent. A member of the RePrime team will join the call.</div>
    </div>
  );
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
      {slots.map((s, i) => (
        <button key={i} disabled={!s.ok} onClick={() => setSel(i)} style={{ padding: "12px 14px", borderRadius: 10, cursor: s.ok ? "pointer" : "not-allowed", border: sel === i ? `2px solid ${C.gold}` : `1px solid ${C.gray200}`, background: sel === i ? C.goldBg : C.white, fontFamily: FONT, textAlign: "left", opacity: s.ok ? 1 : 0.35 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.navy }}>{s.day}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.gold }}>{s.time}</div>
        </button>
      ))}
    </div>
    {sel !== null && <button onClick={() => setDone(true)} style={{ width: "100%", padding: "14px", background: C.gold, color: C.navy, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Confirm — {slots[sel].day} at {slots[sel].time}</button>}
    <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: C.gray500, paddingTop: 12, borderTop: `1px solid ${C.gray200}` }}>
      None of these work? <span style={{ color: C.gold, cursor: "pointer", fontWeight: 600 }}>Email us your availability →</span>
    </div>
  </div>);
}

// ─── DATA ───
const now = Date.now();
const day = 86400000;
const deals = [
  {
    id: 1, city: "Memphis", state: "TN", name: "Riverside Gardens", type: "Multifamily", sqft: "186,400 SF", units: "232 Units",
    purchasePrice: "$14,200,000", noi: "$1,278,000", capRate: "9.0%", irr: "22.4%", coc: "14.8%", dscr: "1.62x", equityRequired: "$4,600,000",
    sellerFinancing: false, specialTerms: "Loan assumption — 5.2% fixed, 22 yrs remaining",
    loanEstimate: "$9,940,000 at 70% LTV · 6.25% · 30-yr", ddDeadline: new Date(now + 4 * day + 7 * 3600000).toISOString(),
    closeDeadline: new Date(now + 34 * day).toISOString(), extensionDeadline: new Date(now + 64 * day).toISOString(),
    approval: 70, status: "active", assignmentFee: "3%",
    photos: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=500&fit=crop","https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=500&fit=crop","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=500&fit=crop","https://images.unsplash.com/photo-1565953522043-baea692f4bff?w=800&h=500&fit=crop"],
    gpCarry: "20% above 8% pref", acqFee: "1%", assetMgmtFee: "2%", loanFee: "1 point",
    classType: "B+", yearBuilt: 1998, occupancy: "91%", comparables: [8.2,8.5,8.8,9.1,8.7,9.3,9.0,8.9,9.2,9.5,9.0],
    viewing: 3, meetings: 2, qRelease: "1 of 3 · Q1 2026", assignmentIRR: "26.1%", gplpIRR: "22.4%",
    neighborhood: "East Memphis", pop: "1.34M", jobGrowth: "+2.1%",
    highlights: ["Basis 28% below replacement ($78K/unit vs $108K)","Loan assumption saves $420K in origination","92% occ. with $85/unit rent upside","Sub-meter water = $186K additional NOI"],
  },
  {
    id: 2, city: "Birmingham", state: "AL", name: "Galleria Commons", type: "Retail — Grocery Anchored", sqft: "74,200 SF", units: null,
    purchasePrice: "$8,750,000", noi: "$875,000", capRate: "10.0%", irr: "19.1%", coc: "11.2%", dscr: "1.88x", equityRequired: "$2,800,000",
    sellerFinancing: true, specialTerms: "Seller carry $2.1M at 5.5% — 10yr, IO 3 yrs",
    loanEstimate: "$6,125,000 at 70% LTV · 6.5% · 25-yr", ddDeadline: new Date(now + 12 * day).toISOString(),
    closeDeadline: new Date(now + 42 * day).toISOString(), extensionDeadline: new Date(now + 72 * day).toISOString(),
    approval: 85, status: "active", assignmentFee: "3%",
    photos: ["https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=500&fit=crop","https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=500&fit=crop","https://images.unsplash.com/photo-1555636222-cae831e670b3?w=800&h=500&fit=crop"],
    gpCarry: "20% above 8% pref", acqFee: "1%", assetMgmtFee: "2%", loanFee: "1 point",
    classType: "A", yearBuilt: 2005, occupancy: "97%", comparables: [9.1,9.4,9.8,10.1,9.7,10.3,10.0,9.9,10.2,10.5,10.0],
    viewing: 5, meetings: 3, qRelease: "2 of 3 · Q1 2026", assignmentIRR: "23.8%", gplpIRR: "19.1%",
    neighborhood: "Hoover/US-31 Corridor", pop: "1.12M", jobGrowth: "+1.8%",
    highlights: ["Publix anchor — investment-grade, 12 yrs remaining","Seller financing = $700K total out of pocket","10% cap with 97% occupancy","38K pop within 3-mile ring, +2.3% growth"],
  },
  {
    id: 3, city: "Little Rock", state: "AR", name: "Port Industrial Center", type: "Industrial — Warehouse", sqft: "312,000 SF", units: null,
    purchasePrice: "$22,500,000", noi: "$2,025,000", capRate: "9.0%", irr: "24.7%", coc: "16.3%", dscr: "1.74x", equityRequired: "$7,200,000",
    sellerFinancing: false, specialTerms: "Triple net — zero landlord responsibility",
    loanEstimate: "$15,750,000 at 70% LTV · 6.0% · 30-yr", ddDeadline: new Date(now + 1.5 * day).toISOString(),
    closeDeadline: new Date(now + 31 * day).toISOString(), extensionDeadline: null,
    approval: 95, status: "active", assignmentFee: "3%",
    photos: ["https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=500&fit=crop","https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=500&fit=crop","https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=500&fit=crop"],
    gpCarry: "20% above 8% pref", acqFee: "1%", assetMgmtFee: "2%", loanFee: "1 point",
    classType: "A", yearBuilt: 2012, occupancy: "100%", comparables: [7.8,8.1,8.4,8.7,8.5,9.0,8.8,8.9,9.1,9.3,9.0],
    viewing: 8, meetings: 4, qRelease: "3 of 3 · Q1 2026", assignmentIRR: "29.4%", gplpIRR: "24.7%",
    neighborhood: "Port of Little Rock", pop: "748K", jobGrowth: "+2.4%",
    highlights: ["NNN — true passive, zero landlord exposure","FedEx hub 4 mi — logistics moat","24.7% IRR at 100% occupancy","$1.2M tenant TI = long-term commitment"],
  },
  {
    id: 4, city: "Tulsa", state: "OK", name: "Midtown Terrace", type: "Multifamily", sqft: "98,600 SF", units: "128 Units",
    purchasePrice: "$7,400,000", noi: "$666,000", capRate: "9.0%", irr: "20.8%", coc: "13.5%", dscr: "1.55x", equityRequired: "$2,400,000",
    sellerFinancing: false, specialTerms: "None", loanEstimate: "$5,180,000 at 70% LTV · 6.25% · 30-yr",
    ddDeadline: new Date(now - 2 * day).toISOString(), closeDeadline: new Date(now + 15 * day).toISOString(), extensionDeadline: null,
    approval: 100, status: "assigned", assignmentFee: "3%",
    photos: ["https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=800&h=500&fit=crop"],
    gpCarry: "20% above 8% pref", acqFee: "1%", assetMgmtFee: "2%", loanFee: "1 point",
    classType: "B", yearBuilt: 1994, occupancy: "94%", comparables: [8.0,8.3,8.6,8.9,8.7,9.0,8.8,9.1,9.0],
    viewing: 0, meetings: 0, qRelease: "Q4 2025 — Closed", assignmentIRR: "25.2%", gplpIRR: "20.8%",
    neighborhood: "Midtown Tulsa", pop: "1.01M", jobGrowth: "+1.5%",
    highlights: ["31% below replacement at $57,800/unit","Closed in 28 days — full assignment"],
  },
];

const dataRoomFolders = [
  { name: "Purchase & Sale Agreement", icon: "⚖️", st: "complete", docs: [{ n: "Executed PSA — Final", s: "2.4 MB", t: "PDF", v: true },{ n: "Amendment #1 — Extension", s: "840 KB", t: "PDF", v: true },{ n: "Amendment #2 — Price Adj.", s: "620 KB", t: "PDF", v: true },{ n: "Earnest Money Receipt", s: "180 KB", t: "PDF", v: true }] },
  { name: "Financial Documents", icon: "💰", st: "complete", docs: [{ n: "Trailing 12 P&L (T12)", s: "1.8 MB", t: "XLSX", v: true },{ n: "Current Rent Roll", s: "960 KB", t: "XLSX", v: true },{ n: "Historical P&L (3yr)", s: "3.1 MB", t: "XLSX", v: true },{ n: "OpEx Ledger", s: "2.2 MB", t: "XLSX", v: true },{ n: "AR/AP Aging Report", s: "740 KB", t: "XLSX", v: true },{ n: "Bank Stmt Reconciliation", s: "4.6 MB", t: "PDF", v: true }] },
  { name: "Leases & Tenant Files", icon: "📋", st: "partial", docs: [{ n: "Master Lease Schedule", s: "1.4 MB", t: "XLSX", v: true },{ n: "Anchor Lease — Publix", s: "8.2 MB", t: "PDF", v: true },{ n: "Tenant Estoppels (1/2)", s: "6.4 MB", t: "PDF", v: true },{ n: "Tenant Estoppels (2/2)", s: "—", t: "PDF", v: false },{ n: "Lease Abstracts", s: "2.1 MB", t: "XLSX", v: true }] },
  { name: "Tax Documents", icon: "🏛️", st: "complete", docs: [{ n: "Property Tax Assessment", s: "1.2 MB", t: "PDF", v: true },{ n: "Tax Payment History (5yr)", s: "680 KB", t: "PDF", v: true }] },
  { name: "Title & Survey", icon: "📐", st: "complete", docs: [{ n: "Preliminary Title Report", s: "3.8 MB", t: "PDF", v: true },{ n: "ALTA/NSPS Survey", s: "12.4 MB", t: "PDF", v: true },{ n: "Exception Documents", s: "2.1 MB", t: "PDF", v: true }] },
  { name: "Property Condition", icon: "🔧", st: "partial", docs: [{ n: "PCA Report", s: "18.6 MB", t: "PDF", v: true },{ n: "Roof Inspection", s: "4.2 MB", t: "PDF", v: true },{ n: "HVAC Assessment", s: "3.8 MB", t: "PDF", v: true },{ n: "Plumbing Scope — Pending", s: "—", t: "PDF", v: false },{ n: "Structural Engineering", s: "7.1 MB", t: "PDF", v: true },{ n: "Drone Footage & Photos", s: "142 MB", t: "ZIP", v: true }] },
  { name: "Environmental", icon: "🌿", st: "complete", docs: [{ n: "Phase I ESA — No RECs", s: "14.2 MB", t: "PDF", v: true },{ n: "Asbestos Survey", s: "2.8 MB", t: "PDF", v: true },{ n: "Lead Paint Disclosure", s: "440 KB", t: "PDF", v: true }] },
  { name: "Appraisals & Underwriting", icon: "📊", st: "complete", docs: [{ n: "MAI Appraisal", s: "22.4 MB", t: "PDF", v: true },{ n: "ARGUS Enterprise Model", s: "8.6 MB", t: "ARGUS", v: true },{ n: "Bank Underwriting Pkg", s: "5.2 MB", t: "PDF", v: true },{ n: "RePrime Valuation", s: "3.4 MB", t: "PDF", v: true }] },
  { name: "Insurance", icon: "🛡️", st: "complete", docs: [{ n: "Current Policy", s: "4.8 MB", t: "PDF", v: true },{ n: "Loss Run (5yr)", s: "1.6 MB", t: "PDF", v: true },{ n: "Flood Zone Determination", s: "320 KB", t: "PDF", v: true }] },
  { name: "Investor Materials", icon: "📈", st: "complete", docs: [{ n: "IC Memo", s: "2.8 MB", t: "PDF", v: true },{ n: "Financial Model", s: "4.2 MB", t: "XLSX", v: true },{ n: "Presentation Deck", s: "16.8 MB", t: "PDF", v: true }] },
];

// ═══════════════════════════════════════════════════════════
// LOGIN (DARK — keeps the dramatic entrance)
// ═══════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const inputStyle = { width: "100%", padding: "14px 16px", marginTop: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: C.white, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ minHeight: "100vh", background: "#07090F", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 30% 20%, rgba(14,52,112,0.3) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(188,156,69,0.08) 0%, transparent 50%)` }} />
      <div style={{ width: 440, padding: 52, position: "relative", zIndex: 2, background: "rgba(255,255,255,0.02)", borderRadius: 20, border: "1px solid rgba(188,156,69,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", animation: "fadeUp 0.6s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 12, background: `linear-gradient(135deg, ${C.gold}, ${C.goldSoft})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 28, color: C.navy, fontFamily: DISPLAY, boxShadow: `0 4px 24px rgba(188,156,69,0.3)` }}>R</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.white, letterSpacing: 4 }}>REPRIME</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: C.gold, letterSpacing: 6, textTransform: "uppercase", fontFamily: DISPLAY, fontStyle: "italic" }}>Terminal</div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1.5 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="investor@example.com" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 36 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1.5 }}>Password</label>
          <input value={pass} onChange={e => setPass(e.target.value)} type="password" placeholder="••••••••" style={inputStyle} />
        </div>
        <button onClick={onLogin} style={{ width: "100%", padding: "16px", border: "none", borderRadius: 10, cursor: "pointer", background: `linear-gradient(135deg, ${C.gold}, ${C.goldSoft})`, color: C.navy, fontSize: 14, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: FONT, boxShadow: `0 4px 20px rgba(188,156,69,0.3)` }}>Sign In</button>
        <p style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>Membership by invitation only</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEAL CARD — LIGHT
// ═══════════════════════════════════════════════════════════
function DealCard({ deal, onClick }) {
  const { days, hours, mins, secs, total } = useCountdown(deal.ddDeadline);
  const totalDays = days + hours / 24;
  const isAssigned = deal.status === "assigned";
  let uColor = C.green, uBg = C.greenLight, uBdr = C.greenBorder;
  if (isAssigned || total === 0) { uColor = C.gray500; uBg = C.gray100; uBdr = C.gray300; }
  else if (totalDays <= 2) { uColor = C.red; uBg = C.redLight; uBdr = C.redBorder; }
  else if (totalDays <= 7) { uColor = C.amber; uBg = C.amberLight; uBdr = C.amberBorder; }

  return (
    <div onClick={onClick} style={{ background: C.white, borderRadius: 16, overflow: "hidden", cursor: "pointer", border: `1px solid ${C.gray200}`, transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", position: "relative", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      onMouseEnter={e => { if (!isAssigned) { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 20px 50px rgba(14,52,112,0.12)"; e.currentTarget.style.borderColor = C.gold; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = C.gray200; }}>

      {/* ASSIGNED STAMP */}
      {isAssigned && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(7,9,15,0.88)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Confetti />
          <div style={{ position: "relative", zIndex: 6, textAlign: "center", animation: "stampIn 0.8s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div style={{ border: `3px solid ${C.gold}`, borderRadius: 14, padding: "20px 40px", transform: "rotate(-6deg)", background: "rgba(188,156,69,0.06)", boxShadow: `0 0 40px rgba(188,156,69,0.15)` }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: C.gold, letterSpacing: 4, marginBottom: 6 }}>REPRIME TERMINAL</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.gold, letterSpacing: 5, fontFamily: DISPLAY }}>CLOSED</div>
              <div style={{ width: 60, height: 2, background: C.gold, margin: "8px auto", opacity: 0.4 }} />
              <div style={{ fontSize: 10, color: "rgba(188,156,69,0.7)", letterSpacing: 1.5 }}>FULLY EXECUTED</div>
            </div>
          </div>
        </div>
      )}

      {/* Photo */}
      <div style={{ height: 200, background: `url(${deal.photos[0]}) center/cover`, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 30%, transparent 55%, rgba(0,0,0,0.45) 100%)" }} />
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
          <span style={{ background: C.navy, color: C.white, padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{deal.type}</span>
          {deal.sellerFinancing && <span style={{ background: C.gold, color: C.navy, padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700 }}>SELLER FINANCING</span>}
        </div>
        {!isAssigned && <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.55)", color: C.gold, padding: "5px 12px", borderRadius: 6, fontSize: 9, fontWeight: 600, letterSpacing: 0.5 }}>{deal.qRelease}</div>}
        {deal.viewing > 0 && !isAssigned && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 14px", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", animation: "liveDot 1.5s infinite", boxShadow: "0 0 6px #34D399" }} />
              <span style={{ fontSize: 11, color: C.white, fontWeight: 500 }}>{deal.viewing} Terminal members viewing</span>
            </div>
            {deal.meetings > 0 && <span style={{ fontSize: 10, color: C.gold, fontWeight: 600 }}>{deal.meetings} meetings booked</span>}
          </div>
        )}
      </div>

      {/* LIGHT BODY */}
      <div style={{ padding: "18px 22px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: C.navy, lineHeight: 1.2 }}>{deal.name}</div>
            <div style={{ fontSize: 11, color: C.gray500, marginTop: 3 }}>{deal.city}, {deal.state} · {deal.sqft}{deal.units ? ` · ${deal.units}` : ""} · Class {deal.classType}</div>
          </div>
          {deal.comparables && <Sparkline data={deal.comparables} color={C.navy} />}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 14px", margin: "14px 0", padding: "14px 0", borderTop: `1px solid ${C.gray200}`, borderBottom: `1px solid ${C.gray200}` }}>
          {[{ l: "Purchase", v: deal.purchasePrice }, { l: "NOI", v: deal.noi }, { l: "Cap Rate", v: deal.capRate }, { l: "IRR", v: deal.irr, c: C.green }, { l: "Cash-on-Cash", v: deal.coc, c: C.green }, { l: "DSCR", v: deal.dscr }].map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: 9, fontWeight: 600, color: C.gray400, textTransform: "uppercase", letterSpacing: 0.5 }}>{m.l}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: m.c || C.navy }}>{m.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: C.gray400, textTransform: "uppercase" }}>Equity Required</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{deal.equityRequired}</div>
          </div>
          {deal.specialTerms !== "None" && (
            <div style={{ background: C.goldBg, border: `1px solid ${C.goldBorder}`, borderRadius: 8, padding: "6px 10px", maxWidth: 180 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.gold, textTransform: "uppercase" }}>Special Terms</div>
              <div style={{ fontSize: 10, color: C.navy, lineHeight: 1.3, marginTop: 2 }}>{deal.specialTerms.length > 55 ? deal.specialTerms.slice(0, 55) + "…" : deal.specialTerms}</div>
            </div>
          )}
        </div>

        {/* COUNTDOWN BAR */}
        {!isAssigned && total > 0 ? (
          <div style={{ background: uBg, borderRadius: 10, padding: "12px 16px", border: `1px solid ${uBdr}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: uColor, animation: totalDays <= 2 ? "pulse 1.2s infinite" : "none", boxShadow: totalDays <= 2 ? `0 0 8px ${uColor}` : "none" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: uColor, textTransform: "uppercase", letterSpacing: 0.5 }}>DD Deadline</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ v: days, l: "D" }, { v: hours, l: "H" }, { v: mins, l: "M" }, { v: secs, l: "S" }].map((u, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: uColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{String(u.v).padStart(2, "0")}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: uColor, opacity: 0.6 }}>{u.l}</span>
                  {i < 3 && <span style={{ fontSize: 14, fontWeight: 300, color: uColor, opacity: 0.25, marginLeft: 1 }}>:</span>}
                </div>
              ))}
            </div>
          </div>
        ) : isAssigned ? (
          <div style={{ background: C.goldBg, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.goldBorder}`, textAlign: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 1 }}>★ CLOSED — DEAL ASSIGNED ★</span>
          </div>
        ) : (
          <div style={{ background: C.redLight, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.redBorder}`, textAlign: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>DD PERIOD EXPIRED</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DEAL DETAIL — LIGHT
// ═══════════════════════════════════════════════════════════
function DealDetail({ deal, onBack }) {
  const [tab, setTab] = useState("overview");
  const [expFolder, setExpFolder] = useState(null);
  const [selStruct, setSelStruct] = useState(null);
  const isAssigned = deal.status === "assigned";
  const tabs = [{ k: "overview", l: "Overview" }, { k: "dataroom", l: "Due Diligence Room" }, { k: "structure", l: "Deal Structure" }, { k: "schedule", l: "Schedule & Contact" }];
  const Card = ({ children, style = {} }) => <div style={{ background: C.white, borderRadius: 14, padding: 28, border: `1px solid ${C.gray200}`, boxShadow: "0 1px 4px rgba(0,0,0,0.03)", ...style }}>{children}</div>;
  const Label = ({ children }) => <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>{children}</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: FONT }}>
      {/* NAV */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.gray200}`, padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.gray500, cursor: "pointer", fontSize: 13, fontFamily: FONT, fontWeight: 500 }}>← All Deals</button>
          <div style={{ width: 1, height: 20, background: C.gray200 }} />
          <span style={{ color: C.navy, fontWeight: 700, fontSize: 16 }}>{deal.name}</span>
          <span style={{ color: C.gray400, fontSize: 12 }}>{deal.city}, {deal.state} · {deal.type}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: C.navy, fontFamily: DISPLAY }}>R</div>
          <span style={{ color: C.navy, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>REPRIME TERMINAL</span>
        </div>
      </div>

      {isAssigned && (
        <div style={{ background: C.goldBg, textAlign: "center", padding: 12, borderBottom: `1px solid ${C.goldBorder}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.gold, letterSpacing: 2 }}>★ DEAL CLOSED — FULLY ASSIGNED ★</span>
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px" }}>
        {/* Hero */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, marginBottom: 28 }}>
          <ImageCarousel photos={deal.photos} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <BigCountdown targetDate={deal.ddDeadline} label="Due Diligence Expiration" subLabel="PSA executed · 30-day DD period" />
            <BigCountdown targetDate={deal.closeDeadline} label="Closing Deadline" subLabel="30-day close · Not subject to financing" />
            {deal.extensionDeadline && <BigCountdown targetDate={deal.extensionDeadline} label="Extension Option" subLabel="Optional 30-day extension" />}
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginBottom: 28 }}>
          {[{ l: "Purchase Price", v: deal.purchasePrice, c: C.navy }, { l: "NOI", v: deal.noi, c: C.navy }, { l: "Cap Rate", v: deal.capRate, c: C.gold }, { l: "Target IRR", v: deal.irr, c: C.green }, { l: "Cash-on-Cash", v: deal.coc, c: C.green }, { l: "DSCR", v: deal.dscr, c: C.navy }, { l: "Equity Required", v: deal.equityRequired, c: C.gold }].map((m, i) => (
            <div key={i} style={{ background: C.white, borderRadius: 10, padding: "14px 16px", border: `1px solid ${C.gray200}`, borderTop: `3px solid ${m.c}` }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: C.gray400, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{m.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.c }}>{m.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: `2px solid ${C.gray200}` }}>
          {tabs.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{ padding: "14px 24px", border: "none", background: "none", fontFamily: FONT, fontSize: 12, fontWeight: tab === t.k ? 700 : 500, color: tab === t.k ? C.navy : C.gray400, borderBottom: tab === t.k ? `3px solid ${C.gold}` : "3px solid transparent", cursor: "pointer", textTransform: "uppercase", letterSpacing: 1, marginBottom: -2 }}>{t.l}</button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card><Label>Investment Highlights</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {deal.highlights?.map((h, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.green, fontWeight: 700 }}>✓</div>
                      <span style={{ fontSize: 14, color: C.gray700, lineHeight: 1.6, fontWeight: 400 }}>{h}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card><Label>Acquisition Thesis</Label>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: C.gray600, fontWeight: 300 }}>{deal.city}, {deal.state} — {deal.type} at {deal.capRate} cap rate. {deal.sqft}{deal.units ? ` across ${deal.units}` : ""} of Class {deal.classType} product, built {deal.yearBuilt}. Target IRR of {deal.irr} with {deal.coc} year-one CoC. PSA executed — 30-day DD, 30-day close{deal.extensionDeadline ? ", plus optional 30-day extension" : ""}.</p>
              </Card>
              <Card><Label>Financing Summary</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div><div style={{ fontSize: 10, color: C.gray400, fontWeight: 600, textTransform: "uppercase" }}>Senior Loan Est.</div><div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginTop: 6 }}>{deal.loanEstimate}</div></div>
                  <div><div style={{ fontSize: 10, color: C.gray400, fontWeight: 600, textTransform: "uppercase" }}>Seller Financing</div><div style={{ fontSize: 15, fontWeight: 600, color: deal.sellerFinancing ? C.green : C.gray400, marginTop: 6 }}>{deal.sellerFinancing ? "Available" : "Not Available"}</div></div>
                </div>
                {deal.specialTerms !== "None" && <div style={{ marginTop: 16, padding: "14px 18px", borderRadius: 10, background: C.goldBg, borderLeft: `4px solid ${C.gold}` }}><div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", marginBottom: 4 }}>Special Terms</div><div style={{ fontSize: 13, color: C.navy }}>{deal.specialTerms}</div></div>}
              </Card>
              <Card><Label>Market Context</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
                  {[{ l: "Metro Pop.", v: deal.pop }, { l: "Job Growth", v: deal.jobGrowth, c: C.green }, { l: "Occupancy", v: deal.occupancy, c: C.green }].map((m, i) => (
                    <div key={i} style={{ background: C.gray100, borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 9, color: C.gray400, fontWeight: 600, textTransform: "uppercase" }}>{m.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: m.c || C.navy, marginTop: 4 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <CycleIndicator />
              </Card>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card style={{ padding: 20 }}><div style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Property Details</div>
                {[["Type", deal.type], ["SF", deal.sqft], deal.units ? ["Units", deal.units] : null, ["Class", deal.classType], ["Built", deal.yearBuilt], ["Occ.", deal.occupancy], ["Area", deal.neighborhood]].filter(Boolean).map(([l, v], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.gray100}` }}><span style={{ fontSize: 12, color: C.gray500 }}>{l}</span><span style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{v}</span></div>
                ))}
                {deal.comparables && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.gray200}` }}><div style={{ fontSize: 9, color: C.gray400, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Cap Rate Trend</div><Sparkline data={deal.comparables} width={200} height={30} color={C.navy} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ fontSize: 9, color: C.gray400 }}>12 mo ago</span><span style={{ fontSize: 9, color: C.navy, fontWeight: 600 }}>{deal.capRate} now</span></div></div>}
              </Card>
              <Card style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "liveDot 1.5s infinite" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: 1 }}>Live Activity</span>
                  </div>
                </div>
                <ActivityFeed />
              </Card>
              {!isAssigned && deal.viewing > 0 && (
                <div style={{ background: C.redLight, borderRadius: 14, padding: 20, border: `1px solid ${C.redBorder}`, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.red }}>{deal.viewing}</div>
                  <div style={{ fontSize: 11, color: C.gray600, fontWeight: 500, marginTop: 2 }}>Terminal members viewing now</div>
                  {deal.meetings > 0 && <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.redBorder}`, fontSize: 12, color: C.amber, fontWeight: 700 }}>{deal.meetings} meetings already scheduled</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DATA ROOM */}
        {tab === "dataroom" && (<div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>Due Diligence Room</div><div style={{ fontSize: 12, color: C.gray500, marginTop: 4 }}>{dataRoomFolders.reduce((a, f) => a + f.docs.length, 0)} documents · {dataRoomFolders.reduce((a, f) => a + f.docs.filter(d => d.v).length, 0)} verified</div></div>
            <button style={{ padding: "10px 24px", background: C.gold, color: C.navy, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Download Complete Package</button>
          </div>
          {/* Progress bar */}
          <div style={{ background: C.white, borderRadius: 10, padding: "14px 20px", marginBottom: 20, border: `1px solid ${C.gray200}`, display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.gray500, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>DD Completion</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.gray100, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${C.green}, ${C.teal})`, width: `${Math.round(dataRoomFolders.reduce((a, f) => a + f.docs.filter(d => d.v).length, 0) / dataRoomFolders.reduce((a, f) => a + f.docs.length, 0) * 100)}%` }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{Math.round(dataRoomFolders.reduce((a, f) => a + f.docs.filter(d => d.v).length, 0) / dataRoomFolders.reduce((a, f) => a + f.docs.length, 0) * 100)}%</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {dataRoomFolders.map((f, fi) => {
              const vCount = f.docs.filter(d => d.v).length, tCount = f.docs.length, isFull = vCount === tCount, isOpen = expFolder === fi;
              return (
                <div key={fi} style={{ background: C.white, borderRadius: 12, overflow: "hidden", border: `1px solid ${isOpen ? C.goldBorder : C.gray200}`, transition: "all 0.2s" }}>
                  <div onClick={() => setExpFolder(isOpen ? null : fi)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: isFull ? C.greenLight : C.goldBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{f.icon}</div>
                      <div><div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{f.name}</div><div style={{ fontSize: 11, color: C.gray500 }}>{tCount} docs · {vCount} verified{tCount - vCount > 0 ? ` · ${tCount - vCount} pending` : ""}</div></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: isFull ? C.greenLight : C.amberLight, color: isFull ? C.green : C.amber, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{isFull ? "✓" : "⏳"}</div>
                      <span style={{ fontSize: 16, color: C.gray400, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                    </div>
                  </div>
                  {isOpen && <div style={{ borderTop: `1px solid ${C.gray100}`, padding: "4px 18px 16px" }}>
                    {f.docs.map((doc, di) => (
                      <div key={di} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: di < f.docs.length - 1 ? `1px solid ${C.gray100}` : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 14, opacity: 0.7 }}>{doc.t === "PDF" ? "📕" : doc.t === "XLSX" ? "📗" : doc.t === "ZIP" ? "📦" : "📄"}</span>
                          <div><div style={{ fontSize: 12, color: C.navy }}>{doc.n}</div><div style={{ fontSize: 10, color: C.gray400 }}>{doc.s} · {doc.t}</div></div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {doc.v ? <span style={{ fontSize: 10, color: C.green, fontWeight: 600, background: C.greenLight, padding: "2px 8px", borderRadius: 4 }}>Verified</span> : <span style={{ fontSize: 10, color: C.amber, fontWeight: 600, background: C.amberLight, padding: "2px 8px", borderRadius: 4 }}>Pending</span>}
                          {doc.v && <button style={{ background: C.gray100, border: "none", borderRadius: 4, color: C.gray500, padding: "4px 8px", fontSize: 10, cursor: "pointer", fontFamily: FONT }}>↓</button>}
                        </div>
                      </div>
                    ))}
                    <button style={{ marginTop: 12, padding: "8px 16px", background: C.navy, color: C.white, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Download All</button>
                  </div>}
                </div>
              );
            })}
          </div>
        </div>)}

        {/* STRUCTURE */}
        {tab === "structure" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Assignment */}
              <div onClick={() => !isAssigned && setSelStruct("assign")} style={{ background: C.white, borderRadius: 14, padding: 28, cursor: isAssigned ? "default" : "pointer", border: selStruct === "assign" ? `2px solid ${C.gold}` : `1px solid ${C.gray200}`, transition: "all 0.2s", boxShadow: selStruct === "assign" ? `0 0 0 3px ${C.goldBg}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div><div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Option A</div><div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>Assignment</div></div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: C.gold }}>{deal.assignmentFee}</div>
                </div>
                <div style={{ height: 1, background: C.gray200, margin: "12px 0" }} />
                <p style={{ fontSize: 13, color: C.gray600, lineHeight: 1.7, fontWeight: 300, marginBottom: 16 }}>RePrime assigns the PSA and all deal rights to you. All DD, reports, and bank approvals transfer. You bring financing or assume the existing loan.</p>
                <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", border: `1px solid ${C.greenBorder}`, textAlign: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>Projected IRR: {deal.assignmentIRR} — fee included</span>
                </div>
                {selStruct === "assign" && <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.gray200}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Optional Add-Ons</div>
                  {[{ name: "Loan Placement", fee: "1 point", desc: "Best financing through our lending network" }, { name: "Insurance Placement", fee: "Pass-through", desc: "Institutional insurance brokers — no markup" }].map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.gray100}` }}>
                      <div><div style={{ fontSize: 12, color: C.navy, fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 10, color: C.gray500 }}>{s.desc}</div></div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>{s.fee}</span>
                    </div>
                  ))}
                </div>}
              </div>
              {/* GP/LP */}
              <div onClick={() => !isAssigned && setSelStruct("gplp")} style={{ background: C.white, borderRadius: 14, padding: 28, cursor: isAssigned ? "default" : "pointer", border: selStruct === "gplp" ? `2px solid ${C.gold}` : `1px solid ${C.gray200}`, transition: "all 0.2s", boxShadow: selStruct === "gplp" ? `0 0 0 3px ${C.goldBg}` : "none" }}>
                <div><div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Option B</div><div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>GP / LP Partnership</div></div>
                <div style={{ height: 1, background: C.gray200, margin: "16px 0 12px" }} />
                <p style={{ fontSize: 13, color: C.gray600, lineHeight: 1.7, fontWeight: 300, marginBottom: 16 }}>RePrime stays as GP. You invest as LP. We handle asset management, operations, business plan execution, and disposition.</p>
                {[["Acquisition Fee", deal.acqFee], ["Asset Management", deal.assetMgmtFee + " annually"], ["GP Carry", deal.gpCarry], ["Equity Required", deal.equityRequired]].map(([l, v], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12 }}><span style={{ color: C.gray500 }}>{l}</span><span style={{ color: C.navy, fontWeight: 600 }}>{v}</span></div>
                ))}
                <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", border: `1px solid ${C.greenBorder}`, textAlign: "center", marginTop: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>Projected IRR: {deal.gplpIRR} — all fees included</span>
                </div>
                <div style={{ fontSize: 11, color: C.gray500, marginTop: 8, textAlign: "center" }}>Loan placement · Insurance · On-site inspection — all included</div>
              </div>
            </div>
            <IRRCalculator deal={deal} />
          </div>
        )}

        {/* SCHEDULE */}
        {tab === "schedule" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <Card><Label>Schedule a Meeting</Label><div style={{ fontSize: 12, color: C.gray500, marginBottom: 20, marginTop: -8 }}>Select an available time for instant confirmation</div><MeetingScheduler /></Card>
              <Card style={{ padding: 20 }}><div style={{ fontSize: 11, fontWeight: 700, color: C.navy, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Notification Preferences</div>
                {["Notify me of every new deal", "Notify when new docs are added", "Notify me of any deal activity"].map((label, i) => (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: i === 0 ? `2px solid ${C.gold}` : `2px solid ${C.gray300}`, background: i === 0 ? C.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{i === 0 && <span style={{ color: C.navy, fontSize: 12, fontWeight: 700 }}>✓</span>}</div>
                    <span style={{ fontSize: 12, color: C.gray600 }}>{label}</span>
                  </label>
                ))}
                <p style={{ fontSize: 10, color: C.gray400, marginTop: 4 }}>You control your notifications. No unsolicited emails.</p>
              </Card>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card><Label>Your Deal Contact</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: `linear-gradient(135deg, ${C.navy}, ${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: C.white }}>SG</div>
                  <div><div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>Shirel Gratsiani</div><div style={{ fontSize: 12, color: C.gray500 }}>VP, Investor Relations</div></div>
                </div>
                <button style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: C.gold, color: C.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Email Shirel About This Deal</button>
                <button style={{ width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${C.gray200}`, background: "transparent", color: C.navy, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>Request a Call Back</button>
              </Card>
              <div style={{ background: C.goldBg, borderRadius: 14, padding: 24, border: `1px solid ${C.goldBorder}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 8 }}>Prefer to email your availability?</div>
                <p style={{ fontSize: 12, color: C.gray600, lineHeight: 1.5, marginBottom: 14 }}>Send your available times — we'll confirm within 2 hours.</p>
                <button style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: C.gold, color: C.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Send Availability via Email →</button>
              </div>
              <div style={{ background: C.redLight, borderRadius: 14, padding: 20, border: `1px solid ${C.redBorder}`, textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Limited Release</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{deal.qRelease}</div>
                <div style={{ fontSize: 11, color: C.gray500, marginTop: 4 }}>Controlled release to qualified Terminal members only</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD — LIGHT
// ═══════════════════════════════════════════════════════════
function Dashboard({ onSelectDeal, onLogout }) {
  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: FONT }}>
      <div style={{ background: C.white, borderBottom: `1px solid ${C.gray200}`, padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: C.navy, fontFamily: DISPLAY }}>R</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.navy, letterSpacing: 2 }}>REPRIME</span>
          <span style={{ fontSize: 11, color: C.gold, letterSpacing: 3, fontFamily: DISPLAY, fontStyle: "italic" }}>Terminal</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "liveDot 1.5s infinite" }} /><span style={{ color: C.gray500, fontSize: 11 }}>3 active deals</span></div>
          <div style={{ width: 1, height: 16, background: C.gray200 }} />
          <span style={{ color: C.gray400, fontSize: 12 }}>Welcome, Investor</span>
          <button onClick={onLogout} style={{ background: C.gray100, border: `1px solid ${C.gray200}`, borderRadius: 6, color: C.gray500, padding: "6px 14px", fontSize: 11, cursor: "pointer", fontFamily: FONT }}>Sign Out</button>
        </div>
      </div>
      <div style={{ maxWidth: 1360, margin: "0 auto", padding: "32px" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.navy }}>Active Opportunities</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, background: C.goldBg, padding: "4px 10px", borderRadius: 4, letterSpacing: 1, border: `1px solid ${C.goldBorder}` }}>Q1 2026</div>
          </div>
          <div style={{ fontSize: 13, color: C.gray500, fontWeight: 300 }}>{deals.filter(d => d.status === "active").length} active · {deals.filter(d => d.status === "assigned").length} closed · All under executed PSA · 30-day DD · 30-day close</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(370px, 1fr))", gap: 20 }}>
          {deals.map(d => <DealCard key={d.id} deal={d} onClick={() => onSelectDeal(d)} />)}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("login");
  const [sel, setSel] = useState(null);
  return (<>
    <style>{globalCSS}</style>
    {screen === "login" && <LoginScreen onLogin={() => setScreen("dash")} />}
    {screen === "dash" && <Dashboard onSelectDeal={d => { setSel(d); setScreen("detail"); }} onLogout={() => setScreen("login")} />}
    {screen === "detail" && sel && <DealDetail deal={sel} onBack={() => { setScreen("dash"); setSel(null); }} />}
  </>);
}
