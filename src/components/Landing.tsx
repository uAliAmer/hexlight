import { COLORS, SYSTEMS, USE_CASES, CONNECTOR_LABELS, ConnectorType, WATTS_PER_BAR } from "../engine/spec";
import { TEMPLATES } from "../engine/templates";
import { buildGraph, hexVertices } from "../engine/geometry";

const APP = "#/app";

const TEMPLATE_BLURB: Record<string, string> = {
  h14: "~4×5 م · أكثر الأحجام شيوعاً",
  h8: "~3×5 م · بداية شائعة لكراج سيارة واحدة",
  h5: "تجمّع مدمج — طاولة عمل أو محطة واحدة",
  dual: "تجمّعان مستقلان — تحكّم بكل منطقة على حدة",
  h13border: "خلية مع إطار — لمسة استوديو راقية",
  h23: "~6×6 م · تغطية كاملة لكراج سيارتين",
};

const COMPONENTS: [string, string, string, string][] = [
  ["أطوال أضلاع متعددة", "سداسي 440/565 · T5 من 30 إلى 120سم · خطّي 1176", "اختر طول الضلع المناسب لمساحتك — من أضلاع T5 القصيرة (30سم) للتجمعات الضيقة إلى الطويلة (120سم والخطّي) لتغطية الجدران. يحسب هكسلايت الكمية الدقيقة لكل طول تحتاجه.", "/bars.png"],
  ["أنواع موصلات متعددة", "I · L · V · Y · T · X", "أنظمة السداسي الحقيقية تستخدم ستة أشكال موصلات حسب الزاوية وعدد أضلع عند العقدة. يحدّد هكسلايت الموصل المطلوب لكل وصلة ويضيف العدد الدقيق.", "/connectors.png"],
  ["الطاقة والكابلات", "تُحسب تلقائياً", "يحسب هكسلايت إجمالي سحب الطاقة وعدد المداخل المطلوبة. كل كابل يغذّي سلسلة محدودة — ويقسم تصميمك بأمثلية كي لا تتجاوز الحد أبداً.", "/powercord.png"],
];

const LIGHT_FEATURES: [string, string][] = [
  ["تقدير لكس حيّ", "يتحدّث في كل مرة تضيف أو تزيل خلية. مقرّب لأقرب 10 لكس مع إشارة ±20٪."],
  ["أهداف جاهزة لكل استخدام", "كراج 300 · ورشة 500 · تلميع 750 · صالة 400 · صالون 500 · معيشة 200 لكس. وفق EN 12464-1."],
  ["ارتفاع السقف والتركيب", "سطحي، معلّق، أو مسافة محسوبة تلقائياً لأفضل انتشار عبر تصميمك."],
];

const USE_CASE_CARDS: [string, string, string][] = [
  ["كراجات وورش", "سيارة واحدة، سيارتان، أماكن الهوايات، طاولات العمل. تغطية متساوية بلا ظلال عند 300–500 لكس.", "سيارة · سيارتان · طاولة عمل"],
  ["محلات حلاقة وصالونات", "تجمّعات سداسية فوق كل كرسي تمنح إضاءة ساطعة دقيقة الألوان يصوّرها الزبائن. 500 لكس لكل كرسي.", "لكل كرسي · استقبال · رفوف"],
  ["تلميع واستوديوهات سيارات", "أعمال الطلاء والسيراميك والتشطيب تحتاج إضاءة متساوية بلا بقع. 750 لكس لتشطيب دقيق الألوان.", "قسم تلميع · غرفة طلاء · معرض"],
  ["صالات منزلية واستوديوهات", "تجمّع سداسي فوق الجهاز يبدو رائعاً في فيديوهات التمرين. هدف 400 لكس — أغلبها 5–8 خلايا.", "حامل أثقال · يوغا · مقاطع"],
  ["غرف البث والمحتوى", "إطارات سداسية على الجدار خلف المكتب تظهر جيداً في البث. وضع الخطوط يرسم أشكالاً مخصصة.", "جدار بث · خلفية · مكتب"],
  ["غرف معيشة ولمسات منزلية", "أسقف مميزة فوق جزيرة المطبخ أو طاولة الطعام أو الممر. 200 لكس إضاءة منزلية محيطة.", "مطبخ · ممر · جدار مميز"],
];

const FAQ: [string, string][] = [
  ["كيف أخطّط نظام إضاءة LED سداسي؟", "افتح هكسلايت في أي متصفح — بلا تثبيت أو حساب. انقر لوضع الألواح السداسية على الشبكة، اختر طول الضلع (سداسي 440/565 مم، أو أضلاع T5 بأطوال 30/45/60/90/120 سم، أو خطّي 1176 مم)، وتحدّد الأداة كل نوع موصل وتبني قائمة مواد كاملة بالكميات."],
  ["كم موصلاً أحتاج؟", "يعتمد على هندسة التصميم. تستخدم الأنظمة السداسية ستة أنواع موصلات: I (مستقيم)، L (زاوية قائمة)، V (اتجاهين بزاوية)، Y (تفرّع ثلاثي)، T (مأخذ طاقة)، X (تقاطع رباعي). يكشف هكسلايت كل وصلة تلقائياً ويضيف العدد الدقيق."],
  ["ما الأطوال المدعومة؟", "أضلاع سداسية 440 و565 مم، وأضلاع T5 بأطوال فعلية 288.3/425/548.8/848.8/1148.8 مم (نظير 30/45/60/90/120 سم — تُقاس شاملة الأطراف فتقلّ ~5 سم عن الاسمي)، وضلع خطّي 1176 مم. 440 مم يصنع أشكالاً سداسية أصغر للتجمعات المدمجة، والأطول لتغطية أوسع. يدعم هكسلايت جميعها ويمزجها في تصميم واحد."],
  ["كم مدخل طاقة أحتاج؟", "كل سلسلة أضلاع متصلة تحتاج مدخل طاقة واحداً على الأقل. المدخل الواحد يوفّر حتى 420 واط — والسلسلة التي تتجاوز ذلك تحتاج مدخلاً ثانياً وهكذا. يحسب هكسلايت العدد الموصى به لكل جزيرة متصلة تلقائياً."],
  ["كم يستهلك النظام السداسي من الطاقة؟", "المهم هو سحب الكهرباء من الجدار. نموذجياً لكل ضلع: 6 واط جهة LED لـ 440 مم، 8 واط لـ 565 مم، 16 واط لـ 1176 مم، عند ≈110 لومن/واط وكفاءة محوّل ≈86٪. يحسب هكسلايت الاستهلاك الكلي حيّاً — ولوحة إعدادات أضلع تتيح ضبط كل قيمة."],
  ["كيف يقدّر هكسلايت السطوع؟", "طريقة اللومن (نفس أساس EN 12464-1): إجمالي اللومن × معامل الاستخدام (من هندسة الغرفة وارتفاع السقف) × عامل صيانة 0.80 ÷ مساحة الأرضية. النتيجة تقدير ±20٪ — ليست محاكاة دقيقة لكنها كافية للتأكد قبل الطلب."],
  ["هل يمكنني تصدير التصميم كـ PDF؟", "نعم. استخدم تصدير PDF لمستند جاهز للطباعة يحوي قائمة المواد الكاملة — أضلع حسب الطول، كل نوع موصل، عدد مصادر الطاقة، وإجمالي الواط. مفيد لطلب المورّد أو مشاركته مع الفنّي."],
  ["هل هكسلايت مجاني؟", "نعم، يعمل بالكامل في متصفحك بلا حساب أو تنزيل أو دفع في أي مرحلة."],
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="lnav">
        <a className="brand" href="#/"><HexMark /> <span>هكسلايت</span></a>
        <div className="lnav-right">
          <a href="#how">كيف يعمل</a>
          <a href="#faq">الأسئلة</a>
          <a className="nav-contact" href="#contact"><MailIcon /> تواصل معنا</a>
          <a className="cta-sm" href={APP}>افتح التطبيق ←</a>
        </div>
      </nav>

      <header className="hero">
        <HeroHexGrid />
        <div className="hero-text">
          <span className="kicker">مخطّط إضاءة LED السداسية</span>
          <h1>إضاءة سداسية، مخطّطة <em>لمساحتك</em>.</h1>
          <p>
            هكسلايت أداة متصفح لتصميم أنظمة إضاءة LED السداسية. ضع الأشكال على شبكة،
            تحقّق من شدّة الإضاءة على الأرض مقابل أهداف EN&nbsp;12464-1، واحصل على قائمة مواد كاملة —
            أضلاع وموصلات ومداخل طاقة — كلها محسوبة حيّاً.
          </p>
          <div className="hero-cta">
            <a className="cta" href={APP}>خطّط تصميمي ←</a>
            <a className="cta ghost" href="#templates">شاهد أمثلة جاهزة</a>
          </div>
          <div className="hero-trust">بلا حساب · بلا تنزيل · بلا تكلفة</div>
        </div>
        <div className="hero-art">
          <div className="hero-art-glow" />
          <TemplatePreview docId="h14" big />
        </div>
      </header>

      {/* How it works */}
      <section className="sec" id="how">
        <h2 className="sec-h">من الفكرة إلى تصميم جاهز للتركيب في دقائق</h2>
        <div className="steps">
          {[
            ["01", "افتح التطبيق", "يعمل بالكامل في متصفحك — بلا تثبيت أو حساب. افتح وابدأ."],
            ["02", "خطّط تصميمك", "ابنِ نمطك على الشبكة — تلتصق الألواح السداسية والخطوط في مكانها. تتحدّث الموصلات وأعداد أضلع حيّاً."],
            ["03", "تحقّق من التصميم", "قارن تقدير السطوع بهدف استخدامك، راجع قائمة المواد، ثم اطلب وأنت واثق من القطع الصحيحة."],
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
        <h2 className="sec-h">ابدأ من تصميم مُجرّب</h2>
        <div className="tgallery">
          {TEMPLATES.map((t) => (
            <a className={`tg-card ${t.featured ? "tg-feat" : ""}`} key={t.id} href={APP}>
              {t.featured && <span className="tg-badge">الأكثر بناءً</span>}
              <div className="tg-prev"><TemplatePreview docId={t.id} big={t.featured} /></div>
              <div className="tg-meta">
                <span className="tg-kicker">{t.name}</span>
                <span className="tg-name">{t.name}</span>
                <span className="tg-blurb">{TEMPLATE_BLURB[t.id]}</span>
              </div>
            </a>
          ))}
        </div>
        <p className="sec-foot">شكل مختلف في بالك؟ <a href={APP}>ابدأ من فارغ — افتح المخطّط ←</a></p>
      </section>

      {/* Components */}
      <section className="sec">
        <h2 className="sec-h">كل قطعة يحتاجها نظامك، محسوبة تلقائياً</h2>
        <p className="sec-sub">يُبنى نظام الإضاءة السداسي من أضلاع وموصلات ومداخل طاقة. يتتبّع هكسلايت الثلاثة أثناء التصميم — بلا جداول، بلا تخمين.</p>
        <div className="cards3">
          {COMPONENTS.map(([t, big, d, img]) => (
            <div className="card" key={t}>
              <div className="card-img"><img src={img} alt={t} loading="lazy" /></div>
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
          <h2 className="sec-h">قائمة مشترياتك، تُولّد تلقائياً</h2>
          <p>في كل مرة تضيف أو تزيل خلية، يعيد هكسلايت حساب قائمة القطع الكاملة فوراً — أضلع حسب الطول، الموصلات حسب النوع، وعدد مصادر الطاقة.</p>
          <p>عندما تجهز، صدّر التصميم كـ PDF — مخطط التصميم وقائمة القطع وحجم التركيب وإجمالي الواط في صفحة واحدة. سلّمه للمورّد أو احفظه للفنّي.</p>
        </div>
        <div className="bom-card">
          <div className="bom-card-title">ملخّص التصميم</div>
          <BomRow sub="أضلع" />
          <BomRow label="سداسي 440 مم" val="× 42" />
          <BomRow label="سداسي 565 مم" val="× 12" />
          <BomRow sub="الموصلات" />
          <BomRow label="موصل Y" val="× 6" />
          <BomRow label="موصل I" val="× 3" />
          <BomRow label="موصل V" val="× 9" />
          <BomRow sub="الطاقة" />
          <BomRow label="مصدر طاقة" val="× 1" accent />
        </div>
      </section>

      {/* Light check */}
      <section className="sec">
        <h2 className="sec-h">هل سيكون تصميمك ساطعاً بما يكفي؟</h2>
        <p className="sec-sub">يقدّر هكسلايت شدّة الإضاءة على الأرض بطريقة اللومن — نفس أسلوب مهندسي الإضاءة. اختر استخدامك، أكّد ارتفاع السقف، وتعرض لوحة فحص الإضاءة قراءة لكس حيّة مقابل نطاق هدف قياسي.</p>
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
        <h2 className="sec-h">أين يركّب الناس الإضاءة السداسية</h2>
        <p className="sec-sub">مخطّط واحد، لكل أنواع المساحات.</p>
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
          <h3>أضلاع الإضاءة</h3>
          <table>
            <thead><tr><th>الطول</th><th>واط</th><th>لومن</th></tr></thead>
            <tbody>
              {SYSTEMS.map((s) => {
                const w = WATTS_PER_BAR[s.segmentLength] ?? 0;
                return <tr key={s.id}><td>{s.label}</td><td>{w} واط</td><td>{Math.round(w * 110)} لومن</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="spec-col">
          <h3>الموصلات</h3>
          <ul className="conn-list">
            {(Object.keys(CONNECTOR_LABELS) as ConnectorType[]).map((k) => (
              <li key={k}><b>{k.toUpperCase()}</b> {CONNECTOR_LABELS[k].replace(/^[A-Z]+ — /, "")}</li>
            ))}
          </ul>
        </div>
        <div className="spec-col">
          <h3>أهداف اللكس · EN 12464-1</h3>
          <table>
            <tbody>{USE_CASES.map((u) => <tr key={u.id}><td>{u.label}</td><td>{u.targetLux} لكس</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec faq" id="faq">
        <h2 className="sec-h">أسئلة عن إضاءة LED السداسية</h2>
        {FAQ.map(([q, a]) => (
          <details key={q}><summary>{q}</summary><p>{a}</p></details>
        ))}
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <h2>صمّمها. تحقّق منها. اطلبها بشكل صحيح.</h2>
        <p>سواء كان كراجاً أو صالوناً أو استوديو أو غرفة معيشة — مجاني، فوري، يعمل في متصفحك.</p>
        <div className="hero-cta center">
          <a className="cta" href={APP}>خطّط تصميمي ←</a>
          <a className="cta ghost" href="#templates">تصفّح التصاميم</a>
        </div>
        <div className="hero-trust">بلا حساب · بلا تنزيل · بلا تكلفة</div>
      </section>

      {/* Contact */}
      <section className="contact-sec" id="contact">
        <h2 className="sec-h">تواصل مع المطوّر</h2>
        <p className="sec-sub">أسئلة، اقتراحات، أو تعاون؟ راسلني مباشرة.</p>
        <div className="contact-btns">
          <a className="contact-btn" href="mailto:ualiamer@riseup.net"><MailIcon /> راسلني عبر البريد</a>
          <a className="contact-btn ghost" href="https://github.com/uAliAmer" target="_blank" rel="noreferrer"><GithubIcon /> GitHub</a>
        </div>
      </section>

      <footer className="lfooter">
        <div className="lf-cols">
          <div><h5>المنتج</h5><a href={APP}>افتح التطبيق</a><a href="#how">كيف يعمل</a><a href="#faq">الأسئلة الشائعة</a></div>
          <div><h5>القوالب</h5>{TEMPLATES.map((t) => <a key={t.id} href={APP}>{t.name}</a>)}</div>
          <div><h5>حول</h5><span>تقدير داخل المتصفح</span><span>طريقة اللومن ±20٪</span><span>غير مرتبط بأي علامة LED</span></div>
        </div>
        <div className="lf-base">© 2026 هكسلايت · إضاءة سداسية، مخطّطة لمساحتك.</div>
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

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.85 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
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
