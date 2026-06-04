import { COLORS, SYSTEMS, USE_CASES, CONNECTOR_LABELS, ConnectorType } from "../engine/spec";
import { TEMPLATES } from "../engine/templates";
import { buildGraph } from "../engine/geometry";

const FAQ: [string, string][] = [
  ["What are the connector types?", "Six junction shapes are detected automatically: I (straight-through), L (right-angle), V (angled two-way), Y (three-way branch), T (power tap), and X (four-way cross). Hexlight classifies each junction from the bars meeting there and their angles."],
  ["What bar lengths are available?", "440 mm and 565 mm build hexagons; 1176 mm serves straight line runs. 440 mm makes compact clusters, 565 mm gives larger hexes with more coverage."],
  ["How much power do I need?", "Wall draw is about 6 W (440 mm), 8 W (565 mm) and 16 W (1176 mm) per bar. Each connected run needs at least one power input, and a single input supplies up to 420 W before another is required."],
  ["How is the lux estimate calculated?", "Hexlight uses the lumen method: lumens × CU × MF ÷ floor area, where CU is the coefficient of utilisation (from room cavity ratio) and MF is a 0.80 maintenance factor. It is a ±20% estimate, not a full simulation."],
  ["Do I need an account?", "No. Everything runs in your browser — design, bill of materials, and lux check are all computed client-side. Export a PDF to order or hand off to a contractor."],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="lnav">
        <a className="brand" href="#/">
          <HexMark /> <span>Hexlight</span>
        </a>
        <div className="lnav-right">
          <a href="#faq">FAQ</a>
          <a className="cta-sm" href="#/app">Open planner</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-text">
          <span className="kicker">Hexagonal LED layout planner</span>
          <h1>Design honeycomb LED lighting, get the parts list instantly.</h1>
          <p>
            Drop hexagonal LED bars on a grid. Hexlight counts every bar and connector,
            sizes your power inputs, and estimates floor lux against EN&nbsp;12464-1 targets —
            all in your browser, no account.
          </p>
          <div className="hero-cta">
            <a className="cta" href="#/app">Start planning →</a>
            <a className="cta ghost" href="#templates">Browse templates</a>
          </div>
        </div>
        <div className="hero-art">
          <TemplatePreview docId="h14" big />
        </div>
      </header>

      <section className="steps">
        {[
          ["1", "Place hexes", "Click to drop 440 or 565 mm hexagons, or switch to Lines for 1176 mm runs."],
          ["2", "Read the BOM", "Bars, I/L/V/Y/T/X connectors and power inputs update live as you build."],
          ["3", "Check the light", "Enter room size and mounting; get a lux estimate vs your space target."],
          ["4", "Export", "Download a PDF parts list to order or hand to your installer."],
        ].map(([n, t, d]) => (
          <div className="step" key={n}>
            <span className="step-n">{n}</span>
            <h4>{t}</h4>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <section className="templates-sec" id="templates">
        <h2>Ready-made layouts</h2>
        <div className="tgallery">
          {TEMPLATES.map((t) => (
            <a className="tg-card" key={t.id} href="#/app">
              <TemplatePreview docId={t.id} />
              <div className="tg-meta">
                <span>{t.name}</span>
                <span className="tg-count">{t.hexCount} hex</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="specs-sec">
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
          <h3>Lux targets (EN 12464-1)</h3>
          <table>
            <tbody>
              {USE_CASES.map((u) => (
                <tr key={u.id}><td>{u.label}</td><td>{u.targetLux} lx</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="faq" id="faq">
        <h2>FAQ</h2>
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section className="final-cta">
        <h2>Plan your hex layout now.</h2>
        <a className="cta" href="#/app">Open the planner →</a>
      </section>

      <footer className="lfooter">
        <span>© 2026 Hexlight</span>
        <span>Estimates only · ±20% lumen method · not affiliated with any LED brand</span>
      </footer>
    </div>
  );
}

function HexMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32">
      <polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="none" stroke={COLORS.accent} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3" fill={COLORS.amber} />
    </svg>
  );
}

// small static SVG preview of a template's bar graph
function TemplatePreview({ docId, big }: { docId: string; big?: boolean }) {
  const t = TEMPLATES.find((x) => x.id === docId);
  if (!t) return null;
  const g = buildGraph(t.build());
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of g.nodes.values()) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
  }
  const pad = 40;
  const W = maxX - minX || 1, H = maxY - minY || 1;
  const vb = `${minX - pad} ${minY - pad} ${W + pad * 2} ${H + pad * 2}`;
  const sw = Math.max(W, H) * (big ? 0.018 : 0.03);
  return (
    <svg className={big ? "tprev big" : "tprev"} viewBox={vb} preserveAspectRatio="xMidYMid meet">
      {[...g.edges.values()].map((e) => {
        const a = g.nodes.get(e.from)!, b = g.nodes.get(e.to)!;
        return <line key={e.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLORS.led} strokeWidth={sw} strokeLinecap="round" />;
      })}
      {[...g.nodes.values()].map((n) => (
        <circle key={n.key} cx={n.x} cy={n.y} r={sw * 0.9} fill={COLORS.accent} />
      ))}
    </svg>
  );
}
