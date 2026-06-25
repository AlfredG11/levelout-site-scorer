import { useState } from "react";
import LSOA_CENSUS from "./lsoaCensus.js";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const THRESHOLDS = { deg: 55, age: 34, prof: 40 };

const DENSITY_BANDS = [
  { max: 4000,  label: "Low density",       note: "Transport accessibility and visibility more critical — smaller walkable catchment.",      color: "#BA7517" },
  { max: 10000, label: "Medium density",    note: "Standard catchment. Good balance of residential and commercial.",                          color: "#0F6E56" },
  { max: 20000, label: "High density",      note: "Large walkable catchment. Strong potential for walk-in and word-of-mouth membership.",      color: "#0F6E56" },
  { max: Infinity, label: "Very high density", note: "Exceptional density. Often correlates with new-build or transient populations — check neighbourhood character carefully.", color: "#BA7517" },
];

function getDensityBand(dens) {
  return DENSITY_BANDS.find(b => dens < b.max) || DENSITY_BANDS[DENSITY_BANDS.length - 1];
}

// ── SCORING HELPERS ───────────────────────────────────────────────────────────

function getDemoResult(data) {
  if (!data) return null;
  let pass = 0, total = 0;
  if (data.deg  != null) { total++; if (data.deg  >= THRESHOLDS.deg)  pass++; }
  if (data.age  != null) { total++; if (data.age  >= THRESHOLDS.age)  pass++; }
  if (data.prof != null) { total++; if (data.prof >= THRESHOLDS.prof) pass++; }
  if (total === 0) return null;
  return pass >= 2 ? (pass === total ? "pass" : "marginal") : "fail";
}

function getCompResult(comp) {
  if (!comp) return null;
  return comp === "low" ? "pass" : comp === "mod" ? "warn" : "fail";
}

function getViewResult(view) {
  const vals = Object.values(view).filter(Boolean);
  if (vals.length < 6) return null;
  const good = vals.filter(v => v === "good").length;
  const poor = vals.filter(v => v === "poor").length;
  return poor >= 3 ? "fail" : good >= 4 ? "pass" : "warn";
}

function getOverall(demoResult, compResult, viewResult) {
  if (!demoResult || !compResult || !viewResult) return null;
  const d = demoResult === "pass" ? "pass" : demoResult === "marginal" ? "warn" : "fail";
  if (d === "fail" || compResult === "fail" || viewResult === "fail") return "fail";
  if (d === "warn"  || compResult === "warn"  || viewResult === "warn")  return "warn";
  return "pass";
}

// ── POSTCODE LOOKUP ───────────────────────────────────────────────────────────

async function fetchLSOAFromPostcode(postcode) {
  const clean = postcode.replace(/\s/g, "").toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
  if (!res.ok) throw new Error("Postcode not found — please check and try again");
  const json = await res.json();
  if (!json.result) throw new Error("Postcode not found — please check and try again");
  return {
    lsoaCode: json.result?.codes?.lsoa,
    ward:     json.result?.admin_ward || "",
    district: json.result?.outcode || "",
    borough:  json.result?.admin_district || "",
  };
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────

const CFG = {
  pass:     { bg: "#E1F5EE", border: "#0F6E56", text: "#085041", icon: "✓" },
  marginal: { bg: "#FAEEDA", border: "#854F0B", text: "#633806", icon: "⚠" },
  warn:     { bg: "#FAEEDA", border: "#854F0B", text: "#633806", icon: "⚠" },
  fail:     { bg: "#FCEBEB", border: "#A32D2D", text: "#791F1F", icon: "✗" },
};

function pill(result) {
  const c = CFG[result] || { bg:"#F1EFE8", border:"#aaa", text:"#666" };
  const label = result==="pass"?"Pass":result==="fail"?"Fail":result==="marginal"?"Marginal":result==="warn"?"Caution":"Pending";
  return <span style={{ display:"inline-block", fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, background:c.bg, color:c.text, border:`0.5px solid ${c.border}` }}>{label}</span>;
}

function VerdictBox({ result, title, subtitle }) {
  const c = CFG[result] || CFG.warn;
  return (
    <div style={{ background:c.bg, border:`0.5px solid ${c.border}`, borderRadius:8, padding:"10px 14px", display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
      <span style={{ fontSize:18, color:c.text, flexShrink:0 }}>{c.icon}</span>
      <div>
        <div style={{ fontSize:14, fontWeight:500, color:c.text }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:c.text, marginTop:2, lineHeight:1.5 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, threshold, maxVal }) {
  if (value == null) return (
    <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"10px 12px" }}>
      <div style={{ fontSize:11, color:"#888", marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color:"#ccc" }}>—</div>
      <div style={{ fontSize:10, color:"#bbb", marginTop:3 }}>Not available</div>
    </div>
  );
  const passes = value >= threshold;
  const col = passes ? "#0F6E56" : "#A32D2D";
  const pct = Math.min(100, Math.round((value / maxVal) * 100));
  const threshPct = Math.min(100, Math.round((threshold / maxVal) * 100));
  return (
    <div style={{ background:"#fff", border:`0.5px solid ${passes ? "rgba(15,110,86,0.3)" : "rgba(163,45,45,0.3)"}`, borderRadius:8, padding:"10px 12px" }}>
      <div style={{ fontSize:11, color:"#666", marginBottom:5, lineHeight:1.3 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color:col, marginBottom:4 }}>{value}%</div>
      <div style={{ height:5, background:"#eee", borderRadius:3, marginBottom:4, position:"relative" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:3 }} />
        <div style={{ position:"absolute", top:-2, bottom:-2, left:`${threshPct}%`, width:2, background:"rgba(163,45,45,0.6)", borderRadius:1 }} title={`Threshold ${threshold}%`} />
      </div>
      <div style={{ fontSize:10, color:"#999" }}>Threshold ≥{threshold}% · {passes ? "✓ Pass" : "✗ Below threshold"}</div>
    </div>
  );
}

function ContextFlag({ icon, text, color }) {
  return (
    <div style={{ border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"8px 12px", marginBottom:6, display:"flex", gap:8, alignItems:"flex-start", background: color ? color+"10" : "transparent" }}>
      <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{icon}</span>
      <p style={{ fontSize:12, color:"#555", lineHeight:1.5, margin:0 }}>{text}</p>
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display:"flex", gap:6 }}>
      {options.map(opt => {
        const active = value === opt.value;
        const c = opt.result ? (CFG[opt.result] || {}) : {};
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{ flex:1, padding:"9px 6px", borderRadius:8, cursor:"pointer", border: active && c.border ? `1px solid ${c.border}` : "0.5px solid rgba(0,0,0,0.12)", background: active && c.bg ? c.bg : "#f7f7f5", color: active && c.text ? c.text : "#555", fontWeight: active ? 500 : 400, fontSize:12, textAlign:"center", transition:"all 0.12s" }}>
            <div style={{ fontSize:17, marginBottom:3 }}>{opt.icon}</div>
            <div style={{ fontWeight:500, marginBottom:1 }}>{opt.label}</div>
            <div style={{ fontSize:10, opacity:0.75 }}>{opt.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

function ViewItem({ label, hint, value, onChange }) {
  return (
    <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom: hint ? 7 : 0 }}>
        <span style={{ fontSize:13, fontWeight:500 }}>{label}</span>
        <div style={{ display:"flex", gap:5 }}>
          {[{v:"good",l:"Good",r:"pass"},{v:"mod",l:"Moderate",r:"warn"},{v:"poor",l:"Poor",r:"fail"}].map(o => {
            const c = CFG[o.r];
            const active = value === o.v;
            return (
              <button key={o.v} onClick={() => onChange(o.v)} style={{ padding:"4px 10px", fontSize:11, borderRadius:20, cursor:"pointer", border: active ? `0.5px solid ${c.border}` : "0.5px solid rgba(0,0,0,0.12)", background: active ? c.bg : "#f7f7f5", color: active ? c.text : "#888", fontWeight: active ? 500 : 400 }}>
                {o.l}
              </button>
            );
          })}
        </div>
      </div>
      {hint && <p style={{ fontSize:11, color:"#aaa", margin:0 }}>{hint}</p>}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function LevelOutSiteScorer() {
  const [postcode, setPostcode]     = useState("");
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [activeTab, setActiveTab]   = useState(0);
  const [comp, setComp]             = useState(null);
  const [fitness, setFitness]       = useState(null);
  const [view, setView] = useState({
    transport:null, frontage:null, pedestrian:null,
    street:null, lifestyle:null, neighbourhood:null,
  });

  const handleAssess = async () => {
    const trimmed = postcode.trim().toUpperCase();
    if (!trimmed) { setError("Please enter a postcode."); return; }
    const clean = trimmed.replace(/\s/g,"");
    if (clean.length < 5 || clean.length > 7) { setError("Enter a valid UK postcode (e.g. SE15 4QD)."); return; }
    setError(""); setLoading(true); setResult(null);
    setComp(null); setFitness(null);
    setView({ transport:null, frontage:null, pedestrian:null, street:null, lifestyle:null, neighbourhood:null });
    setActiveTab(0);

    try {
      const formatted = clean.slice(0,-3) + " " + clean.slice(-3);
      const { lsoaCode, ward, district, borough } = await fetchLSOAFromPostcode(formatted);

      if (!lsoaCode) throw new Error("Could not determine LSOA for this postcode");

      const censusData = LSOA_CENSUS[lsoaCode];
      if (!censusData) throw new Error(`No census data found for LSOA ${lsoaCode}. This postcode may be outside Greater London.`);

      setResult({ postcode: formatted, lsoaCode, ward, district, borough, data: censusData });
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const handleReset = () => {
    setPostcode(""); setResult(null); setError(""); setLoading(false);
    setComp(null); setFitness(null);
    setView({ transport:null, frontage:null, pedestrian:null, street:null, lifestyle:null, neighbourhood:null });
    setActiveTab(0);
  };

  const demoResult = getDemoResult(result?.data);
  const compResult = getCompResult(comp);
  const viewResult = getViewResult(view);
  const overall    = getOverall(demoResult, compResult, viewResult);
  const demoStatus = demoResult === "pass" ? "pass" : demoResult === "marginal" ? "warn" : demoResult === "fail" ? "fail" : null;
  const tabStatuses = [demoStatus, compResult, viewResult, overall];

  const TAB_LABELS = ["Demographics", "Competition", "Visibility", "Results"];
  const TAB_ICONS  = ["👥", "🏪", "👁️", "📊"];
  const sIcon  = s => s==="pass"?"✓":s==="warn"?"⚠":s==="fail"?"✗":"—";
  const sColor = s => s==="pass"?"#0F6E56":s==="warn"?"#854F0B":s==="fail"?"#A32D2D":"#ccc";

  const densityBand = result?.data?.dens ? getDensityBand(result.data.dens) : null;

  return (
    <div style={{ fontFamily:"system-ui,-apple-system,sans-serif", maxWidth:680, margin:"0 auto", padding:"24px 16px", color:"#1a1a1a", minHeight:"100vh", background:"#fafaf8" }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <h1 style={{ fontSize:20, fontWeight:500, margin:0 }}>LevelOut Site Scorer</h1>
          <span style={{ fontSize:11, fontWeight:500, padding:"2px 9px", borderRadius:20, background:"#E1F5EE", color:"#085041" }}>Live LSOA data</span>
        </div>
        <p style={{ fontSize:13, color:"#888", margin:0 }}>
          Three-stage filter · {(4994).toLocaleString()} London LSOAs · ONS Census 2021 · Calibrated against 18 LevelOut sites
        </p>
      </div>

      {/* Postcode input */}
      <div style={{ marginBottom:20 }}>
        <label style={{ fontSize:13, color:"#666", display:"block", marginBottom:6 }}>Enter a postcode to assess</label>
        <div style={{ display:"flex", gap:8 }}>
          <input
            value={postcode}
            onChange={e => setPostcode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key==="Enter" && !loading && handleAssess()}
            placeholder="e.g. CR0 2AD"
            maxLength={8}
            disabled={loading}
            style={{ flex:1, fontSize:15, padding:"9px 12px", borderRadius:8, border:"0.5px solid rgba(0,0,0,0.2)", letterSpacing:"0.05em", outline:"none", background:"#fff", fontFamily:"inherit" }}
          />
          <button onClick={handleAssess} disabled={loading} style={{ padding:"9px 20px", fontSize:14, fontWeight:500, borderRadius:8, border:"0.5px solid rgba(0,0,0,0.15)", background: loading?"#f0f0ee":"#fff", cursor: loading?"default":"pointer", fontFamily:"inherit" }}>
            {loading ? "Loading…" : "Assess ↗"}
          </button>
        </div>
        {error && <div style={{ fontSize:13, color:"#A32D2D", marginTop:6, padding:"8px 12px", background:"#FCEBEB", borderRadius:6 }}>{error}</div>}
        {result && !loading && (
          <div style={{ fontSize:11, color:"#0F6E56", marginTop:6 }}>
            ✓ Real-time data · LSOA {result.lsoaCode} · {result.borough}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {TAB_LABELS.map((label, i) => {
          const status = tabStatuses[i];
          const active = activeTab === i;
          return (
            <button key={i} onClick={() => setActiveTab(i)} style={{ flex:1, padding:"8px 6px", borderRadius:8, cursor:"pointer", border: active?"1px solid #185FA5":"0.5px solid rgba(0,0,0,0.12)", background: active?"#E6F1FB":"#f7f7f5", textAlign:"center", transition:"all 0.12s", fontFamily:"inherit" }}>
              <div style={{ fontSize:16, marginBottom:2 }}>{TAB_ICONS[i]}</div>
              <div style={{ fontSize:10, color:active?"#185FA5":"#aaa", marginBottom:1 }}>{i < 3 ? `Stage ${i+1}` : ""}</div>
              <div style={{ fontSize:12, fontWeight:500, color:active?"#0C447C":"#333" }}>{label}</div>
              <div style={{ fontSize:12, color:sColor(status), marginTop:2, fontWeight:500 }}>{sIcon(status)}</div>
            </button>
          );
        })}
      </div>

      {/* ── STAGE 1: DEMOGRAPHICS ── */}
      {activeTab === 0 && (
        <div>
          {!result ? (
            <p style={{ fontSize:13, color:"#aaa", padding:"8px 0" }}>Enter a postcode above to run the demographic analysis.</p>
          ) : (
            <>
              <div style={{ fontSize:11, fontWeight:500, color:"#999", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>
                ONS Census 2021 — LSOA {result.lsoaCode}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                <MetricCard label="Level 4+ qualifications" value={result.data.deg}  threshold={THRESHOLDS.deg}  maxVal={85} />
                <MetricCard label="Aged 25–44"              value={result.data.age}  threshold={THRESHOLDS.age}  maxVal={60} />
                <MetricCard label="Professional / mgr"      value={result.data.prof} threshold={THRESHOLDS.prof} maxVal={70} />
              </div>

              {demoResult==="pass"     && <VerdictBox result="pass"     title="Demographics: Pass"              subtitle={`${result.ward}, ${result.borough}`} />}
              {demoResult==="marginal" && <VerdictBox result="marginal" title="Demographics: Marginal"           subtitle="Passes most thresholds but at least one signal is below minimum. Proceed with extra caution." />}
              {demoResult==="fail"     && <VerdictBox result="fail"     title="Demographics: Fail — do not proceed" subtitle="Profile does not meet LevelOut's minimum demographic threshold. Stage 2 and 3 not required." />}

              {/* Density context flag */}
              {densityBand && (
                <ContextFlag
                  icon={result.data.dens >= 10000 ? "🏙️" : result.data.dens >= 4000 ? "🏘️" : "🌳"}
                  text={`${densityBand.label} — ${result.data.dens.toLocaleString()} persons/km² · ${densityBand.note}`}
                  color={densityBand.color}
                />
              )}

              <p style={{ fontSize:11, color:"#ccc", marginTop:12, paddingTop:10, borderTop:"0.5px solid rgba(0,0,0,0.06)" }}>
                Source: ONS Census 2021 · Nomis TS067, TS007A, TS062, TS006 · Thresholds calibrated against 18 LevelOut London sites
              </p>
            </>
          )}
          <button onClick={() => setActiveTab(1)} style={{ width:"100%", padding:"9px", marginTop:16, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.12)", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
            Continue to competition →
          </button>
        </div>
      )}

      {/* ── STAGE 2: COMPETITION ── */}
      {activeTab === 1 && (
        <div>
          <div style={{ fontSize:11, fontWeight:500, color:"#999", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Direct reformer competition within 1km</div>
          <ToggleGroup value={comp} onChange={setComp} options={[
            { value:"low",  label:"Low",      sub:"0–1 studios", icon:"✓", result:"pass" },
            { value:"mod",  label:"Moderate", sub:"2–3 studios", icon:"⚠", result:"warn" },
            { value:"high", label:"High",     sub:"4+ studios",  icon:"✗", result:"fail" },
          ]} />

          <div style={{ fontSize:11, fontWeight:500, color:"#999", textTransform:"uppercase", letterSpacing:"0.07em", margin:"16px 0 10px" }}>Indirect boutique fitness market nearby</div>
          <ToggleGroup value={fitness} onChange={setFitness} options={[
            { value:"low",  label:"Low",      sub:"Market unproven", icon:"—", result:"warn" },
            { value:"mod",  label:"Moderate", sub:"Some demand",     icon:"✓", result:"pass" },
            { value:"high", label:"High",     sub:"Strong demand",   icon:"🔥", result:"pass" },
          ]} />

          <div style={{ marginTop:12 }}>
            {compResult==="fail" && <VerdictBox result="fail" title="Competition: Fail — do not proceed" subtitle="High direct competition is disqualifying. No strong site in your portfolio has high direct competition." />}
            {compResult==="warn" && <VerdictBox result="warn" title="Competition: Caution" subtitle="Moderate competition is viable but requires strong visibility and demographics. East Dulwich, Peckham and Brixton show it can work." />}
            {compResult==="pass" && <VerdictBox result="pass" title="Competition: Pass" subtitle="Low direct competition — strong market position. Your best sites entered low-competition markets." />}
          </div>

          <button onClick={() => setActiveTab(2)} style={{ width:"100%", padding:"9px", marginTop:16, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.12)", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
            Continue to visibility →
          </button>
        </div>
      )}

      {/* ── STAGE 3: VISIBILITY ── */}
      {activeTab === 2 && (
        <div>
          <p style={{ fontSize:13, color:"#888", marginBottom:14 }}>Score the unit and its immediate surroundings based on your viewing.</p>
          {[
            { key:"transport",     label:"Visibility from transport",  hint:"Can you see the site or a natural route to it from the station exit?" },
            { key:"frontage",      label:"Street frontage",            hint:"Prominent high-street position vs. tucked away or basement" },
            { key:"pedestrian",    label:"Pedestrian demographic",     hint:"Young, health-conscious, predominantly female foot traffic" },
            { key:"street",        label:"Street character",           hint:"Walkable and calm vs. heavy traffic-dominated" },
            { key:"lifestyle",     label:"Lifestyle retail nearby",    hint:"Independent cafés, delis, wellness — your customer already goes here" },
            { key:"neighbourhood", label:"Neighbourhood character",    hint:"Organic, rooted community vs. purpose-built development" },
          ].map(item => (
            <ViewItem key={item.key} label={item.label} hint={item.hint} value={view[item.key]} onChange={val => setView(prev => ({ ...prev, [item.key]: val }))} />
          ))}

          <div style={{ marginTop:8 }}>
            {viewResult==="fail" && <VerdictBox result="fail" title="Visibility: Fail" subtitle="Multiple poor viewing scores. Unit conditions will significantly hamper performance regardless of neighbourhood quality." />}
            {viewResult==="pass" && <VerdictBox result="pass" title="Visibility: Pass" subtitle="Strong unit conditions across all criteria." />}
            {viewResult==="warn" && <VerdictBox result="warn" title="Visibility: Moderate" subtitle="Mixed viewing scores. Site needs strong demographics and low competition to compensate." />}
          </div>

          <button onClick={() => setActiveTab(3)} style={{ width:"100%", padding:"9px", marginTop:12, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.12)", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
            View full results →
          </button>
        </div>
      )}

      {/* ── RESULTS ── */}
      {activeTab === 3 && (
        <div>
          {!result ? (
            <p style={{ fontSize:13, color:"#aaa", padding:"8px 0" }}>Complete all three stages to see your full assessment.</p>
          ) : (
            <>
              {overall && (
                <div style={{ borderRadius:12, padding:"16px", textAlign:"center", marginBottom:16, background: overall==="pass"?"#E1F5EE":overall==="warn"?"#FAEEDA":"#FCEBEB" }}>
                  <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5, color: overall==="pass"?"#085041":overall==="warn"?"#633806":"#791F1F" }}>Overall assessment</div>
                  <div style={{ fontSize:22, fontWeight:500, marginBottom:5, color: overall==="pass"?"#085041":overall==="warn"?"#633806":"#791F1F" }}>
                    {overall==="pass"?"Strong candidate":overall==="warn"?"Proceed with caution":"Do not proceed"}
                  </div>
                  <div style={{ fontSize:12, color: overall==="pass"?"#085041":overall==="warn"?"#633806":"#791F1F", lineHeight:1.5 }}>
                    {overall==="pass" && "All three stages pass. This site profiles similarly to your best-performing locations."}
                    {overall==="warn" && "Site passes minimum thresholds but has caution flags. Weigh risks carefully before committing to Heads of Terms."}
                    {overall==="fail" && "One or more stages have failed. This site does not meet LevelOut's minimum criteria."}
                  </div>
                </div>
              )}

              <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:12, overflow:"hidden", marginBottom:12 }}>
                <div style={{ padding:"12px 16px", borderBottom:"0.5px solid rgba(0,0,0,0.06)", background:"#fafaf8" }}>
                  <div style={{ fontSize:22, fontWeight:500, letterSpacing:"0.05em" }}>{result.postcode}</div>
                  <div style={{ fontSize:13, color:"#666", marginTop:2 }}>{result.ward}{result.ward && result.borough ? ", " : ""}{result.borough}</div>
                  <div style={{ fontSize:11, color:"#bbb", marginTop:1 }}>LSOA {result.lsoaCode}</div>
                </div>
                {[
                  { label:"Stage 1 — Demographics", result:demoStatus,  icon:"👥" },
                  { label:"Stage 2 — Competition",  result:compResult,  icon:"🏪" },
                  { label:"Stage 3 — Visibility",   result:viewResult,  icon:"👁️" },
                ].map((row, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", padding:"11px 16px", borderBottom: i<2?"0.5px solid rgba(0,0,0,0.06)":"none", gap:10 }}>
                    <span style={{ fontSize:18, flexShrink:0, width:26 }}>{row.icon}</span>
                    <span style={{ flex:1, fontSize:13 }}>{row.label}</span>
                    {pill(row.result || "pending")}
                  </div>
                ))}
              </div>

              {/* Demographic detail */}
              {result.data && (
                <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.08)", borderRadius:8, padding:"10px 14px", marginBottom:8 }}>
                  <div style={{ fontSize:11, color:"#aaa", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Census signals</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
                    {[
                      { label:"Level 4+",   val:result.data.deg,  thresh:THRESHOLDS.deg  },
                      { label:"Aged 25–44", val:result.data.age,  thresh:THRESHOLDS.age  },
                      { label:"Prof/Mgr",   val:result.data.prof, thresh:THRESHOLDS.prof },
                      { label:"Density",    val:result.data.dens ? `${(result.data.dens/1000).toFixed(1)}k` : null, thresh:null },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:16, fontWeight:500, color: s.thresh ? (s.val >= s.thresh ? "#0F6E56" : "#A32D2D") : "#555" }}>
                          {s.val != null ? (typeof s.val === "string" ? s.val : `${s.val}%`) : "—"}
                        </div>
                        <div style={{ fontSize:10, color:"#aaa", marginTop:1 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p style={{ fontSize:11, color:"#ccc", marginTop:8, paddingTop:8, borderTop:"0.5px solid rgba(0,0,0,0.06)" }}>
                ONS Census 2021 · Nomis TS067, TS007A, TS062, TS006 · LSOA {result.lsoaCode}
              </p>
            </>
          )}
          <button onClick={handleReset} style={{ width:"100%", padding:"9px", marginTop:12, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.12)", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>
            Start new assessment
          </button>
        </div>
      )}
    </div>
  );
}
