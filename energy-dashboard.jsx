import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Zap, Droplet, Flame, Sun, ChevronRight, Home, Activity,
  ArrowUpDown, X, Gauge, Search, Wifi, WifiOff, AlertTriangle,
  Network, Pencil, Bell, PowerOff, LayoutGrid, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

/* ---------------------------------------------------------------------------
   ต้นแบบ Dashboard พลังงาน — เฟส 1
   Drill-down: สาขา → ตึก → ชั้น → โซน → ห้อง(Meter) + ตาราง Realtime + สถานะสี
   ข้อมูลจำลองให้ตรง schema meter_data_realtime (3-phase + import_kwhr + received_at)
--------------------------------------------------------------------------- */

const C = {
  ink: "#0E1726", inkSoft: "#1B2738", paper: "#EDF1F6", card: "#FFFFFF",
  line: "#D7DEE8", sub: "#5E6B7E", accent: "#0E7490", accentSoft: "#E2F1F5",
  green: "#10B981", yellow: "#F59E0B", red: "#EF4444", grey: "#94A3B8",
};

const STATUS = {
  normal:  { color: C.green,  label: "ปกติ" },
  warning: { color: C.yellow, label: "เตือน" },
  over:    { color: C.red,    label: "เกินเกณฑ์" },
  offline: { color: C.grey,   label: "ไม่มีสัญญาณ" },
};
const MODE = {
  auto:     { label: "Auto",      color: C.accent },
  manual:   { label: "กรอกมือ",   color: C.yellow },
  disabled: { label: "ปิดใช้งาน", color: C.grey },
};
const STALE_MS = 30000;

/* ---------- seeded RNG (ให้โครงสร้างคงที่ทุกครั้งที่เปิด) ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function refreshElectrical(m) {
  const pf = m._pf, v = m._v;
  const load = Math.max(0.4, m.kw_3ph * (0.975 + Math.random() * 0.05));
  m.kw_3ph = +load.toFixed(3);
  const per = load / 3;
  m.kw1 = +(per * (0.96 + Math.random() * 0.08)).toFixed(3);
  m.kw2 = +(per * (0.96 + Math.random() * 0.08)).toFixed(3);
  m.kw3 = +Math.max(0, load - m.kw1 - m.kw2).toFixed(3);
  m.pf1 = +(pf + (Math.random() - 0.5) * 0.02).toFixed(4);
  m.pf2 = +(pf + (Math.random() - 0.5) * 0.02).toFixed(4);
  m.pf3 = +(pf + (Math.random() - 0.5) * 0.02).toFixed(4);
  m.kva_3ph = +(load / pf).toFixed(3);
  m.kvar_3ph = +Math.sqrt(Math.max(0, m.kva_3ph ** 2 - load ** 2)).toFixed(3);
  m.kva1 = +(m.kva_3ph / 3).toFixed(3); m.kva2 = m.kva1; m.kva3 = m.kva1;
  m.kvar1 = +(m.kvar_3ph / 3).toFixed(3); m.kvar2 = m.kvar1; m.kvar3 = m.kvar1;
  m.vl1 = +(v + (Math.random() - 0.5) * 4).toFixed(2);
  m.vl2 = +(v + (Math.random() - 0.5) * 4).toFixed(2);
  m.vl3 = +(v + (Math.random() - 0.5) * 4).toFixed(2);
  m.vl12 = +(v * 1.732 + (Math.random() - 0.5) * 5).toFixed(2);
  m.vl23 = +(v * 1.732 + (Math.random() - 0.5) * 5).toFixed(2);
  m.vl31 = +(v * 1.732 + (Math.random() - 0.5) * 5).toFixed(2);
  m.il1 = +((m.kw1 * 1000) / (m.vl1 * m.pf1)).toFixed(3);
  m.il2 = +((m.kw2 * 1000) / (m.vl2 * m.pf2)).toFixed(3);
  m.il3 = +((m.kw3 * 1000) / (m.vl3 * m.pf3)).toFixed(3);
  m.hz = +(50 + (Math.random() - 0.5) * 0.1).toFixed(2);
}

function generateData() {
  const rnd = mulberry32(20260613);
  const ri = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const meters = [];
  let addr = 1000, ch = 0;
  const branchNames = ["สาขาสุขุมวิท", "สาขาพระราม 9", "สาขาเชียงใหม่"];
  const tree = branchNames.map((bn, bi) => {
    const buildings = [];
    for (let j = 0; j < ri(2, 3); j++) {
      const bdId = `b${bi}-bd${j}`, floors = [];
      for (let f = 1; f <= ri(2, 4); f++) {
        const fId = `${bdId}-f${f}`, zones = [];
        for (let z = 0; z < ri(2, 3); z++) {
          const zId = `${fId}-z${z}`, rooms = [];
          for (let r = 1; r <= ri(6, 38); r++) {
            const rId = `${zId}-r${r}`;
            const code = `R${f}${z + 1}${String(r).padStart(2, "0")}`;
            const threshold = 60 + rnd() * 360;
            const roll = rnd();
            const inputMode = roll < 0.05 ? "disabled" : roll < 0.17 ? "manual" : "auto";
            const disabled = inputMode === "disabled";
            const startCum = 10000 + rnd() * 90000;
            const period = rnd() * threshold * 1.25;
            const m = {
              id: rId, code, channel: `CH${String(ch++).padStart(4, "0")}`,
              site_id: bi + 1, address_id: addr++, device: `PM${2200 + ri(0, 99)}`,
              type: "3P4W", loop: Math.floor((r - 1) / 32) + 1,
              pathIds: [`b${bi}`, bdId, fId, zId],
              pathNames: [bn, `ตึก ${String.fromCharCode(65 + j)}`, `ชั้น ${f}`, `โซน ${String.fromCharCode(65 + z)}`],
              threshold, disabled, inputMode,
              periodStart_kwhr: +startCum.toFixed(3),
              import_kwhr: +(startCum + period).toFixed(3),
              _pf: 0.86 + rnd() * 0.1, _v: 228 + rnd() * 6,
              kw_3ph: 3 + rnd() * 42,
              received_at: disabled ? Date.now() - 600000
                : Date.now() - (rnd() < 0.08 ? 60000 + rnd() * 60000 : rnd() * 8000),
              device_datetime: Date.now(),
            };
            refreshElectrical(m);
            meters.push(m);
            rooms.push({ id: rId, name: code, level: "room" });
          }
          zones.push({ id: zId, name: `โซน ${String.fromCharCode(65 + z)}`, level: "zone", children: rooms });
        }
        floors.push({ id: fId, name: `ชั้น ${f}`, level: "floor", children: zones });
      }
      buildings.push({ id: bdId, name: `ตึก ${String.fromCharCode(65 + j)}`, level: "building", children: floors });
    }
    return { id: `b${bi}`, name: bn, level: "branch", children: buildings };
  });
  return { tree, meters };
}

const period = (m) => Math.max(0, m.import_kwhr - m.periodStart_kwhr);
function meterStatus(m, now) {
  if (m.disabled) return "offline";
  if (now - m.received_at > STALE_MS) return "offline";
  const p = period(m), t = m.threshold;
  if (p > t) return "over";
  if (p > t * 0.8) return "warning";
  return "normal";
}
function aggStatus(list, now) {
  let n = false, o = false;
  for (const m of list) {
    const s = meterStatus(m, now);
    if (s === "over") return "over";
    if (s === "warning") o = true;
    if (s === "normal") n = true;
  }
  return o ? "warning" : n ? "normal" : "offline";
}
const fmt = (v, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const LEVEL_LABEL = ["สาขา", "ตึก", "ชั้น", "โซน", "ห้อง (Meter)"];

/* ----------------------------- UI atoms ----------------------------- */
function StatusDot({ s, size = 10, pulse }) {
  const c = STATUS[s].color;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <span style={{ width: size, height: size, borderRadius: 99, background: c, display: "inline-block",
        boxShadow: `0 0 0 3px ${c}22` }} />
      {pulse && s !== "offline" && (
        <span style={{ position: "absolute", inset: 0, borderRadius: 99, background: c, opacity: 0.5,
          animation: "ed-ping 1.6s cubic-bezier(0,0,.2,1) infinite" }} />
      )}
    </span>
  );
}
function Readout({ label, value, unit, accent }) {
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums",
          fontSize: 20, fontWeight: 600, color: accent || C.ink }}>{value}</span>
        <span style={{ fontSize: 11, color: C.sub }}>{unit}</span>
      </div>
    </div>
  );
}

/* ----------------------------- App ----------------------------- */
export default function EnergyDashboard() {
  const dataRef = useRef(null);
  if (!dataRef.current) dataRef.current = generateData();
  const { tree, meters } = dataRef.current;

  const [path, setPath] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sortDesc, setSortDesc] = useState(true);
  const [bldgView, setBldgView] = useState("side"); // ผังด้านข้าง | Single Line
  const [, setTick] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [mode, setMode] = useState("monitor"); // monitor | compare

  useEffect(() => {
    const a = setInterval(() => {
      const now = Date.now();
      for (const m of meters) {
        if (m.disabled) continue;
        refreshElectrical(m);
        m.import_kwhr = +(m.import_kwhr + m.kw_3ph * (2 / 3600)).toFixed(3);
        m.received_at = Math.random() < 0.012 ? now - 90000 : now; // จำลองหลุดสัญญาณนานๆครั้ง
        m.device_datetime = now;
      }
      setTick((t) => t + 1);
    }, 2000);
    const b = setInterval(() => setClock(Date.now()), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [meters]);

  const now = clock;
  const metersUnder = (p) => meters.filter((m) => p.every((id, i) => m.pathIds[i] === id));

  // รายการของระดับปัจจุบัน
  let nodes = tree;
  for (const id of path) nodes = (nodes.find((n) => n.id === id)?.children) || [];
  const level = path.length; // 0..4

  const items = nodes.map((node) => {
    if (node.level === "room") {
      const m = meters.find((x) => x.id === node.id);
      return { node, kwh: period(m), status: meterStatus(m, now), count: 1, m };
    }
    const sub = metersUnder([...path, node.id]);
    return { node, kwh: sub.reduce((s, m) => s + period(m), 0), status: aggStatus(sub, now), count: sub.length };
  });
  const sorted = [...items].sort((a, b) => (sortDesc ? b.kwh - a.kwh : a.kwh - b.kwh));

  // ระดับชั้น: เรียงแบบผังด้านข้างอาคาร (ชั้นสูงอยู่บน → ชั้น 1 อยู่ล่าง)
  const fnum = (n) => parseInt((String(n).match(/\d+/) || [0])[0], 10);
  const floorView = level === 2;
  const floorItems = floorView ? [...items].sort((a, b) => fnum(b.node.name) - fnum(a.node.name)) : [];
  const maxFloorKwh = floorView ? Math.max(1, ...items.map((i) => i.kwh)) : 1;
  const currentName = (() => { let n = tree, node; for (let k = 0; k < path.length; k++) { node = n.find((x) => x.id === path[k]); n = node?.children || []; } return node?.name; })();

  // ระดับห้อง: จัดกลุ่มตาม Loop (สูงสุด 32 meter/loop)
  const loopGroups = level === 4
    ? Object.values(items.reduce((a, it) => { const L = it.m.loop; (a[L] = a[L] || { loop: L, items: [] }).items.push(it); return a; }, {}))
        .sort((a, b) => a.loop - b.loop)
    : [];
  // ระดับโซน: เรียงตามชื่อ (A,B,C,D) เพื่อวางเป็นผังพื้นที่
  const zoneItems = level === 3 ? [...items].sort((a, b) => a.node.name.localeCompare(b.node.name, "th")) : [];

  const renderCard = (it) => {
    const st = STATUS[it.status];
    const over = it.node.level === "room" && it.m && period(it.m) > it.m.threshold;
    return (
      <button key={it.node.id} onClick={() => openItem(it)} style={{
        textAlign: "left", background: C.card, border: `1px solid ${C.line}`,
        borderLeft: `4px solid ${st.color}`, borderRadius: 12, padding: 13, cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{it.node.name}</span>
          <StatusDot s={it.status} pulse />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 9 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums",
            fontSize: 21, fontWeight: 700 }}>{fmt(it.kwh)}</span>
          <span style={{ fontSize: 11, color: C.sub }}>kWh</span>
        </div>
        <div style={{ marginTop: 7, fontSize: 11, color: C.sub, display: "flex", justifyContent: "space-between" }}>
          <span>{it.node.level === "room" ? `${it.m.device} · Loop ${it.m.loop}` : `${it.count} meter`}</span>
          {over && <span style={{ color: C.red, display: "flex", alignItems: "center", gap: 3 }}>
            <AlertTriangle size={11} /> {fmt((period(it.m) / it.m.threshold) * 100)}%</span>}
        </div>
      </button>
    );
  };

  // นับสถานะรวมของระดับปัจจุบัน (สำหรับแถบสรุป)
  const scope = metersUnder(path);
  const counts = scope.reduce((acc, m) => { acc[meterStatus(m, now)]++; return acc; },
    { normal: 0, warning: 0, over: 0, offline: 0 });
  const totalKwh = scope.reduce((s, m) => s + period(m), 0);

  const go = (id) => { setPath([...path, id]); setSelected(null); };
  const jump = (i) => { setPath(path.slice(0, i)); setSelected(null); };
  const openItem = (it) => { it.node.level === "room" ? setSelected(it.m) : go(it.node.id); };

  return (
    <div style={{ fontFamily: "'Noto Sans Thai', system-ui, sans-serif", background: C.paper,
      minHeight: 640, color: C.ink }}>
      <style>{`@keyframes ed-ping{75%,100%{transform:scale(2.2);opacity:0}}`}</style>

      {/* Top bar */}
      <div style={{ background: C.ink, color: "#fff", padding: "12px 18px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent,
            display: "grid", placeItems: "center" }}><Gauge size={17} /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1 }}>Energy Monitor</div>
            <div style={{ fontSize: 10.5, color: "#9FB0C4" }}>ระบบติดตามการใช้พลังงาน · ต้นแบบ</div>
          </div>
        </div>

        {/* Main mode */}
        <div style={{ display: "flex", gap: 4, background: "#1B2738", padding: 3, borderRadius: 9 }}>
          {[["monitor", "ติดตาม Realtime", Activity], ["compare", "เปรียบเทียบ", BarChart3]].map(([k, lb, Ic]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, padding: "6px 12px", borderRadius: 7,
              border: "none", cursor: "pointer", fontWeight: mode === k ? 600 : 400,
              background: mode === k ? C.accent : "transparent", color: mode === k ? "#fff" : "#9FB0C4" }}>
              <Ic size={14} /> {lb}
            </button>
          ))}
        </div>

        {/* Sensor selector */}
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {[
            { k: "e", icon: Zap, label: "ไฟฟ้า", on: true },
            { k: "w", icon: Droplet, label: "น้ำ" },
            { k: "g", icon: Flame, label: "แก๊ส" },
            { k: "s", icon: Sun, label: "Solar" },
          ].map((t) => {
            const Ico = t.icon;
            return (
              <div key={t.k} title={t.on ? "" : "เร็วๆ นี้"} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8,
                fontSize: 12.5, cursor: t.on ? "default" : "not-allowed",
                background: t.on ? C.accent : "transparent",
                color: t.on ? "#fff" : "#6E7E92", border: t.on ? "none" : "1px solid #2B3A4F" }}>
                <Ico size={14} /> {t.label}
              </div>
            );
          })}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#A7E8D0" }}>
            <Activity size={14} /> Live
            <StatusDot s="normal" size={8} pulse />
          </div>
          <span style={{ fontFamily: "ui-monospace, monospace", color: "#C7D3E1" }}>
            {new Date(now).toLocaleTimeString("th-TH")}
          </span>
        </div>
      </div>

      {mode === "monitor" ? (<React.Fragment>
      {/* Breadcrumb */}
      <div style={{ padding: "11px 18px", display: "flex", alignItems: "center", gap: 6,
        flexWrap: "wrap", background: C.card, borderBottom: `1px solid ${C.line}` }}>
        <button onClick={() => jump(0)} style={crumb(path.length === 0)}>
          <Home size={13} /> ทุกสาขา
        </button>
        {path.map((id, i) => {
          let n = tree, node;
          for (let k = 0; k <= i; k++) { node = n.find((x) => x.id === path[k]); n = node?.children || []; }
          return (
            <React.Fragment key={id}>
              <ChevronRight size={13} color={C.sub} />
              <button onClick={() => jump(i + 1)} style={crumb(i === path.length - 1)}>{node?.name}</button>
            </React.Fragment>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.sub }}>
          กำลังดูระดับ: <b style={{ color: C.ink }}>{LEVEL_LABEL[level]}</b>
        </span>
      </div>

      {/* Summary strip */}
      <div style={{ padding: "12px 18px", display: "flex", gap: 10, flexWrap: "wrap",
        background: C.card, borderBottom: `1px solid ${C.line}` }}>
        <div style={kpi()}>
          <div style={{ fontSize: 11, color: C.sub }}>พลังงานรวม (งวดนี้)</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums",
              fontSize: 22, fontWeight: 700, color: C.accent }}>{fmt(totalKwh)}</span>
            <span style={{ fontSize: 12, color: C.sub }}>kWh</span>
          </div>
        </div>
        {["normal", "warning", "over", "offline"].map((s) => (
          <div key={s} style={{ ...kpi(), display: "flex", alignItems: "center", gap: 10 }}>
            <StatusDot s={s} size={12} />
            <div>
              <div style={{ fontSize: 11, color: C.sub }}>{STATUS[s].label}</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 700 }}>{counts[s]}</div>
            </div>
          </div>
        ))}
        <div style={{ ...kpi(), display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accentSoft,
            display: "grid", placeItems: "center", color: C.accent }}><Search size={15} /></div>
          <div>
            <div style={{ fontSize: 11, color: C.sub }}>จำนวน Meter</div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 700 }}>{scope.length}</div>
          </div>
        </div>
      </div>

      {/* Body: cards + realtime table */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)",
        gap: 14, padding: 18 }}>
        {/* Left panel: มุมมองตามระดับ */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12.5, color: C.sub }}>
              {level === 2 ? (bldgView === "sld" ? `Single Line Diagram · ${currentName}` : `ผังด้านข้างอาคาร · ${currentName} · เรียงตามชั้น (บน → ล่าง)`)
                : level === 3 ? `ผังพื้นที่ตามโซน · ${currentName}`
                : level === 4 ? `ห้อง / Meter จัดตาม Loop · ${currentName}`
                : `${LEVEL_LABEL[level]} · เรียงจากใช้มากไปน้อย`}
            </div>
            {level === 2 && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 3, background: C.paper, padding: 3, borderRadius: 9, border: `1px solid ${C.line}` }}>
                {[["side", "ผังอาคาร", LayoutGrid], ["sld", "Single Line", Network]].map(([k, lb, Ic]) => (
                  <button key={k} onClick={() => setBldgView(k)} style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, padding: "5px 9px", borderRadius: 7, border: "none",
                    cursor: "pointer", background: bldgView === k ? C.card : "transparent", color: bldgView === k ? C.accent : C.sub,
                    fontWeight: bldgView === k ? 600 : 400 }}>
                    <Ic size={13} /> {lb}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(counts.over > 0 || counts.offline > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: 10, padding: "9px 12px", marginBottom: 11 }}>
              <Bell size={15} color={C.red} />
              <span style={{ fontSize: 12.5, color: "#991B1B" }}>
                จุดแจ้งเตือน · <b>{counts.over}</b> เกินเกณฑ์ · <b>{counts.offline}</b> ไม่มีสัญญาณ/ปิดใช้งาน
              </span>
            </div>
          )}

          {level === 2 ? (
            bldgView === "sld" ? (
              <SingleLine main={{ name: currentName, kwh: totalKwh, status: aggStatus(scope, now) }}
                feeders={[...items].sort((a, b) => fnum(a.node.name) - fnum(b.node.name))} onPick={go} />
            ) : (
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
                <div style={{ height: 14, background: `repeating-linear-gradient(90deg, ${C.ink}, ${C.ink} 11px, ${C.inkSoft} 11px, ${C.inkSoft} 22px)` }} />
                {floorItems.map((it, idx) => {
                  const st = STATUS[it.status];
                  return (
                    <button key={it.node.id} onClick={() => openItem(it)} style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                      background: C.card, border: "none", borderTop: idx === 0 ? "none" : `1px solid ${C.line}`,
                      borderLeft: `5px solid ${st.color}`, padding: "13px 14px", cursor: "pointer" }}>
                      <div style={{ width: 56, fontWeight: 600, fontSize: 13 }}>{it.node.name}</div>
                      <div style={{ flex: 1, height: 24, background: C.paper, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                        <div style={{ width: `${(it.kwh / maxFloorKwh) * 100}%`, height: "100%", background: st.color, opacity: 0.28 }} />
                        <span style={{ position: "absolute", left: 9, top: 0, lineHeight: "24px", fontSize: 11, color: C.sub }}>{it.count} meter</span>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 92 }}>
                        <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums", fontSize: 16, fontWeight: 700 }}>{fmt(it.kwh)}</span>
                        <span style={{ fontSize: 11, color: C.sub }}> kWh</span>
                      </div>
                      <StatusDot s={it.status} pulse />
                    </button>
                  );
                })}
                <div style={{ height: 12, background: C.inkSoft }} />
              </div>
            )
          ) : level === 3 ? (
            <ZonePlan items={zoneItems} onPick={openItem} />
          ) : level === 4 ? (
            <LoopGrid groups={loopGroups} onPick={(m) => setSelected(m)} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 11 }}>
              {sorted.map(renderCard)}
            </div>
          )}
        </div>

        {/* Realtime table */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "11px 13px", borderBottom: `1px solid ${C.line}`,
            display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={15} color={C.accent} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>ตาราง Realtime</span>
            <button onClick={() => setSortDesc((v) => !v)} style={{ marginLeft: "auto", fontSize: 11.5,
              color: C.accent, background: C.accentSoft, border: "none", borderRadius: 7,
              padding: "5px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowUpDown size={12} /> kWh {sortDesc ? "มาก→น้อย" : "น้อย→มาก"}
            </button>
          </div>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: C.paper, color: C.sub, textAlign: "left" }}>
                  <th style={th()}>No.</th>
                  <th style={th()}>{level === 4 ? "Meter / รหัส" : LEVEL_LABEL[level]}</th>
                  <th style={{ ...th(), textAlign: "right" }}>kWh</th>
                  <th style={{ ...th(), textAlign: "center" }}>STS</th>
                  <th style={{ ...th(), textAlign: "right" }}>อัปเดต</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((it, i) => {
                  const ago = it.m ? Math.round((now - it.m.received_at) / 1000) : null;
                  return (
                    <tr key={it.node.id} onClick={() => openItem(it)}
                      style={{ borderTop: `1px solid ${C.line}`, cursor: "pointer" }}>
                      <td style={{ ...td(), color: C.sub, fontFamily: "ui-monospace, monospace" }}>{i + 1}</td>
                      <td style={td()}>{it.node.name}
                        {it.node.level === "room" && <span style={{ color: C.sub }}> · {it.m.channel}</span>}</td>
                      <td style={{ ...td(), textAlign: "right", fontFamily: "ui-monospace, monospace",
                        fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(it.kwh)}</td>
                      <td style={{ ...td(), textAlign: "center" }}>
                        <span style={{ display: "inline-flex" }}><StatusDot s={it.status} /></span></td>
                      <td style={{ ...td(), textAlign: "right", color: C.sub, fontSize: 11 }}>
                        {ago === null ? "—" : ago > 30 ? `${ago}s ⚠` : `${ago}s`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </React.Fragment>) : (
        <Compare meters={meters} tree={tree} now={now} />
      )}

      {/* Meter detail */}
      {selected && <MeterDetail m={selected} now={now} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ----------------------------- Meter detail panel ----------------------------- */
function MeterDetail({ m, now, onClose }) {
  const s = meterStatus(m, now), st = STATUS[s];
  const ago = Math.round((now - m.received_at) / 1000);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0E172699",
      display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 16,
        width: "min(680px,100%)", maxHeight: "90vh", overflow: "auto", border: `1px solid ${C.line}` }}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${C.line}`,
          display: "flex", alignItems: "center", gap: 11 }}>
          <StatusDot s={s} size={14} pulse />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{m.code}
              <span style={{ fontSize: 12, color: C.sub, fontWeight: 400 }}> · {m.device}</span></div>
            <div style={{ fontSize: 11.5, color: C.sub }}>{m.pathNames.join("  ›  ")}</div>
          </div>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
            color: MODE[m.inputMode].color, background: `${MODE[m.inputMode].color}1F`, borderRadius: 7, padding: "4px 8px" }}>
            {m.inputMode === "manual" ? <Pencil size={11} /> : m.inputMode === "disabled" ? <PowerOff size={11} /> : <Zap size={11} />}
            {MODE[m.inputMode].label}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5,
            color: st.color, fontSize: 12.5, fontWeight: 600 }}>
            {s === "offline" ? <WifiOff size={14} /> : <Wifi size={14} />} {st.label}
          </span>
          <button onClick={onClose} style={{ background: C.paper, border: "none", borderRadius: 8,
            width: 30, height: 30, cursor: "pointer", display: "grid", placeItems: "center" }}><X size={16} /></button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180, background: C.ink, color: "#fff", borderRadius: 12, padding: 15 }}>
              <div style={{ fontSize: 11.5, color: "#9FB0C4" }}>พลังงานสะสม (import_kwhr)</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums",
                fontSize: 26, fontWeight: 700 }}>{fmt(m.import_kwhr, 1)} <span style={{ fontSize: 13 }}>kWh</span></div>
              <div style={{ fontSize: 11.5, color: "#9FB0C4", marginTop: 6 }}>
                ใช้งวดนี้ <b style={{ color: "#7DE3BD" }}>{fmt(period(m), 1)} kWh</b> / เกณฑ์ {fmt(m.threshold)} kWh</div>
            </div>
            <div style={{ flex: 1, minWidth: 180, background: C.accentSoft, borderRadius: 12, padding: 15 }}>
              <div style={{ fontSize: 11.5, color: C.accent }}>กำลังไฟรวม (kw_3ph)</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums",
                fontSize: 26, fontWeight: 700, color: C.ink }}>{fmt(m.kw_3ph, 2)} <span style={{ fontSize: 13 }}>kW</span></div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6 }}>
                kVA {fmt(m.kva_3ph, 1)} · kVAR {fmt(m.kvar_3ph, 1)} · {ago}s ที่แล้ว</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>ค่าวัดแบบ 3 เฟส</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 9 }}>
            <Readout label="V L-N (1/2/3)" value={`${fmt(m.vl1)}/${fmt(m.vl2)}/${fmt(m.vl3)}`} unit="V" />
            <Readout label="V L-L (12/23/31)" value={`${fmt(m.vl12)}/${fmt(m.vl23)}/${fmt(m.vl31)}`} unit="V" />
            <Readout label="I L1/L2/L3" value={`${fmt(m.il1, 1)}/${fmt(m.il2, 1)}/${fmt(m.il3, 1)}`} unit="A" />
            <Readout label="kW L1/L2/L3" value={`${fmt(m.kw1, 1)}/${fmt(m.kw2, 1)}/${fmt(m.kw3, 1)}`} unit="kW" />
            <Readout label="PF L1/L2/L3" value={`${m.pf1.toFixed(2)}/${m.pf2.toFixed(2)}/${m.pf3.toFixed(2)}`} unit="" accent={C.accent} />
            <Readout label="ความถี่" value={fmt(m.hz, 2)} unit="Hz" />
          </div>

          <div style={{ marginTop: 16, fontSize: 11.5, color: C.sub, lineHeight: 1.7,
            background: C.paper, borderRadius: 10, padding: "10px 13px" }}>
            <b style={{ color: C.ink }}>ที่มาข้อมูล:</b> site_id={m.site_id} · address_id={m.address_id} ·
            channel={m.channel} · type={m.type} ·
            device_datetime={new Date(m.device_datetime).toLocaleTimeString("th-TH")} ·
            received_at={new Date(m.received_at).toLocaleTimeString("th-TH")}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Compare / Analytics (3.1–3.3) ----------------------------- */
const PALETTE = ["#0E7490", "#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#CA8A04", "#16A34A", "#0891B2"];

function Compare({ meters, tree, now }) {
  const [dim, setDim] = useState("overview");   // overview | branch | building | mdb
  const [gran, setGran] = useState("year");     // year | month | week | day
  const [billing, setBilling] = useState(false);

  const entities = useMemo(() => {
    if (dim === "building" || dim === "mdb") {
      const list = [];
      tree.forEach((b) => b.children.forEach((bd) => {
        const w = meters.filter((m) => m.pathIds[1] === bd.id).reduce((s, m) => s + period(m), 0);
        const short = b.name.replace("สาขา", "");
        list.push({ id: bd.id, name: `${dim === "mdb" ? "MDB " : ""}${short}·${bd.name}`, weight: w });
      }));
      return list;
    }
    return tree.map((b) => ({
      id: b.id, name: b.name.replace("สาขา", ""),
      weight: meters.filter((m) => m.pathIds[0] === b.id).reduce((s, m) => s + period(m), 0),
    }));
  }, [dim, tree, meters]);

  const buckets = useMemo(() => {
    if (gran === "year") return ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    if (gran === "month") return Array.from({ length: 30 }, (_, i) => String(i + 1));
    if (gran === "week") return ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  }, [gran]);

  const seasonal = [0.9, 0.92, 1.0, 1.15, 1.2, 1.12, 1.06, 1.05, 1.0, 0.98, 0.93, 1.0];
  const loadCurve = [.35, .3, .28, .28, .32, .45, .6, .8, .95, 1, 1.05, 1.08, 1.05, 1, 1.02, 1.05, 1.1, 1.15, 1.12, 1, .85, .7, .55, .45];
  const hashf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };

  const data = useMemo(() => buckets.map((lb, bi) => {
    const row = { label: lb };
    entities.forEach((e) => {
      let v;
      if (gran === "year") v = e.weight * seasonal[bi];
      else if (gran === "month") v = (e.weight / 30) * (0.7 + hashf(e.id + "m" + bi) * 0.7);
      else if (gran === "week") v = (e.weight / 30) * (0.7 + hashf(e.id + "w" + bi) * 0.7);
      else v = (e.weight / 720) * loadCurve[bi] * (0.85 + hashf(e.id + "h" + bi) * 0.3);
      row[e.name] = +v.toFixed(1);
    });
    return row;
  }), [buckets, entities, gran]);

  const totals = entities.map((e) => ({ name: e.name, value: +data.reduce((s, r) => s + (r[e.name] || 0), 0).toFixed(1) }))
    .sort((a, b) => b.value - a.value);
  const grand = totals.reduce((s, t) => s + t.value, 0) || 1;
  const colorOf = {}; entities.forEach((e, i) => (colorOf[e.name] = PALETTE[i % PALETTE.length]));

  const yr = 2569;
  const windowText = gran === "year"
    ? `รอบปี ${yr - 1} · ค่ามิเตอร์ 00:00 น. 1 ม.ค. ${yr} − 00:00 น. 1 ม.ค. ${yr - 1}`
    : gran === "month"
    ? (billing ? `รอบบิล (ตัดวันที่ 20) · 00:00 น. 20 ธ.ค. ${yr - 1} − 00:00 น. 20 ม.ค. ${yr}` : `รอบปฏิทิน · 1 ม.ค. − 31 ม.ค. ${yr}`)
    : gran === "week" ? "สัปดาห์ล่าสุด · จันทร์ − อาทิตย์" : "วันล่าสุด · 00:00 − 24:00 น. (รายชั่วโมง)";

  const DIMS = [["overview", "ภาพรวม"], ["branch", "ตามสาขา"], ["building", "ตามตึก"], ["mdb", "ตาม MDB"]];
  const GRANS = [["year", "รายปี"], ["month", "รายเดือน"], ["week", "รายสัปดาห์"], ["day", "รายวัน"]];
  const tabStyle = (a) => ({ fontSize: 12.5, padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: a ? 600 : 400, background: a ? C.accent : C.card, color: a ? "#fff" : C.sub, boxShadow: a ? "none" : `inset 0 0 0 1px ${C.line}` });

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 5 }}>เปรียบเทียบตาม</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DIMS.map(([k, lb]) => <button key={k} onClick={() => setDim(k)} style={tabStyle(dim === k)}>{lb}</button>)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 5 }}>ช่วงเวลา (รูปแบบ)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GRANS.map(([k, lb]) => <button key={k} onClick={() => setGran(k)} style={tabStyle(gran === k)}>{lb}</button>)}
          </div>
        </div>
        {gran === "month" && (
          <div>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 5 }}>การตัดรอบ</div>
            <button onClick={() => setBilling((v) => !v)} style={tabStyle(billing)}>
              {billing ? "รอบบิล 20→20" : "รอบปฏิทิน"}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.accentSoft, color: C.accent,
        borderRadius: 9, padding: "8px 13px", fontSize: 12, marginBottom: 14 }}>
        <Gauge size={14} /> ช่วงข้อมูล: {windowText}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 14 }}>
        {/* Stacked bar */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 12px 8px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, paddingLeft: 6 }}>
            พลังงาน (kWh) {gran === "year" ? "รายเดือน" : gran === "month" ? "รายวัน" : gran === "week" ? "รายวัน" : "รายชั่วโมง"} · แยกตาม{DIMS.find((d) => d[0] === dim)[1].replace("ตาม", "").replace("ภาพรวม", "สาขา")}
          </div>
          <div style={{ height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.sub }} interval={gran === "month" ? 2 : 0} />
                <YAxis tick={{ fontSize: 11, fill: C.sub }} width={48} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }}
                  formatter={(v) => [`${fmt(v)} kWh`, ""]} />
                <Legend wrapperStyle={{ fontSize: 11.5 }} />
                {entities.map((e, i) => (
                  <Bar key={e.id} dataKey={e.name} stackId="a" fill={PALETTE[i % PALETTE.length]}
                    radius={i === entities.length - 1 ? [3, 3, 0, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie + share */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>สัดส่วนการใช้ (%)</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={totals} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {totals.map((t) => <Cell key={t.name} fill={colorOf[t.name]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${fmt(v)} kWh`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {totals.map((t) => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: colorOf[t.name] }} />
                <span style={{ flex: 1 }}>{t.name}</span>
                <span style={{ fontFamily: "ui-monospace, monospace", color: C.sub }}>{fmt(t.value)}</span>
                <b style={{ fontFamily: "ui-monospace, monospace", minWidth: 42, textAlign: "right" }}>
                  {((t.value / grand) * 100).toFixed(1)}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Zone floor-plan (2.2) ----------------------------- */
function ZonePlan({ items, onPick }) {
  return (
    <div style={{ border: `2px solid ${C.ink}`, borderRadius: 12, background: C.card, padding: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {items.map((it) => {
          const st = STATUS[it.status];
          return (
            <button key={it.node.id} onClick={() => onPick(it)} style={{
              textAlign: "left", cursor: "pointer", border: `1px solid ${C.line}`, borderRadius: 8,
              background: `${st.color}10`, padding: 16, minHeight: 110, display: "flex", flexDirection: "column",
              borderLeft: `5px solid ${st.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <StatusDot s={it.status} pulse />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{it.node.name}</span>
              </div>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums",
                  fontSize: 24, fontWeight: 700 }}>{fmt(it.kwh)}</span>
                <span style={{ fontSize: 12, color: C.sub }}>kWh</span>
              </div>
              <div style={{ fontSize: 11, color: C.sub }}>{it.count} meter</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------- Loop / room grid (2.3) ----------------------------- */
function LoopGrid({ groups, onPick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g) => (
        <div key={g.loop} style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.card, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13, background: C.ink, color: "#fff", borderRadius: 7, padding: "3px 10px" }}>Loop {g.loop}</span>
            <span style={{ fontSize: 11.5, color: C.sub }}>{g.items.length} / 32 meter</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(78px,1fr))", gap: 8 }}>
            {g.items.map((it) => {
              const st = STATUS[it.status], md = MODE[it.m.inputMode];
              const dim = it.m.inputMode === "disabled";
              return (
                <button key={it.node.id} onClick={() => onPick(it.m)} title={`${it.node.name} · ${md.label}`} style={{
                  cursor: "pointer", border: `1px solid ${C.line}`, borderRadius: 9, padding: "9px 6px 7px",
                  background: dim ? C.paper : C.card, opacity: dim ? 0.7 : 1, display: "flex",
                  flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
                  {it.m.inputMode === "manual" && (
                    <span style={{ position: "absolute", top: 4, right: 4, color: C.yellow }}><Pencil size={10} /></span>)}
                  <span style={{ width: 18, height: 18, borderRadius: 99, background: st.color,
                    boxShadow: `0 0 0 3px ${st.color}22` }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600 }}>{it.node.name}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.sub }}>
                    {dim ? "—" : `${fmt(it.kwh)} kWh`}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Single Line Diagram (2.4) ----------------------------- */
function SingleLine({ main, feeders, onPick }) {
  const ms = STATUS[main.status];
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.card, padding: "22px 16px 26px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Main */}
        <div style={{ border: `2px solid ${ms.color}`, borderRadius: 10, padding: "10px 18px", minWidth: 160, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <StatusDot s={main.status} /><span style={{ fontWeight: 700, fontSize: 13 }}>Main · {main.name}</span>
          </div>
          <div style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums", fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            {fmt(main.kwh)} <span style={{ fontSize: 11, color: C.sub }}>kWh</span></div>
        </div>
        {/* bus */}
        <div style={{ width: 2, height: 20, background: C.ink }} />
        <div style={{ height: 2, background: C.ink, width: `${Math.min(100, feeders.length * 22)}%`, maxWidth: "100%" }} />
        {/* feeders */}
        <div style={{ display: "flex", gap: 12, marginTop: 0, flexWrap: "wrap", justifyContent: "center" }}>
          {feeders.map((f, i) => {
            const st = STATUS[f.status];
            return (
              <div key={f.node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 2, height: 18, background: C.ink }} />
                <button onClick={() => onPick(f.node.id)} style={{
                  cursor: "pointer", border: `1px solid ${C.line}`, borderLeft: `4px solid ${st.color}`,
                  borderRadius: 9, padding: "9px 11px", background: C.card, textAlign: "center", minWidth: 96 }}>
                  <div style={{ fontSize: 10.5, color: C.sub }}>F{i + 1}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <StatusDot s={f.status} size={8} /><span style={{ fontWeight: 600, fontSize: 12 }}>{f.node.name}</span>
                  </div>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700 }}>
                    {fmt(f.kwh)} <span style={{ fontSize: 10, color: C.sub }}>kWh</span></div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- style helpers ----------------------------- */
const crumb = (active) => ({
  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8,
  border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: active ? 600 : 400,
  background: active ? C.accentSoft : "transparent", color: active ? C.accent : C.sub,
});
const kpi = () => ({ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 11, padding: "9px 14px", minWidth: 120 });
const th = () => ({ padding: "9px 11px", fontWeight: 600, fontSize: 11.5 });
const td = () => ({ padding: "9px 11px" });
