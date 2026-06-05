import { COLORS, SYSTEMS, USE_CASES, CONNECTOR_LABELS, ConnectorType } from "../engine/spec";
import { TEMPLATES } from "../engine/templates";
import { buildGraph, hexVertices } from "../engine/geometry";

const APP = "#/app";

const TEMPLATE_BLURB: Record<string, string> = {
  h14: "~4×5 m · the most popular cluster size",
  h8: "~3×5 m · a popular single-car garage starter",
  h5: "Compact cluster — workbench or single station",
  dual: "Two independent clusters — switch each zone",
  h13border: "Honeycomb with a frame — premium studio finish",
  h23: "~6×6 m · wall-to-wall for a two-car garage",
};

const COMPONENTS: [string, string, string][] = [
  ["Multiple bar lengths", "440 · 565 · 1176 mm", "Pick the bar length that fits your space. Short bars for tight clusters, long bars for spanning walls. Hexlight counts the exact quantity of each length you need."],
  ["Many connector types", "I · L · V · Y · T · X", "Real hex systems use six connector shapes depending on the angle and number of bars meeting at a node. Hexlight determines which connector each junction needs and adds the exact count."],
  ["Power & cables", "Sized automatically", "Hexlight calculates total power draw and how many inputs are required. Each cord feeds a limited chain — it splits your design optimally so you never overload a run."],
];

const LIGHT_FEATURES: [string, string][] = [
  ["Live lux estimate", "Updates every time you add or remove a hex. Rounded to the nearest 10 lux, with a ±20% advisory label."],
  ["Use-case targets built in", "Garage 300 · Workshop 500 · Detailing 750 · Gym 400 · Salon 500 · Living 200 lx. Based on EN 12464-1."],
  ["Ceiling height & mounting", "Flush, suspended, or auto-calculated drop for optimal spread across your layout."],
];

const USE_CASE_CARDS: [string, string, string][] = [
  ["Garages & workshops", "Single-car, two-car, mancaves, hobbyist benches. Even, shadow-free coverage at 300–500 lx.", "Single-car · Two-car · Workbench"],
  ["Barber shops & salons", "Hex clusters above each chair give bright, colour-accurate light clients photograph. 500 lx per chair.", "Per-chair · Reception · Backbar"],
  ["Detailing & auto studios", "Paint, ceramic and finishing work needs even light with no hot spots. 750 lx for colour-accurate finishing.", "Detail bay · Paint booth · Showroom"],
  ["Home gyms & studios", "A hex cluster over the rack looks great in workout videos. 400 lx floor target — most use 5–8 hexes.", "Squat rack · Yoga · Reels"],
  ["Streamer & content rooms", "Wall-mounted hex frames behind the desk read well on stream. Lines mode draws custom shapes.", "Stream wall · Backdrop · Office"],
  ["Living rooms & features", "Statement ceilings over an island, dining table or hallway. 200 lx residential ambient.", "Kitchen · Hallway · Feature wall"],
];

const FAQ: [string, string][] = [
  ["How do I plan a hexagon LED lighting system?", "Open Hexlight in any browser — no install or account. Click to place hexagonal panels on the grid, choose your bar length (440, 565 or 1176 mm), and the tool determines every connector type and builds a complete bill of materials with quantities."],
  ["How many connectors do I need?", "It depends on layout geometry. Hex systems use six connector types: I (straight-through), L (right-angle), V (angled two-way), Y (three-way branch), T (power tap), and X (four-way cross). Hexlight detects each junction automatically and adds the exact count."],
  ["440 mm vs 565 mm vs 1176 mm?", "These are bar segment lengths. 440 mm makes smaller hexagons — good for compact clusters. 565 mm creates larger hexagons with more coverage. 1176 mm is used for straight line runs spanning larger distances. Hexlight supports all three and mixes them in one layout."],
  ["How many power inputs do I need?", "Each connected run of bars needs at least one power input. A single input supplies up to 420 W — a run exceeding that requires a second, and so on. Hexlight calculates the recommended inputs per connected island automatically."],
  ["How much power does a hex system consume?", "What matters is wall (AC) draw. Typical per segment: 6 W LED-side for 440 mm, 8 W for 565 mm, 16 W for 1176 mm, at ≈110 lm/W and ≈86% driver efficiency. Hexlight computes total wall consumption live as you design — and the Bar configuration panel lets you tune every figure."],
  ["How does Hexlight estimate brightness?", "The lumen method (same basis as EN 12464-1): total lumens × Coefficient of Utilisation (from room geometry & ceiling height) × 0.80 maintenance factor ÷ floor area. The result is a ±20% estimate — not a photometric simulation, but accurate enough to confirm a layout is in the right ballpark before ordering."],
  ["Can I export my design as a PDF?", "Yes. Use Export PDF for a print-ready document with the full bill of materials — segments by length, each connector type, power supply count and total wattage. Useful for placing a supplier order or sharing with an installer."],
  ["Does Hexlight cost anything?", "No. It runs entirely in your browser with no account, no download, and no payment required at any point."],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="lnav">
        <a className="brand" href="#/"><HexMark /> <span>HEXLIGHT</span></a>
        <div className="lnav-right">
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
          <a className="cta-sm" href={APP}>Open app →</a>
        </div>
      </nav>

      <header className="hero">
        <HeroHexGrid />
        <div className="hero-text">
          <span className="kicker">Hexagonal LED layout planner</span>
          <h1>Hex lights, planned for <em>your space</em>.</h1>
          <p>
            Hexlight is a browser tool for designing hexagonal LED lighting systems. Place hexes on a grid,
            verify floor-level illuminance against EN&nbsp;12464-1 targets, and get a complete bill of materials —
            bars, connectors and power inputs — all calculated live.
          </p>
          <div className="hero-cta">
            <a className="cta" href={APP}>Plan my layout →</a>
            <a className="cta ghost" href="#templates">See example layouts</a>
          </div>
          <div className="hero-trust">NO ACCOUNT · NO DOWNLOAD · NO COST</div>
        </div>
        <div className="hero-art">
          <div className="hero-art-glow" />
          <TemplatePreview docId="h14" big />
        </div>
      </header>

      {/* How it works */}
      <section className="sec" id="how">
        <h2 className="sec-h">From idea to install-ready design in minutes</h2>
        <div className="steps">
          {[
            ["01", "Open the app", "Runs entirely in your browser — no install, no account. Open and go."],
            ["02", "Plan your layout", "Build your pattern on the grid — hex panels and line segments snap into place. Connectors and bar counts update live."],
            ["03", "Verify your design", "Check the brightness estimate against your use-case target, review the bill of materials, then order knowing you have the right parts."],
          ].map(([n, t, d]) => (
            <div className="step" key={n}>
              <span className="step-n">{n}</span>
              <h4>{t}</h4>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Templates */}
      <section className="sec" id="templates">
        <h2 className="sec-h">Start from a proven layout</h2>
        <div className="tgallery">
          {TEMPLATES.map((t) => (
            <a className={`tg-card ${t.featured ? "tg-feat" : ""}`} key={t.id} href={APP}>
              {t.featured && <span className="tg-badge">MOST-BUILT LAYOUT</span>}
              <div className="tg-prev"><TemplatePreview docId={t.id} big={t.featured} /></div>
              <div className="tg-meta">
                <span className="tg-kicker">{t.name.toUpperCase()}</span>
                <span className="tg-name">{t.name}</span>
                <span className="tg-blurb">{TEMPLATE_BLURB[t.id]}</span>
              </div>
            </a>
          ))}
        </div>
        <p className="sec-foot">Different shape in mind? <a href={APP}>Start blank — open the planner →</a></p>
      </section>

      {/* Components */}
      <section className="sec">
        <h2 className="sec-h">Every part your system needs, counted automatically</h2>
        <p className="sec-sub">A hex lighting system is built from bars, connectors and power inputs. Hexlight tracks all three as you design — no spreadsheet, no guesswork.</p>
        <div className="cards3">
          {COMPONENTS.map(([t, big, d]) => (
            <div className="card" key={t}>
              <div className="card-tag">{t}</div>
              <div className="card-big">{big}</div>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BOM */}
      <section className="sec split">
        <div className="split-text">
          <h2 className="sec-h">Your shopping list, generated automatically</h2>
          <p>Every time you add or remove a hex, Hexlight recalculates the full parts list in real time — segments by length, connectors by type, and power supply count.</p>
          <p>When you're ready, export the design as a PDF — layout diagram, parts list, installation size and total wattage on one page. Hand it to your supplier or save it for the installer.</p>
        </div>
        <div className="bom-card">
          <div className="bom-card-title">Layout summary</div>
          <BomRow sub="Segments" />
          <BomRow label="Hex 440 mm" val="× 42" />
          <BomRow label="Hex 565 mm" val="× 12" />
          <BomRow sub="Connectors" />
          <BomRow label="Y connector" val="× 6" />
          <BomRow label="I connector" val="× 3" />
          <BomRow label="V connector" val="× 9" />
          <BomRow sub="Power" />
          <BomRow label="Power supply" val="× 1" accent />
        </div>
      </section>

      {/* Light check */}
      <section className="sec">
        <h2 className="sec-h">Will your layout be bright enough?</h2>
        <p className="sec-sub">Hexlight estimates floor-level illuminance using the lumen method — the same approach lighting engineers use. Pick your use case, confirm ceiling height, and the Light Check panel shows a live lux reading against a standard target range.</p>
        <div className="cards3">
          {LIGHT_FEATURES.map(([t, d]) => (
            <div className="card" key={t}>
              <div className="card-tag accent">{t}</div>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="sec">
        <h2 className="sec-h">Where people install hex lights</h2>
        <p className="sec-sub">One planner, every kind of space.</p>
        <div className="usecases">
          {USE_CASE_CARDS.map(([t, d, tags]) => (
            <div className="uc-card" key={t}>
              <h4>{t}</h4>
              <p>{d}</p>
              <div className="uc-tags">{tags}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Specs strip */}
      <section className="sec specs-sec">
        <div className="spec-col">
          <h3>Bar segments</h3>
          <table>
            <thead><tr><th>Length</th><th>Watts</th><th>Lumens</th></tr></thead>
            <tbody>
              {SYSTEMS.map((s) => {
                const w = { 440: 6, 565: 8, 1176: 16 }[s.segmentLength];
                return <tr key={s.id}><td>{s.segmentLength} mm</td><td>{w} W</td><td>{w * 110} lm</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="spec-col">
          <h3>Connectors</h3>
          <ul className="conn-list">
            {(Object.keys(CONNECTOR_LABELS) as ConnectorType[]).map((k) => (
              <li key={k}><b>{k.toUpperCase()}</b> {CONNECTOR_LABELS[k].replace(/^[A-Z]+ — /, "")}</li>
            ))}
          </ul>
        </div>
        <div className="spec-col">
          <h3>Lux targets · EN 12464-1</h3>
          <table>
            <tbody>{USE_CASES.map((u) => <tr key={u.id}><td>{u.label}</td><td>{u.targetLux} lx</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec faq" id="faq">
        <h2 className="sec-h">Hexagon LED lighting questions</h2>
        {FAQ.map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <h2>Design it. Verify it. Order it right.</h2>
        <p>Whether it's a garage, salon, studio or living room — free, instant, runs in your browser.</p>
        <div className="hero-cta center">
          <a className="cta" href={APP}>Plan my layout →</a>
          <a className="cta ghost" href="#templates">Browse layouts</a>
        </div>
        <div className="hero-trust">NO ACCOUNT · NO DOWNLOAD · NO COST</div>
      </section>

      <footer className="lfooter">
        <div className="lf-cols">
          <div><h5>Product</h5><a href={APP}>Open app</a><a href="#how">How it works</a><a href="#faq">FAQ</a></div>
          <div><h5>Templates</h5>{TEMPLATES.map((t) => <a key={t.id} href={APP}>{t.name}</a>)}</div>
          <div><h5>About</h5><span>Client-side estimate</span><span>±20% lumen method</span><span>Not affiliated with any LED brand</span></div>
        </div>
        <div className="lf-base">© 2026 Hexlight · Hex lights, planned for your space.</div>
      </footer>
    </div>
  );
}

function BomRow({ label, val, sub, accent }: { label?: string; val?: string; sub?: string; accent?: boolean }) {
  if (sub) return <div className="bomc-sub">{sub}</div>;
  return <div className={`bomc-row ${accent ? "accent" : ""}`}><span>{label}</span><span>{val}</span></div>;
}

function HexMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32">
      <polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="none" stroke={COLORS.accent} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3" fill={COLORS.amber} />
    </svg>
  );
}

// full-bleed flat-top hex grid that lights up per-hex on hover
function HeroHexGrid() {
  const R = 58;
  const W = 1680, H = 820;
  const SQRT3 = Math.sqrt(3);
  const h = SQRT3 * R;          // flat-top hex height
  const dx = 1.5 * R;           // column spacing
  const cols = Math.ceil(W / dx) + 2;
  const rows = Math.ceil(H / h) + 2;

  const hexPts = (cx: number, cy: number) => {
    const p: string[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k);
      p.push(`${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`);
    }
    return p.join(" ");
  };

  const cells: JSX.Element[] = [];
  for (let c = -1; c < cols; c++) {
    for (let r = -1; r < rows; r++) {
      const cx = c * dx;
      const cy = r * h + (c & 1 ? h / 2 : 0);
      cells.push(<polygon key={`${c},${r}`} className="hero-hex" points={hexPts(cx, cy)} />);
    }
  }
  return (
    <svg className="hero-hexgrid" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {cells}
    </svg>
  );
}

// static SVG preview: filled hex faces + glowing bars + node dots
function TemplatePreview({ docId, big }: { docId: string; big?: boolean }) {
  const t = TEMPLATES.find((x) => x.id === docId);
  if (!t) return null;
  const doc = t.build();
  const g = buildGraph(doc);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of g.nodes.values()) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
  }
  const W = maxX - minX || 1, H = maxY - minY || 1;
  const pad = Math.max(W, H) * 0.06;
  const vb = `${minX - pad} ${minY - pad} ${W + pad * 2} ${H + pad * 2}`;
  const sw = Math.max(W, H) * (big ? 0.012 : 0.02);

  const faces = Object.values(doc.hexes).map((h) =>
    hexVertices(h.systemId, h.q, h.r).map(([x, y]) => `${x},${y}`).join(" "),
  );

  return (
    <svg className={big ? "tprev big" : "tprev"} viewBox={vb} preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id={`pg-${docId}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={sw * 0.8} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {faces.map((pts, i) => (
        <polygon key={`f${i}`} className="hx-face" points={pts} style={{ ["--d" as string]: `${(i % 7) * 0.04}s` }} />
      ))}
      <g filter={`url(#pg-${docId})`}>
        {[...g.edges.values()].map((e) => {
          const a = g.nodes.get(e.from)!, b = g.nodes.get(e.to)!;
          return <line key={e.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLORS.led} strokeWidth={sw} strokeLinecap="round" />;
        })}
      </g>
      {[...g.nodes.values()].map((n) => (
        <circle key={n.key} cx={n.x} cy={n.y} r={sw * 1.1} fill={COLORS.led} />
      ))}
    </svg>
  );
}
