import { useState } from "react";

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const THRESHOLDS = { deg: 55, age: 34, prof: 40 };

// LSOA-level data for the 18 calibration sites (exact Nomis Census 2021 figures)
const LSOA_DB = {
  E01003344: { area: "Brockley",        deg: 58.2, age: 36.4, prof: 46.4, char: "village",   popDesc: "Young professional families, strong community identity" },
  E01001593: { area: "Blackheath",       deg: 65.2, age: 34.2, prof: 55.1, char: "village",   popDesc: "Affluent families, highly educated village community" },
  E01003953: { area: "East Dulwich",     deg: 71.9, age: 51.4, prof: 62.6, char: "village",   popDesc: "Young families, very high education and professional density" },
  E01034486: { area: "Blackhorse Road",  deg: 76.5, age: 38.0, prof: null, char: "mixed",     popDesc: "Young creatives, rapidly gentrifying Walthamstow" },
  E01003247: { area: "Deptford",         deg: 55.4, age: 50.4, prof: 42.2, char: "mixed",     popDesc: "Young professional and arts community, strong energy" },
  E01003074: { area: "Herne Hill",       deg: 69.0, age: 47.1, prof: 56.0, char: "village",   popDesc: "Affluent young professionals, strong lifestyle culture" },
  E01003055: { area: "Brixton",          deg: 63.1, age: 49.4, prof: 52.9, char: "mixed",     popDesc: "Young creative professionals, diverse and vibrant community" },
  E01034217: { area: "East Village",     deg: 72.6, age: 54.1, prof: 49.6, char: "newbuild",  popDesc: "Young professionals, high-density purpose-built development" },
  E01004063: { area: "Peckham",          deg: 67.6, age: 45.0, prof: 54.8, char: "mixed",     popDesc: "Young creative community, strong independent culture" },
  E01001990: { area: "Crouch Hill",      deg: 70.8, age: 45.5, prof: 58.4, char: "mixed",     popDesc: "Young professionals, emerging village character on N8" },
  E01032739: { area: "St Pauls (City)",  deg: 78.0, age: 52.4, prof: 66.1, char: "transient", popDesc: "Very high education but transient office population — low residential rootedness" },
  E01035642: { area: "De Beauvoir",      deg: 68.6, age: 54.2, prof: 57.9, char: "mixed",     popDesc: "Young creative professionals, strong Hackney arts scene" },
  E01004510: { area: "Wandsworth",       deg: 69.7, age: 51.0, prof: 61.8, char: "mixed",     popDesc: "Young families, professional community" },
  E01003075: { area: "Camberwell",       deg: 42.3, age: 31.5, prof: 26.6, char: "mixed",     popDesc: "Mixed community — demographic profile below portfolio minimum" },
  E01002778: { area: "Stoke Newington",  deg: 47.0, age: 36.7, prof: 30.7, char: "village",   popDesc: "Village character but professional density below portfolio minimum" },
  E01003226: { area: "Forest Hill",      deg: 61.8, age: 41.4, prof: 51.0, char: "mixed",     popDesc: "Mixed families, borderline demographic profile" },
  E01002000: { area: "Manor House",      deg: 58.4, age: 45.9, prof: 46.9, char: "mixed",     popDesc: "Mixed N4 community, modest professional density" },
  E01001816: { area: "Hackney Downs",    deg: 58.4, age: 35.2, prof: 47.4, char: "mixed",     popDesc: "Young creatives, right demographic feel but borderline metrics" },
};

// Portfolio postcode → LSOA mapping (returns exact calibration data)
const LSOA_POSTCODE_MAP = {
  SE4: "E01003344", SE3: "E01001593", SE22: "E01003953",
  E17: "E01034486", SE8: "E01003247", SE24: "E01003074",
  SW9: "E01003055", E20: "E01034217", SE15: "E01004063",
  N8:  "E01001990", EC4M: "E01032739", EC4: "E01032739",
  N1:  "E01035642", SW18: "E01004510", SE5: "E01003075",
  N16: "E01002778", SE23: "E01003226", N4:  "E01002000",
  E8:  "E01001816",
};

// ── LIVE API FUNCTIONS ────────────────────────────────────────────────────────

async function fetchLSOAFromPostcode(postcode) {
  const clean = postcode.replace(/\s/g, "").toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
  if (!res.ok) throw new Error("Postcode not found");
  const json = await res.json();
  const lsoa21 = json.result?.codes?.lsoa;
  const district = json.result?.outcode;
  const area = json.result?.admin_ward || json.result?.parliamentary_constituency || "";
  return { lsoaCode: lsoa21, district, area };
}

async function fetchCensusForLSOA(lsoaCode) {
  const base = "https://www.nomisweb.co.uk/api/v01/dataset";
  const geo = `geography=${lsoaCode}`;
  const fmt = "measures=20100&select=geography_name,geography_code,obs_value";

  // TS067 — Level 4+ qualifications
  const [degRes, ageRes, profRes] = await Promise.all([
    fetch(`${base}/C2021TS067.data.json?${geo}&c2021_hiqual_8=7&${fmt}`),
    fetch(`${base}/C2021TS007A.data.json?${geo}&c2021_age_92=6,7,8,9,10&${fmt}`),
    fetch(`${base}/C2021TS062.data.json?${geo}&c_ns_sec_9=2,3&${fmt}`),
  ]);

  const [degJson, ageJson, profJson] = await Promise.all([
    degRes.json(), ageRes.json(), profRes.json()
  ]);

  // Total population for percentages
  const totalRes = await fetch(`${base}/C2021TS067.data.json?${geo}&c2021_hiqual_8=0&${fmt}`);
  const totalJson = await totalRes.json();
  const total = totalJson.obs?.[0]?.obs_value || 1;

  const totalAgeRes = await fetch(`${base}/C2021TS007A.data.json?${geo}&c2021_age_92=0&${fmt}`);
  const totalAgeJson = await totalAgeRes.json();
  const totalAge = totalAgeJson.obs?.[0]?.obs_value || 1;

  const totalProfRes = await fetch(`${base}/C2021TS062.data.json?${geo}&c_ns_sec_9=0&${fmt}`);
  const totalProfJson = await totalProfRes.json();
  const totalProf = totalProfJson.obs?.[0]?.obs_value || 1;

  // Sum age 25-44 (codes 6,7,8,9,10 = 25-29,30-34,35-39,40-44)
  const degVal = degJson.obs?.[0]?.obs_value || 0;
  const ageVal = ageJson.obs?.reduce((s, o) => s + (o.obs_value || 0), 0) || 0;
  const profVal = profJson.obs?.reduce((s, o) => s + (o.obs_value || 0), 0) || 0;

  return {
    deg:  Math.round((degVal  / total)    * 1000) / 10,
    age:  Math.round((ageVal  / totalAge) * 1000) / 10,
    prof: Math.round((profVal / totalProf)* 1000) / 10,
  };
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
  if (d === "warn" || compResult === "warn" || viewResult === "warn") return "warn";
  return "pass";
}

function inferCharacter(lsoaName, area) {
  const s = (lsoaName + " " + area).toLowerCase();
  if (s.includes("city of london") || s.includes("westminster") || s.includes("canary wharf")) return "transient";
  if (s.includes("stratford") || s.includes("nine elms") || s.includes("thamesmead") || s.includes("canning town")) return "newbuild";
  const villageAreas = ["blackheath","dulwich","herne hill","barnes","richmond","wimbledon","chiswick","hampstead","highgate","clapham","balham","putney","muswell hill","crouch end","notting hill","kensington","chelsea","battersea"];
  if (villageAreas.some(v => s.includes(v))) return "village";
  return "mixed";
}

// ── SMALL UI COMPONENTS ───────────────────────────────────────────────────────

const RESULT_CONFIG = {
  pass:     { bg: "#E1F5EE", border: "#0F6E56", text: "#085041", icon: "✓" },
  warn:     { bg: "#FAEEDA", border: "#854F0B", text: "#633806", icon: "⚠" },
  marginal: { bg: "#FAEEDA", border: "#854F0B", text: "#633806", icon: "⚠" },
  fail:     { bg: "#FCEBEB", border: "#A32D2D", text: "#791F1F", icon: "✗" },
};

function StatusPill({ result }) {
  const cfg = RESULT_CONFIG[result] || { bg: "#F1EFE8", border: "#5F5E5A", text: "#444441", icon: "—" };
  const label = result === "pass" ? "Pass" : result === "fail" ? "Fail" : result === "marginal" ? "Marginal" : result === "warn" ? "Caution" : "Pending";
  return (
    <span style={{ display:"inline-block", fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:20, background:cfg.bg, color:cfg.text, border:`0.5px solid ${cfg.border}` }}>
      {label}
    </span>
  );
}

function VerdictBox({ result, title, subtitle }) {
  const cfg = RESULT_CONFIG[result] || RESULT_CONFIG.warn;
  return (
    <div style={{ background:cfg.bg, border:`0.5px solid ${cfg.border}`, borderRadius:8, padding:"10px 14px", display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
      <span style={{ fontSize:18, color:cfg.text, flexShrink:0 }}>{cfg.icon}</span>
      <div>
        <div style={{ fontSize:14, fontWeight:500, color:cfg.text }}>{title}</div>
        {subtitle && <div style={{ fontSize:12, color:cfg.text, marginTop:2, lineHeight:1.5 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function MetricCard({ label, value, threshold, maxVal }) {
  if (value == null) return (
    <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"10px 12px" }}>
      <div style={{ fontSize:11, color:"#888", marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color:"#aaa" }}>—</div>
      <div style={{ fontSize:10, color:"#aaa", marginTop:3 }}>Not available</div>
    </div>
  );
  const passes = value >= threshold;
  const color = passes ? "#0F6E56" : "#A32D2D";
  const pct = Math.min(100, Math.round((value / maxVal) * 100));
  const threshPct = Math.min(100, Math.round((threshold / maxVal) * 100));
  return (
    <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"10px 12px" }}>
      <div style={{ fontSize:11, color:"#666", marginBottom:5, lineHeight:1.3 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color, marginBottom:4 }}>{value}%</div>
      <div style={{ height:5, background:"#eee", borderRadius:3, marginBottom:4, position:"relative" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3 }} />
        <div style={{ position:"absolute", top:-2, bottom:-2, left:`${threshPct}%`, width:2, background:"#E24B4A", borderRadius:1 }} />
      </div>
      <div style={{ fontSize:10, color:"#999" }}>Threshold ≥{threshold}%</div>
    </div>
  );
}

function ContextFlag({ icon, text }) {
  return (
    <div style={{ border:"0.5px solid rgba(0,0,0,0.12)", borderRadius:8, padding:"8px 12px", marginBottom:6, display:"flex", gap:8, alignItems:"flex-start" }}>
      <span style={{ fontSize:14, color:"#888", flexShrink:0, marginTop:1 }}>{icon}</span>
      <p style={{ fontSize:12, color:"#666", lineHeight:1.5, margin:0 }}>{text}</p>
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display:"flex", gap:6 }}>
      {options.map(opt => {
        const active = value === opt.value;
        const cfg = opt.result ? (RESULT_CONFIG[opt.result] || {}) : {};
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{ flex:1, padding:"8px 6px", borderRadius:8, cursor:"pointer", border: active && cfg.border ? `1px solid ${cfg.border}` : "0.5px solid rgba(0,0,0,0.12)", background: active && cfg.bg ? cfg.bg : "#f5f5f3", color: active && cfg.text ? cfg.text : "#555", fontWeight: active ? 500 : 400, fontSize:12, textAlign:"center", transition:"all 0.15s" }}>
            <div style={{ fontSize:16, marginBottom:3 }}>{opt.icon}</div>
            <div style={{ fontWeight:500 }}>{opt.label}</div>
            <div style={{ fontSize:10, opacity:0.8, marginTop:1 }}>{opt.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

function ViewItem({ label, hint, value, onChange }) {
  const opts = [
    { value:"good", label:"Good",     result:"pass" },
    { value:"mod",  label:"Moderate", result:"warn" },
    { value:"poor", label:"Poor",     result:"fail" },
  ];
  return (
    <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"10px 12px", marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom: hint ? 8 : 0 }}>
        <span style={{ fontSize:13, fontWeight:500 }}>{label}</span>
        <div style={{ display:"flex", gap:5 }}>
          {opts.map(o => {
            const cfg = RESULT_CONFIG[o.result];
            const active = value === o.value;
            return (
              <button key={o.value} onClick={() => onChange(o.value)} style={{ padding:"4px 10px", fontSize:11, borderRadius:20, cursor:"pointer", border: active ? `0.5px solid ${cfg.border}` : "0.5px solid rgba(0,0,0,0.12)", background: active ? cfg.bg : "#f5f5f3", color: active ? cfg.text : "#888", fontWeight: active ? 500 : 400 }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      {hint && <p style={{ fontSize:11, color:"#999", margin:0 }}>{hint}</p>}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function LevelOutSiteScorer() {
  const [postcode, setPostcode]         = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [dataSource, setDataSource]     = useState(null); // "lsoa-exact" | "lsoa-live" | "estimated"
  const [activeTab, setActiveTab]       = useState(0);
  const [comp, setComp]                 = useState(null);
  const [fitness, setFitness]           = useState(null);
  const [view, setView] = useState({
    transport:null, frontage:null, pedestrian:null,
    street:null, lifestyle:null, neighbourhood:null,
  });

  const handleAssess = async () => {
    const trimmed = postcode.trim().toUpperCase();
    if (!trimmed) { setError("Please enter a postcode."); return; }
    const clean = trimmed.replace(/\s/g,"");
    if (clean.length < 5 || clean.length > 7) { setError("Enter a valid UK postcode (e.g. SE15 4QD)."); return; }

    setError("");
    setLoading(true);
    setLookupResult(null);
    setDataSource(null);
    setComp(null);
    setFitness(null);
    setView({ transport:null, frontage:null, pedestrian:null, street:null, lifestyle:null, neighbourhood:null });
    setActiveTab(0);

    const formatted = clean.slice(0,-3) + " " + clean.slice(-3);
    const district = formatted.split(" ")[0];

    // Check if it's a portfolio postcode first — use exact LSOA data
    const exactLsoa = LSOA_POSTCODE_MAP[district];
    if (exactLsoa && LSOA_DB[exactLsoa]) {
      setLookupResult({ postcode: formatted, district, lsoaCode: exactLsoa, data: LSOA_DB[exactLsoa] });
      setDataSource("lsoa-exact");
      setLoading(false);
      return;
    }

    // Otherwise fetch live from APIs
    try {
      const { lsoaCode, area } = await fetchLSOAFromPostcode(formatted);

      if (!lsoaCode) throw new Error("No LSOA found for this postcode");

      const censusData = await fetchCensusForLSOA(lsoaCode);
      const char = inferCharacter(lsoaCode, area);

      setLookupResult({
        postcode: formatted,
        district,
        lsoaCode,
        data: {
          area,
          deg:  censusData.deg,
          age:  censusData.age,
          prof: censusData.prof,
          char,
          popDesc: `${area} — live ONS Census 2021 data for LSOA ${lsoaCode}`,
        }
      });
      setDataSource("lsoa-live");

    } catch (err) {
      // API failed — show error with option to continue with district estimate
      setError(`Could not fetch live data: ${err.message}. Check postcode and try again.`);
    }

    setLoading(false);
  };

  const handleReset = () => {
    setPostcode(""); setLookupResult(null); setError(""); setLoading(false); setDataSource(null);
    setComp(null); setFitness(null);
    setView({ transport:null, frontage:null, pedestrian:null, street:null, lifestyle:null, neighbourhood:null });
    setActiveTab(0);
  };

  const demoResult  = getDemoResult(lookupResult?.data);
  const compResult  = getCompResult(comp);
  const viewResult  = getViewResult(view);
  const overall     = getOverall(demoResult, compResult, viewResult);
  const demoStatus  = demoResult === "pass" ? "pass" : demoResult === "marginal" ? "warn" : demoResult === "fail" ? "fail" : null;
  const tabStatuses = [demoStatus, compResult, viewResult, overall];

  const TAB_LABELS = ["Demographics", "Competition", "Visibility", "Results"];
  const TAB_ICONS  = ["👥", "🏪", "👁️", "📊"];
  const statusIcon  = s => s === "pass" ? "✓" : s === "warn" ? "⚠" : s === "fail" ? "✗" : "—";
  const statusColor = s => s === "pass" ? "#0F6E56" : s === "warn" ? "#854F0B" : s === "fail" ? "#A32D2D" : "#aaa";

  const dataSourceLabel = dataSource === "lsoa-exact"
    ? "✓ Exact LSOA data — portfolio calibration site"
    : dataSource === "lsoa-live"
    ? `✓ Live LSOA data — ONS Census 2021 · ${lookupResult?.lsoaCode}`
    : null;

  return (
    <div style={{ fontFamily:"system-ui,-apple-system,sans-serif", maxWidth:680, margin:"0 auto", padding:"24px 16px", color:"#1a1a1a" }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <h1 style={{ fontSize:20, fontWeight:500 }}>LevelOut Site Scorer</h1>
          <span style={{ fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:20, background:"#E1F5EE", color:"#085041" }}>
            Live LSOA data
          </span>
        </div>
        <p style={{ fontSize:13, color:"#666" }}>
          Three-stage filter · Demographics powered by live ONS Census 2021 API · Thresholds calibrated against 18 London sites
        </p>
      </div>

      {/* Postcode input */}
      <div style={{ marginBottom:20 }}>
        <label style={{ fontSize:13, color:"#666", display:"block", marginBottom:6 }}>Enter a postcode to assess</label>
        <div style={{ display:"flex", gap:8 }}>
          <input
            value={postcode}
            onChange={e => setPostcode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && !loading && handleAssess()}
            placeholder="e.g. CR0 2AD"
            maxLength={8}
            disabled={loading}
            style={{ flex:1, fontSize:15, padding:"8px 12px", borderRadius:8, border:"0.5px solid rgba(0,0,0,0.2)", letterSpacing:"0.05em", outline:"none", background:"#fff", opacity: loading ? 0.6 : 1 }}
          />
          <button
            onClick={handleAssess}
            disabled={loading}
            style={{ padding:"8px 20px", fontSize:14, fontWeight:500, borderRadius:8, border:"0.5px solid rgba(0,0,0,0.2)", background: loading ? "#f0f0f0" : "#fff", cursor: loading ? "default" : "pointer", whiteSpace:"nowrap" }}
          >
            {loading ? "Fetching..." : "Assess ↗"}
          </button>
        </div>
        {error && <div style={{ fontSize:13, color:"#A32D2D", marginTop:6 }}>{error}</div>}
        {loading && (
          <div style={{ fontSize:12, color:"#666", marginTop:8, padding:"8px 12px", background:"#f5f5f3", borderRadius:8 }}>
            Fetching live LSOA data from ONS Census 2021...
          </div>
        )}
        {dataSourceLabel && !loading && (
          <div style={{ fontSize:11, color:"#0F6E56", marginTop:6 }}>{dataSourceLabel}</div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {TAB_LABELS.map((label, i) => {
          const status = tabStatuses[i];
          const active = activeTab === i;
          return (
            <button key={i} onClick={() => setActiveTab(i)} style={{ flex:1, padding:"8px 6px", borderRadius:8, cursor:"pointer", border: active ? "1px solid #185FA5" : "0.5px solid rgba(0,0,0,0.12)", background: active ? "#E6F1FB" : "#f5f5f3", textAlign:"center", transition:"all 0.15s" }}>
              <div style={{ fontSize:16, marginBottom:2 }}>{TAB_ICONS[i]}</div>
              <div style={{ fontSize:10, color: active ? "#185FA5" : "#999", marginBottom:1 }}>{i < 3 ? `Stage ${i+1}` : ""}</div>
              <div style={{ fontSize:12, fontWeight:500, color: active ? "#0C447C" : "#333" }}>{label}</div>
              <div style={{ fontSize:11, color:statusColor(status), marginTop:2, fontWeight:500 }}>{statusIcon(status)}</div>
            </button>
          );
        })}
      </div>

      {/* ── STAGE 1: DEMOGRAPHICS ── */}
      {activeTab === 0 && (
        <div>
          {!lookupResult && !loading ? (
            <p style={{ fontSize:13, color:"#999", padding:"8px 0" }}>Enter a postcode above to run the demographic analysis.</p>
          ) : lookupResult ? (
            <>
              <div style={{ fontSize:11, fontWeight:500, color:"#888", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>
                Census 2021 signals — LSOA level
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                <MetricCard label="Level 4+ qualifications" value={lookupResult.data?.deg}  threshold={THRESHOLDS.deg}  maxVal={85} />
                <MetricCard label="Aged 25–44"              value={lookupResult.data?.age}  threshold={THRESHOLDS.age}  maxVal={60} />
                <MetricCard label="Professional / managerial" value={lookupResult.data?.prof} threshold={THRESHOLDS.prof} maxVal={70} />
              </div>

              {demoResult === "pass"     && <VerdictBox result="pass"     title="Demographics: Pass"     subtitle={`${lookupResult.data?.area} — ${lookupResult.data?.popDesc}`} />}
              {demoResult === "marginal" && <VerdictBox result="marginal" title="Demographics: Marginal"  subtitle={`${lookupResult.data?.area} — passes most thresholds but at least one signal is below minimum. Proceed with extra caution.`} />}
              {demoResult === "fail"     && <VerdictBox result="fail"     title="Demographics: Fail — do not proceed" subtitle={`${lookupResult.data?.area} — profile does not meet LevelOut's minimum demographic threshold.`} />}

              {lookupResult.data?.char === "village"   && <ContextFlag icon="🏡" text="Village character — organic, community-rooted neighbourhood. Higher ceiling potential and strong word-of-mouth dynamics." />}
              {lookupResult.data?.char === "newbuild"  && <ContextFlag icon="🏢" text="New build character — good visibility but expect faster launch, potentially lower ceiling, and higher member churn vs. village areas." />}
              {lookupResult.data?.char === "transient" && <ContextFlag icon="💼" text="Transient / office-dominant character — high education metrics but low residential rootedness. Similar profile to St Paul's EC4M in your portfolio." />}

              <p style={{ fontSize:11, color:"#bbb", marginTop:12, paddingTop:10, borderTop:"0.5px solid rgba(0,0,0,0.08)" }}>
                {dataSource === "lsoa-live" ? `Live data: ONS Census 2021 via Nomis API · LSOA ${lookupResult.lsoaCode}` : "Source: ONS Census 2021 · LevelOut portfolio calibration data"}
              </p>
            </>
          ) : null}
          <button onClick={() => setActiveTab(1)} style={{ width:"100%", padding:"9px", marginTop:16, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.15)", borderRadius:8, cursor:"pointer" }}>
            Continue to competition →
          </button>
        </div>
      )}

      {/* ── STAGE 2: COMPETITION ── */}
      {activeTab === 1 && (
        <div>
          <div style={{ fontSize:11, fontWeight:500, color:"#888", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Direct reformer competition within 1km</div>
          <ToggleGroup value={comp} onChange={setComp} options={[
            { value:"low",  label:"Low",      sub:"0–1 studios",  icon:"✓", result:"pass" },
            { value:"mod",  label:"Moderate", sub:"2–3 studios",  icon:"⚠", result:"warn" },
            { value:"high", label:"High",     sub:"4+ studios",   icon:"✗", result:"fail" },
          ]} />

          <div style={{ fontSize:11, fontWeight:500, color:"#888", textTransform:"uppercase", letterSpacing:"0.07em", margin:"16px 0 10px" }}>Indirect boutique fitness market nearby</div>
          <ToggleGroup value={fitness} onChange={setFitness} options={[
            { value:"low",  label:"Low",      sub:"Market unproven", icon:"—", result:"warn" },
            { value:"mod",  label:"Moderate", sub:"Some demand",     icon:"✓", result:"pass" },
            { value:"high", label:"High",     sub:"Strong demand",   icon:"🔥", result:"pass" },
          ]} />

          <div style={{ marginTop:10 }}>
            {compResult === "fail" && <VerdictBox result="fail" title="Competition: Fail — do not proceed" subtitle="High direct competition is disqualifying. No strong site in your portfolio has high direct competition." />}
            {compResult === "warn" && <VerdictBox result="warn" title="Competition: Caution" subtitle="Moderate competition is viable but requires strong visibility and demographics to compensate." />}
            {compResult === "pass" && <VerdictBox result="pass" title="Competition: Pass" subtitle="Low direct competition — strong market position. Your best sites entered low-competition markets." />}
          </div>

          <button onClick={() => setActiveTab(2)} style={{ width:"100%", padding:"9px", marginTop:16, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.15)", borderRadius:8, cursor:"pointer" }}>
            Continue to visibility →
          </button>
        </div>
      )}

      {/* ── STAGE 3: VISIBILITY ── */}
      {activeTab === 2 && (
        <div>
          <p style={{ fontSize:13, color:"#666", marginBottom:14 }}>Score the unit and its immediate surroundings based on your viewing.</p>
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
            {viewResult === "fail" && <VerdictBox result="fail" title="Visibility: Fail" subtitle="Multiple poor viewing scores. Unit conditions will significantly hamper performance regardless of neighbourhood quality." />}
            {viewResult === "pass" && <VerdictBox result="pass" title="Visibility: Pass" subtitle="Strong unit conditions across all criteria." />}
            {viewResult === "warn" && <VerdictBox result="warn" title="Visibility: Moderate" subtitle="Mixed viewing scores. Site needs strong demographics and low competition to compensate." />}
          </div>

          <button onClick={() => setActiveTab(3)} style={{ width:"100%", padding:"9px", marginTop:12, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.15)", borderRadius:8, cursor:"pointer" }}>
            View full results →
          </button>
        </div>
      )}

      {/* ── RESULTS ── */}
      {activeTab === 3 && (
        <div>
          {!lookupResult ? (
            <p style={{ fontSize:13, color:"#999", padding:"8px 0" }}>Complete all three stages to see your full assessment.</p>
          ) : (
            <>
              {overall && (
                <div style={{ borderRadius:12, padding:"14px 16px", textAlign:"center", marginBottom:14, background: overall==="pass"?"#E1F5EE":overall==="warn"?"#FAEEDA":"#FCEBEB" }}>
                  <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5, color: overall==="pass"?"#085041":overall==="warn"?"#633806":"#791F1F" }}>Overall assessment</div>
                  <div style={{ fontSize:20, fontWeight:500, marginBottom:4, color: overall==="pass"?"#085041":overall==="warn"?"#633806":"#791F1F" }}>
                    {overall==="pass"?"Strong candidate":overall==="warn"?"Proceed with caution":"Do not proceed"}
                  </div>
                  <div style={{ fontSize:12, color: overall==="pass"?"#085041":overall==="warn"?"#633806":"#791F1F" }}>
                    {overall==="pass" && "All three stages pass. This site profiles similarly to your best-performing locations."}
                    {overall==="warn" && "Site passes minimum thresholds but has caution flags. Weigh risks carefully before committing to Heads of Terms."}
                    {overall==="fail" && "One or more stages have failed. This site does not meet LevelOut's minimum criteria."}
                  </div>
                </div>
              )}

              <div style={{ background:"#fff", border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:12, overflow:"hidden", marginBottom:12 }}>
                <div style={{ padding:"12px 16px", borderBottom:"0.5px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize:22, fontWeight:500, letterSpacing:"0.05em" }}>{lookupResult.postcode}</div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{lookupResult.data?.area}</div>
                  {lookupResult.lsoaCode && <div style={{ fontSize:11, color:"#aaa", marginTop:1 }}>LSOA: {lookupResult.lsoaCode}</div>}
                </div>
                {[
                  { label:"Stage 1 — Demographics", result:demoStatus,  icon:"👥" },
                  { label:"Stage 2 — Competition",  result:compResult,  icon:"🏪" },
                  { label:"Stage 3 — Visibility",   result:viewResult,  icon:"👁️" },
                ].map((row, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", padding:"10px 16px", borderBottom: i<2?"0.5px solid rgba(0,0,0,0.08)":"none", gap:10 }}>
                    <span style={{ fontSize:18, flexShrink:0, width:24 }}>{row.icon}</span>
                    <span style={{ flex:1, fontSize:13 }}>{row.label}</span>
                    <StatusPill result={row.result || "pending"} />
                  </div>
                ))}
              </div>

              {lookupResult.data && (
                <div style={{ border:"0.5px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"8px 12px", marginBottom:8, display:"flex", gap:8 }}>
                  <span style={{ fontSize:14, color:"#888", flexShrink:0 }}>📍</span>
                  <p style={{ fontSize:12, color:"#666", lineHeight:1.5, margin:0 }}>{lookupResult.data.popDesc}</p>
                </div>
              )}

              <p style={{ fontSize:11, color:"#bbb", marginTop:8, paddingTop:8, borderTop:"0.5px solid rgba(0,0,0,0.08)" }}>
                {dataSource === "lsoa-live" ? `Live ONS Census 2021 data · LSOA ${lookupResult.lsoaCode} · Thresholds calibrated against 18 LevelOut London sites` : "ONS Census 2021 · LevelOut portfolio calibration data"}
              </p>
            </>
          )}
          <button onClick={handleReset} style={{ width:"100%", padding:"9px", marginTop:12, fontSize:13, fontWeight:500, background:"#fff", border:"0.5px solid rgba(0,0,0,0.15)", borderRadius:8, cursor:"pointer" }}>
            Start new assessment
          </button>
        </div>
      )}
    </div>
  );
}
