import { useState } from "react";
import LSOA_CENSUS from "./lsoaCensus.js";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const THRESHOLDS = { deg: 55, age: 40, prof: 40, dens: { low: 3000, high: 20000 } };

const TRAFFIC = {
  deg:  { green: 62, amber: 55 },
  age:  { green: 55, amber: 40 },
  prof: { green: 50, amber: 40 },
};

function getLight(metric, value) {
  if (value == null) return null;
  if (metric === 'dens') {
    if (value >= THRESHOLDS.dens.low && value < THRESHOLDS.dens.high) return 'green';
    if (value >= THRESHOLDS.dens.high) return 'amber';
    return 'red';
  }
  const t = TRAFFIC[metric];
  if (value >= t.green) return 'green';
  if (value >= t.amber) return 'amber';
  return 'red';
}

const LIGHT_CFG = {
  green: { bg: '#E1F5EE', border: '#0F6E56', text: '#085041', dot: '#1D9E75' },
  amber: { bg: '#FAEEDA', border: '#854F0B', text: '#633806', dot: '#BA7517' },
  red:   { bg: '#FCEBEB', border: '#A32D2D', text: '#791F1F', dot: '#E24B4A' },
};

// ── SCORING HELPERS ───────────────────────────────────────────────────────────

function getDemoResult(data) {
  if (!data) return null;
  let pass = 0, total = 0;
  if (data.deg  != null) { total++; if (data.deg  >= THRESHOLDS.deg)  pass++; }
  if (data.age  != null) { total++; if (data.age  >= THRESHOLDS.age)  pass++; }
  if (data.prof != null) { total++; if (data.prof >= THRESHOLDS.prof) pass++; }
  if (total === 0) return null;
  return pass >= 2 ? (pass === total ? 'pass' : 'marginal') : 'fail';
}

function getCompResult(comp) {
  if (!comp) return null;
  return comp === 'low' ? 'pass' : comp === 'mod' ? 'warn' : 'fail';
}

function getViewResult(view) {
  const vals = Object.values(view).filter(Boolean);
  if (vals.length < 6) return null;
  const good = vals.filter(v => v === 'good').length;
  const poor = vals.filter(v => v === 'poor').length;
  return poor >= 3 ? 'fail' : good >= 4 ? 'pass' : 'warn';
}

function getOverall(demoResult, compResult, viewResult) {
  if (!demoResult || !compResult || !viewResult) return null;
  const d = demoResult === 'pass' ? 'pass' : demoResult === 'marginal' ? 'warn' : 'fail';
  if (d === 'fail' || compResult === 'fail' || viewResult === 'fail') return 'fail';
  if (d === 'warn' || compResult === 'warn' || viewResult === 'warn') return 'warn';
  return 'pass';
}

// ── POSTCODE LOOKUP ───────────────────────────────────────────────────────────

async function fetchLSOAFromPostcode(postcode) {
  const clean = postcode.replace(/\s/g, '').toUpperCase();
  const res = await fetch(`https://api.postcodes.io/postcodes/${clean}`);
  if (!res.ok) throw new Error('Postcode not found — please check and try again');
  const json = await res.json();
  if (!json.result) throw new Error('Postcode not found — please check and try again');
  return {
    lsoaCode: json.result?.codes?.lsoa,
    ward:     json.result?.admin_ward || '',
    district: json.result?.outcode || '',
    borough:  json.result?.admin_district || '',
  };
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────

const VERDICT_CFG = {
  pass:     { bg: '#E1F5EE', border: '#0F6E56', text: '#085041', icon: '✓' },
  marginal: { bg: '#FAEEDA', border: '#854F0B', text: '#633806', icon: '⚠' },
  warn:     { bg: '#FAEEDA', border: '#854F0B', text: '#633806', icon: '⚠' },
  fail:     { bg: '#FCEBEB', border: '#A32D2D', text: '#791F1F', icon: '✗' },
};

function pill(result) {
  const c = VERDICT_CFG[result] || { bg: '#F1EFE8', border: '#aaa', text: '#666' };
  const label = result === 'pass' ? 'Pass' : result === 'fail' ? 'Fail' : result === 'marginal' ? 'Marginal' : result === 'warn' ? 'Caution' : 'Pending';
  return <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.text, border: `0.5px solid ${c.border}` }}>{label}</span>;
}

function VerdictBox({ result, title, subtitle }) {
  const c = VERDICT_CFG[result] || VERDICT_CFG.warn;
  return (
    <div style={{ background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
      <span style={{ fontSize: 18, color: c.text, flexShrink: 0 }}>{c.icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: c.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: c.text, marginTop: 2, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function TrafficMetricCard({ label, value, metric, unit, description, greenNote, amberNote, redNote }) {
  const light = getLight(metric, value);
  const cfg = light ? LIGHT_CFG[light] : { bg: '#f7f7f5', border: 'rgba(0,0,0,0.1)', text: '#aaa', dot: '#ccc' };
  const note = light === 'green' ? greenNote : light === 'amber' ? amberNote : light === 'red' ? redNote : '—';
  const displayVal = value == null ? '—' : unit === 'density' ? `${(value / 1000).toFixed(1)}k/km²` : `${value}%`;

  return (
    <div style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.3 }}>{label}</div>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.dot, flexShrink: 0, marginTop: 1 }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 500, color: cfg.text, marginBottom: 4 }}>{displayVal}</div>
      <div style={{ fontSize: 11, color: cfg.text, lineHeight: 1.4 }}>{note}</div>
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => {
        const active = value === opt.value;
        const c = opt.result ? (VERDICT_CFG[opt.result] || {}) : {};
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{ flex: 1, padding: '9px 6px', borderRadius: 8, cursor: 'pointer', border: active && c.border ? `1px solid ${c.border}` : '0.5px solid rgba(0,0,0,0.12)', background: active && c.bg ? c.bg : '#f7f7f5', color: active && c.text ? c.text : '#555', fontWeight: active ? 500 : 400, fontSize: 12, textAlign: 'center', transition: 'all 0.12s', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 17, marginBottom: 3 }}>{opt.icon}</div>
            <div style={{ fontWeight: 500, marginBottom: 1 }}>{opt.label}</div>
            <div style={{ fontSize: 10, opacity: 0.75 }}>{opt.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

function ViewItem({ label, hint, value, onChange }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: hint ? 7 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', gap: 5 }}>
          {[{ v: 'good', l: 'Good', r: 'pass' }, { v: 'mod', l: 'Moderate', r: 'warn' }, { v: 'poor', l: 'Poor', r: 'fail' }].map(o => {
            const c = VERDICT_CFG[o.r];
            const active = value === o.v;
            return (
              <button key={o.v} onClick={() => onChange(o.v)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer', border: active ? `0.5px solid ${c.border}` : '0.5px solid rgba(0,0,0,0.12)', background: active ? c.bg : '#f7f7f5', color: active ? c.text : '#888', fontWeight: active ? 500 : 400, fontFamily: 'inherit' }}>
                {o.l}
              </button>
            );
          })}
        </div>
      </div>
      {hint && <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{hint}</p>}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function LevelOutSiteScorer() {
  const [postcode, setPostcode]   = useState('');
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [comp, setComp]           = useState(null);
  const [fitness, setFitness]     = useState(null);
  const [view, setView] = useState({
    transport: null, frontage: null, pedestrian: null,
    street: null, lifestyle: null, neighbourhood: null,
  });

  const handleAssess = async () => {
    const trimmed = postcode.trim().toUpperCase();
    if (!trimmed) { setError('Please enter a postcode.'); return; }
    const clean = trimmed.replace(/\s/g, '');
    if (clean.length < 5 || clean.length > 7) { setError('Enter a valid UK postcode (e.g. SE15 4QD).'); return; }
    setError(''); setLoading(true); setResult(null);
    setComp(null); setFitness(null);
    setView({ transport: null, frontage: null, pedestrian: null, street: null, lifestyle: null, neighbourhood: null });
    setActiveTab(0);

    try {
      const formatted = clean.slice(0, -3) + ' ' + clean.slice(-3);
      const { lsoaCode, ward, district, borough } = await fetchLSOAFromPostcode(formatted);
      if (!lsoaCode) throw new Error('Could not determine LSOA for this postcode');
      const censusData = LSOA_CENSUS[lsoaCode];
      if (!censusData) throw new Error(`No census data found for LSOA ${lsoaCode}. This postcode may be outside Greater London.`);
      setResult({ postcode: formatted, lsoaCode, ward, district, borough, data: censusData });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleReset = () => {
    setPostcode(''); setResult(null); setError(''); setLoading(false);
    setComp(null); setFitness(null);
    setView({ transport: null, frontage: null, pedestrian: null, street: null, lifestyle: null, neighbourhood: null });
    setActiveTab(0);
  };

  const demoResult  = getDemoResult(result?.data);
  const compResult  = getCompResult(comp);
  const viewResult  = getViewResult(view);
  const overall     = getOverall(demoResult, compResult, viewResult);
  const demoStatus  = demoResult === 'pass' ? 'pass' : demoResult === 'marginal' ? 'warn' : demoResult === 'fail' ? 'fail' : null;
  const tabStatuses = [demoStatus, compResult, viewResult, overall];

  const TAB_LABELS = ['Demographics', 'Competition', 'Visibility', 'Results'];
  const TAB_ICONS  = ['👥', '🏪', '👁️', '📊'];
  const sIcon  = s => s === 'pass' ? '✓' : s === 'warn' ? '⚠' : s === 'fail' ? '✗' : '—';
  const sColor = s => s === 'pass' ? '#0F6E56' : s === 'warn' ? '#854F0B' : s === 'fail' ? '#A32D2D' : '#ccc';

  return (
    <div style={{ fontFamily: 'system-ui,-apple-system,sans-serif', maxWidth: 680, margin: '0 auto', padding: '24px 16px', color: '#1a1a1a', minHeight: '100vh', background: '#fafaf8' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>LevelOut Site Scorer</h1>
          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 20, background: '#E1F5EE', color: '#085041' }}>Live LSOA data</span>
        </div>
        <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
          Three-stage filter · 4,994 London LSOAs · ONS Census 2021 · Calibrated against 18 LevelOut sites
        </p>
      </div>

      {/* Postcode input */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>Enter a postcode to assess</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={postcode}
            onChange={e => setPostcode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && !loading && handleAssess()}
            placeholder="e.g. CR0 2AD"
            maxLength={8}
            disabled={loading}
            style={{ flex: 1, fontSize: 15, padding: '9px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.2)', letterSpacing: '0.05em', outline: 'none', background: '#fff', fontFamily: 'inherit' }}
          />
          <button onClick={handleAssess} disabled={loading} style={{ padding: '9px 20px', fontSize: 14, fontWeight: 500, borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.15)', background: loading ? '#f0f0ee' : '#fff', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? 'Loading…' : 'Assess ↗'}
          </button>
        </div>
        {error && <div style={{ fontSize: 13, color: '#A32D2D', marginTop: 6, padding: '8px 12px', background: '#FCEBEB', borderRadius: 6 }}>{error}</div>}
        {result && !loading && (
          <div style={{ fontSize: 11, color: '#0F6E56', marginTop: 6 }}>
            ✓ Real-time data · LSOA {result.lsoaCode} · {result.borough}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TAB_LABELS.map((label, i) => {
          const status = tabStatuses[i];
          const active = activeTab === i;
          return (
            <button key={i} onClick={() => setActiveTab(i)} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', border: active ? '1px solid #185FA5' : '0.5px solid rgba(0,0,0,0.12)', background: active ? '#E6F1FB' : '#f7f7f5', textAlign: 'center', transition: 'all 0.12s', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{TAB_ICONS[i]}</div>
              <div style={{ fontSize: 10, color: active ? '#185FA5' : '#aaa', marginBottom: 1 }}>{i < 3 ? `Stage ${i + 1}` : ''}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: active ? '#0C447C' : '#333' }}>{label}</div>
              <div style={{ fontSize: 12, color: sColor(status), marginTop: 2, fontWeight: 500 }}>{sIcon(status)}</div>
            </button>
          );
        })}
      </div>

      {/* ── STAGE 1: DEMOGRAPHICS ── */}
      {activeTab === 0 && (
        <div>
          {!result ? (
            <p style={{ fontSize: 13, color: '#aaa', padding: '8px 0' }}>Enter a postcode above to run the demographic analysis.</p>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                ONS Census 2021 — LSOA {result.lsoaCode}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <TrafficMetricCard
                  label="Level 4+ qualifications"
                  value={result.data.deg}
                  metric="deg"
                  greenNote="Strong — above portfolio average for top-performing sites"
                  amberNote="Meets minimum threshold — profile is adequate but below portfolio average"
                  redNote="Below minimum threshold — demographic profile is a concern"
                />
                <TrafficMetricCard
                  label="Aged 25–54"
                  value={result.data.age}
                  metric="age"
                  greenNote="Strong core customer age group well represented"
                  amberNote="Adequate age profile — some core demographic present"
                  redNote="Low representation of core customer age group"
                />
                <TrafficMetricCard
                  label="Professional / managerial occupations"
                  value={result.data.prof}
                  metric="prof"
                  greenNote="Strong professional density — good spend propensity"
                  amberNote="Adequate professional presence — meets minimum threshold"
                  redNote="Low professional density — spend propensity concern"
                />
                <TrafficMetricCard
                  label="Population density"
                  value={result.data.dens}
                  metric="dens"
                  unit="density"
                  greenNote="Good catchment density — strong walkable customer base"
                  amberNote="Very high density — check for newbuild or transient population"
                  redNote="Low density — transport and visibility more critical for catchment"
                />
              </div>

              {demoResult === 'pass'     && <VerdictBox result="pass"     title="Demographics: Pass"              subtitle={`${result.ward}, ${result.borough}`} />}
              {demoResult === 'marginal' && <VerdictBox result="marginal" title="Demographics: Marginal"           subtitle="Passes most thresholds but at least one signal is below minimum. Proceed with extra caution." />}
              {demoResult === 'fail'     && <VerdictBox result="fail"     title="Demographics: Fail — do not proceed" subtitle="Profile does not meet LevelOut's minimum demographic threshold. Stage 2 and 3 not required." />}

              <p style={{ fontSize: 11, color: '#ccc', marginTop: 12, paddingTop: 10, borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                Source: ONS Census 2021 · Nomis TS067, TS007A, TS062, TS006 · Age band: 25–54 · Thresholds calibrated against 18 LevelOut London sites
              </p>
            </>
          )}
          <button onClick={() => setActiveTab(1)} style={{ width: '100%', padding: '9px', marginTop: 16, fontSize: 13, fontWeight: 500, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
            Continue to competition →
          </button>
        </div>
      )}

      {/* ── STAGE 2: COMPETITION ── */}
      {activeTab === 1 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Direct reformer competition within 1km</div>
          <ToggleGroup value={comp} onChange={setComp} options={[
            { value: 'low',  label: 'Low',      sub: '0–1 studios', icon: '✓', result: 'pass' },
            { value: 'mod',  label: 'Moderate', sub: '2–3 studios', icon: '⚠', result: 'warn' },
            { value: 'high', label: 'High',     sub: '4+ studios',  icon: '✗', result: 'fail' },
          ]} />

          <div style={{ fontSize: 11, fontWeight: 500, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '16px 0 10px' }}>Indirect boutique fitness market nearby</div>
          <ToggleGroup value={fitness} onChange={setFitness} options={[
            { value: 'low',  label: 'Low',      sub: 'Market unproven', icon: '—', result: 'warn' },
            { value: 'mod',  label: 'Moderate', sub: 'Some demand',     icon: '✓', result: 'pass' },
            { value: 'high', label: 'High',     sub: 'Strong demand',   icon: '🔥', result: 'pass' },
          ]} />

          <div style={{ marginTop: 12 }}>
            {compResult === 'fail' && <VerdictBox result="fail" title="Competition: Fail — do not proceed" subtitle="High direct competition is disqualifying. No strong site in your portfolio has high direct competition." />}
            {compResult === 'warn' && <VerdictBox result="warn" title="Competition: Caution" subtitle="Moderate competition is viable but requires strong visibility and demographics. East Dulwich, Peckham and Brixton show it can work." />}
            {compResult === 'pass' && <VerdictBox result="pass" title="Competition: Pass" subtitle="Low direct competition — strong market position. Your best sites entered low-competition markets." />}
          </div>

          <button onClick={() => setActiveTab(2)} style={{ width: '100%', padding: '9px', marginTop: 16, fontSize: 13, fontWeight: 500, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
            Continue to visibility →
          </button>
        </div>
      )}

      {/* ── STAGE 3: VISIBILITY ── */}
      {activeTab === 2 && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Score the unit and its immediate surroundings based on your viewing.</p>
          {[
            { key: 'transport',     label: 'Visibility from transport',  hint: 'Can you see the site or a natural route to it from the station exit?' },
            { key: 'frontage',      label: 'Street frontage',            hint: 'Prominent high-street position vs. tucked away or basement' },
            { key: 'pedestrian',    label: 'Pedestrian demographic',     hint: 'Young, health-conscious, predominantly female foot traffic' },
            { key: 'street',        label: 'Street character',           hint: 'Walkable and calm vs. heavy traffic-dominated' },
            { key: 'lifestyle',     label: 'Lifestyle retail nearby',    hint: 'Independent cafés, delis, wellness — your customer already goes here' },
            { key: 'neighbourhood', label: 'Neighbourhood character',    hint: 'Organic, rooted community vs. purpose-built development' },
          ].map(item => (
            <ViewItem key={item.key} label={item.label} hint={item.hint} value={view[item.key]} onChange={val => setView(prev => ({ ...prev, [item.key]: val }))} />
          ))}

          <div style={{ marginTop: 8 }}>
            {viewResult === 'fail' && <VerdictBox result="fail" title="Visibility: Fail" subtitle="Multiple poor viewing scores. Unit conditions will significantly hamper performance regardless of neighbourhood quality." />}
            {viewResult === 'pass' && <VerdictBox result="pass" title="Visibility: Pass" subtitle="Strong unit conditions across all criteria." />}
            {viewResult === 'warn' && <VerdictBox result="warn" title="Visibility: Moderate" subtitle="Mixed viewing scores. Site needs strong demographics and low competition to compensate." />}
          </div>

          <button onClick={() => setActiveTab(3)} style={{ width: '100%', padding: '9px', marginTop: 12, fontSize: 13, fontWeight: 500, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
            View full results →
          </button>
        </div>
      )}

      {/* ── RESULTS ── */}
      {activeTab === 3 && (
        <div>
          {!result ? (
            <p style={{ fontSize: 13, color: '#aaa', padding: '8px 0' }}>Complete all three stages to see your full assessment.</p>
          ) : (
            <>
              {overall && (
                <div style={{ borderRadius: 12, padding: '16px', textAlign: 'center', marginBottom: 16, background: overall === 'pass' ? '#E1F5EE' : overall === 'warn' ? '#FAEEDA' : '#FCEBEB' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, color: overall === 'pass' ? '#085041' : overall === 'warn' ? '#633806' : '#791F1F' }}>Overall assessment</div>
                  <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 5, color: overall === 'pass' ? '#085041' : overall === 'warn' ? '#633806' : '#791F1F' }}>
                    {overall === 'pass' ? 'Strong candidate' : overall === 'warn' ? 'Proceed with caution' : 'Do not proceed'}
                  </div>
                  <div style={{ fontSize: 12, color: overall === 'pass' ? '#085041' : overall === 'warn' ? '#633806' : '#791F1F', lineHeight: 1.5 }}>
                    {overall === 'pass' && 'All three stages pass. This site profiles similarly to your best-performing locations.'}
                    {overall === 'warn' && 'Site passes minimum thresholds but has caution flags. Weigh risks carefully before committing to Heads of Terms.'}
                    {overall === 'fail' && 'One or more stages have failed. This site does not meet LevelOut\'s minimum criteria.'}
                  </div>
                </div>
              )}

              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', background: '#fafaf8' }}>
                  <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.05em' }}>{result.postcode}</div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{result.ward}{result.ward && result.borough ? ', ' : ''}{result.borough}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>LSOA {result.lsoaCode}</div>
                </div>
                {[
                  { label: 'Stage 1 — Demographics', result: demoStatus, icon: '👥' },
                  { label: 'Stage 2 — Competition',  result: compResult, icon: '🏪' },
                  { label: 'Stage 3 — Visibility',   result: viewResult, icon: '👁️' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: i < 2 ? '0.5px solid rgba(0,0,0,0.06)' : 'none', gap: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0, width: 26 }}>{row.icon}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{row.label}</span>
                    {pill(row.result || 'pending')}
                  </div>
                ))}
              </div>

              {result.data && (
                <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Census signals</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Level 4+',   val: result.data.deg,  metric: 'deg'  },
                      { label: 'Aged 25–54', val: result.data.age,  metric: 'age'  },
                      { label: 'Prof/Mgr',   val: result.data.prof, metric: 'prof' },
                      { label: 'Density',    val: result.data.dens, metric: 'dens' },
                    ].map((s, i) => {
                      const light = getLight(s.metric, s.val);
                      const dot = light ? LIGHT_CFG[light].dot : '#ccc';
                      const displayVal = s.val == null ? '—' : s.metric === 'dens' ? `${(s.val / 1000).toFixed(1)}k` : `${s.val}%`;
                      return (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 500, color: dot }}>{displayVal}</div>
                          <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{s.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p style={{ fontSize: 11, color: '#ccc', marginTop: 8, paddingTop: 8, borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                ONS Census 2021 · Nomis TS067, TS007A, TS062, TS006 · LSOA {result.lsoaCode}
              </p>
            </>
          )}
          <button onClick={handleReset} style={{ width: '100%', padding: '9px', marginTop: 12, fontSize: 13, fontWeight: 500, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
            Start new assessment
          </button>
        </div>
      )}
    </div>
  );
}
