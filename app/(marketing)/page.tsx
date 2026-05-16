import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import styles from "./landing.module.css";

// Isometric garden mockup — same drawing language as design-mockup-c.html.
// Kept inline as an SVG so it ships as part of the page payload without an
// extra request and stays editable alongside the component.
function GardenIsoSvg() {
  return (
    <svg viewBox="0 0 460 540" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="grassPat" x="0" y="0" width="18" height="9" patternUnits="userSpaceOnUse">
          <rect width="18" height="9" fill="#4a7c3f" />
          <ellipse cx="4" cy="4.5" rx="1.8" ry="1.1" fill="#3d6b32" opacity="0.4" />
          <ellipse cx="13" cy="2" rx="1.2" ry="0.8" fill="#56904a" opacity="0.35" />
          <ellipse cx="9" cy="7" rx="1.4" ry="0.9" fill="#3d6b32" opacity="0.3" />
        </pattern>
        <pattern id="soilPat" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill="#3d2b1f" />
          <circle cx="3" cy="3" r="1.3" fill="#2d1f14" opacity="0.6" />
          <circle cx="8.5" cy="7" r="1.1" fill="#2d1f14" opacity="0.5" />
        </pattern>
        <filter id="dropShadow"><feDropShadow dx="3" dy="6" stdDeviation="3.5" floodColor="#000" floodOpacity="0.4" /></filter>
      </defs>
      <polygon points="230,40 410,180 230,320 50,180" fill="url(#grassPat)" />
      <g filter="url(#dropShadow)">
        <polygon points="100,210 160,180 220,210 160,240" fill="#5A3A18" />
        <polygon points="160,180 220,210 220,222 160,192" fill="#7D5630" />
        <polygon points="100,200 160,170 220,200 160,230" fill="#C49458" />
        <polygon points="106,198 158,172 214,198 162,224" fill="url(#soilPat)" />
        <circle cx="125" cy="200" r="3.5" fill="#2d5a1b" opacity="0.85" />
        <circle cx="145" cy="190" r="3" fill="#4a8a2e" opacity="0.75" />
        <circle cx="165" cy="200" r="3.5" fill="#2d5a1b" opacity="0.85" />
        <circle cx="185" cy="190" r="3" fill="#4a8a2e" opacity="0.7" />
        <circle cx="195" cy="208" r="3.2" fill="#2d5a1b" opacity="0.8" />
        <text x="160" y="212" textAnchor="middle" fill="#f0e0c0" fontSize="10" fontWeight="700" fontFamily="Fraunces, Georgia, serif" fontStyle="italic">Bed A</text>
      </g>
      <g filter="url(#dropShadow)">
        <polygon points="230,235 290,205 350,235 290,265" fill="#5A3A18" />
        <polygon points="290,205 350,235 350,247 290,217" fill="#7D5630" />
        <polygon points="230,225 290,195 350,225 290,255" fill="#C49458" />
        <polygon points="236,223 288,197 344,223 292,249" fill="url(#soilPat)" />
        <ellipse cx="265" cy="218" rx="11" ry="8" fill="#C44A2A" opacity="0.9" />
        <ellipse cx="265" cy="218" rx="8" ry="5" fill="#8C2A18" opacity="0.85" />
        <circle cx="310" cy="226" r="3.2" fill="#4a8a2e" opacity="0.8" />
        <circle cx="325" cy="216" r="2.8" fill="#2d5a1b" opacity="0.85" />
        <text x="290" y="237" textAnchor="middle" fill="#f0e0c0" fontSize="10" fontWeight="700" fontFamily="Fraunces, Georgia, serif" fontStyle="italic">Bed B</text>
      </g>
      <g filter="url(#dropShadow)">
        <polygon points="180,150 230,125 280,150 230,175" fill="#5A3A18" />
        <polygon points="230,125 280,150 280,160 230,135" fill="#7D5630" />
        <polygon points="180,142 230,117 280,142 230,167" fill="#C49458" />
        <polygon points="186,140 228,119 274,140 232,161" fill="url(#soilPat)" />
        <circle cx="208" cy="142" r="2.5" fill="#E0A030" opacity="0.85" />
        <circle cx="222" cy="135" r="2.5" fill="#E0A030" opacity="0.85" />
        <circle cx="236" cy="142" r="2.5" fill="#E0A030" opacity="0.85" />
        <circle cx="250" cy="135" r="2.5" fill="#E0A030" opacity="0.85" />
        <text x="230" y="153" textAnchor="middle" fill="#f0e0c0" fontSize="9" fontWeight="700" fontFamily="Fraunces, Georgia, serif" fontStyle="italic">Bed C</text>
      </g>
      <line x1="160" y1="200" x2="230" y2="225" stroke="rgba(168,216,112,0.15)" strokeWidth="3" strokeDasharray="3 4" />
      <line x1="230" y1="225" x2="230" y2="150" stroke="rgba(168,216,112,0.15)" strokeWidth="3" strokeDasharray="3 4" />
      <g opacity="0.18" transform="translate(60, 470)">
        <circle cx="0" cy="0" r="18" fill="none" stroke="#A8D870" strokeWidth="1" />
        <text x="0" y="-22" textAnchor="middle" fill="#A8D870" fontSize="9" fontFamily="IBM Plex Mono">N</text>
        <line x1="0" y1="-14" x2="0" y2="-2" stroke="#A8D870" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

// Companion-planting reference rows for the dark green section.
const COMPANIONS = [
  { wide: true, label: "Top pairing", good: true, pair: <><em>Tomatoes</em> + Basil</>, note: "Repels hornworms, masks scent from pests, and improves flavor of nearby fruit. Plant within the same square foot." },
  { label: "Beneficial", good: true, pair: <><em>Carrots</em> + Onions</>, note: "Onion smell deters carrot fly." },
  { label: "Beneficial", good: true, pair: <><em>Peppers</em> + Marigold</>, note: "Attracts pollinators, repels aphids." },
  { label: "Keep apart", good: false, pair: <><em>Fennel</em> + most things</>, note: "Allelopathic — secretes a chemical that inhibits growth in neighbors." },
  { label: "Keep apart", good: false, pair: <><em>Beans</em> + Onions</>, note: "Onions stunt bean growth — plant on opposite ends of the bed." },
];

// Feature catalog rendered like a ledger.
const LEDGER = [
  { num: "01", title: <>Visual <em>bed planner</em></>, desc: "Top-down canvas. Drag plants. Multi-cell footprints.", tier: "Free" },
  { num: "02", title: <><em>Climate</em>-aware calendar</>, desc: "Personalized to your zip — frost dates, start-seed weeks, harvest windows.", tier: "Pro" },
  { num: "03", title: <>Companion <em>science</em></>, desc: "Built-in warnings, beneficial pairings, crop rotation history.", tier: "Free" },
  { num: "04", title: <>AI <em>layout planner</em></>, desc: "Hand it your wishlist; it builds an optimized bed in seconds.", tier: "Pro" },
  { num: "05", title: <>Harvest <em>logbook</em></>, desc: "Photos, weights, ratings. Season history that informs next year.", tier: "Pro" },
  { num: "06", title: <>Smart <em>reminders</em></>, desc: "Push + email at the right week. Frost alerts when the front comes.", tier: "Pro" },
  { num: "07", title: <>Plant <em>collaborators</em></>, desc: "Share a garden with up to 5 people. Editor or viewer roles.", tier: "Pro" },
  { num: "08", title: <>Seed <em>inventory</em></>, desc: "What you have, what you need. Auto-generated shopping list.", tier: "Pro" },
];

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className={styles.landing}>

      {/* ───── Nav ───── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.wordmark}>
            <span className={styles.wordmarkText}>bare root</span>
            <span className={styles.wordmarkDot} />
          </div>
          <div className={styles.navLinks}>
            <a className={styles.navLink} href="#field-guide">Field guide</a>
            <Link className={styles.navLink} href="/pricing">Pricing</Link>
            <Link className={styles.navLink} href="/sign-in">Sign in</Link>
            <Link className={styles.navCta} href="/sign-up">Start free</Link>
          </div>
        </div>
      </nav>

      {/* ───── Hero ───── */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroMeta}>
            <span className={styles.eyebrow}>Issue 01 · Spring 2026</span>
            <span className={styles.heroIssue}>Volume One</span>
          </div>
          <h1 className={styles.heroTitle}>
            Plan the garden<br />
            you&apos;ll actually<br />
            <em><span className={styles.swash}>grow</span></em>.
          </h1>
          <p className={styles.heroLede}>
            A visual planner that knows your climate, your beds, and what grows
            well together — built for the gardener who&apos;s tired of guessing.
          </p>
          <div className={styles.heroCta}>
            <Link href="/sign-up" className={`${styles.btn} ${styles.btnPrimary}`}>
              Start planning — free
              <span className={styles.arrow}>→</span>
            </Link>
            <Link href="/pricing" className={`${styles.btn} ${styles.btnGhost}`}>See pricing</Link>
          </div>
          <div className={styles.heroTrust}>No credit card · Free forever tier</div>
          <div className={styles.heroTags}>
            <span className={`${styles.tag} ${styles.tagGreen}`}>Zone-aware</span>
            <span className={`${styles.tag} ${styles.tagAmber}`}>Companion science</span>
            <span className={styles.tag}>Climate smart</span>
            <span className={styles.tag}>Mobile + PWA</span>
          </div>
        </div>

        <div className={styles.heroCanvas}>
          <div className={styles.heroCanvasPill}>Garden Canvas — Interactive</div>
          <div className={styles.heroCanvasHint}>Drag to rearrange · scroll to zoom</div>
          <GardenIsoSvg />
          <div className={`${styles.heroOverlay} ${styles.overlayZone}`}>
            <div className="icon">◐</div>
            <div>
              <span className={styles.overlayLabel}>Your zone</span>
              <span className={styles.overlayValue}><em>7b</em> · Last frost Apr 15</span>
            </div>
          </div>
          <div className={`${styles.heroOverlay} ${styles.overlayCompanion}`}>
            <div className={styles.overlayCompanionHead}>
              <span className={styles.overlayCompanionDot} />
              <span className={styles.overlayCompanionLabel}>Companion match</span>
            </div>
            <div className={styles.overlayCompanionBody}>
              <strong>Tomatoes</strong> and <strong>basil</strong> — pest deterrent &amp; better flavor.
            </div>
          </div>
        </div>
      </section>

      <div className={styles.scrollCue}>
        <span className={styles.cueLabel}>Scroll · The field guide</span>
        <div className={styles.scrollCueLine} />
        <span className={styles.cueLabel}>↓</span>
      </div>

      {/* ───── Field guide intro ───── */}
      <section className={styles.fieldGuide} id="field-guide">
        <aside className={styles.fieldGuideMeta}>
          <span className={styles.sectionNum}>§ 01</span>
          <span className={styles.fieldGuideTitle}>A new<br />field guide<br />for the home<br />garden.</span>
        </aside>
        <div className={styles.fieldGuideBody}>
          <h2>Most planning apps treat your garden like a <em>spreadsheet</em>. Bare Root treats it like a&nbsp;living thing.</h2>
          <p>
            You don&apos;t think about your garden in rows and columns. You think
            about the corner that gets afternoon sun. The bed where tomatoes
            did well last year. The herbs your kid actually eats. The flowers
            that bring the pollinators.
          </p>
          <p>
            So we built something that looks like your garden. Beds you can
            see from above. Plants that take up the right amount of space. A
            calendar that knows when YOUR zip code&apos;s last frost is — not the
            generic one printed on a seed packet from someone else&apos;s climate.
          </p>
          <div className={styles.signature}>
            Built for gardeners
            <span className={styles.author}>— Kyle &amp; Robyn,</span>
            <span className={styles.signatureRest}> in their backyard in 7b.</span>
          </div>
        </div>
      </section>

      {/* ───── Canvas showcase ───── */}
      <section className={styles.canvasShowcase}>
        <div className={styles.canvasShowcaseInner}>
          <div className={styles.canvasShowcaseHeader}>
            <span className={styles.eyebrow}>§ 02 · The Canvas</span>
            <h2>Drag, drop, and <em>actually see</em> your garden.</h2>
            <p>
              Top-down beds with real proportions. Plants take the room they
              actually need — a tomato claims four cells, lettuce one. Tap to
              plant, hold to move. Mistakes are cheap.
            </p>
          </div>

          <div className={styles.canvasGridDemo}>
            <div className={styles.canvasGridTopbar}>
              <div className={styles.canvasGridTopbarLeft}>
                <div className={styles.canvasGridTopbarTitle}><em>Robyn&apos;s</em> Garden</div>
                <div className={styles.canvasGridTopbarTags}>
                  <span className={`${styles.tag} ${styles.tagGreen}`}>Zone 7b</span>
                  <span className={`${styles.tag} ${styles.tagAmber}`}>Spring &apos;26</span>
                  <span className={styles.tag}>8 × 4 ft</span>
                </div>
              </div>
              <div className={styles.canvasGridTopbarActions}>
                <span className={styles.iconBtn}>⊕</span>
                <span className={styles.iconBtn}>⊖</span>
                <span className={styles.iconBtn}>⟳</span>
              </div>
            </div>

            <div className={styles.canvasGridArea}>
              <div className={styles.bedGrid}>
                <div className={styles.bedCells}>
                  <div className={`${styles.cell} ${styles.cellActive}`}><span className={styles.cellDot} /><span className={styles.cellName}>Basil</span></div>
                  <div className={`${styles.cell} ${styles.cellActive}`}><span className={styles.cellDot} /><span className={styles.cellName}>Basil</span></div>
                  <div className={styles.cellMulti}><span className={styles.cellMultiName}>Tomato</span></div>
                  <div className={`${styles.cell} ${styles.cellActive}`}><span className={styles.cellDot} /><span className={styles.cellName}>Pepper</span></div>
                  <div className={`${styles.cell} ${styles.cellActive}`}><span className={styles.cellDot} /><span className={styles.cellName}>Pepper</span></div>
                  <div className={`${styles.cell} ${styles.cellPlanned}`}><span className={styles.cellDot} /><span className={styles.cellName}>Mari-gold</span></div>
                  <div className={`${styles.cell} ${styles.cellActive}`}><span className={styles.cellDot} /><span className={styles.cellName}>Carrot</span></div>
                  <div className={`${styles.cell} ${styles.cellActive}`}><span className={styles.cellDot} /><span className={styles.cellName}>Carrot</span></div>
                  <div className={`${styles.cell} ${styles.cellHarvest}`}><span className={styles.cellDot} /><span className={styles.cellName}>Lettuce</span></div>
                  <div className={`${styles.cell} ${styles.cellHarvest}`}><span className={styles.cellDot} /><span className={styles.cellName}>Lettuce</span></div>
                  <div className={`${styles.cell} ${styles.cellEmpty}`} />
                  <div className={`${styles.cell} ${styles.cellSeed}`}><span className={styles.cellDot} /><span className={styles.cellName}>Snap pea</span></div>
                  <div className={`${styles.cell} ${styles.cellSeed}`}><span className={styles.cellDot} /><span className={styles.cellName}>Snap pea</span></div>
                  <div className={`${styles.cell} ${styles.cellSeed}`}><span className={styles.cellDot} /><span className={styles.cellName}>Snap pea</span></div>
                  <div className={`${styles.cell} ${styles.cellEmpty}`} />
                  <div className={`${styles.cell} ${styles.cellEmpty}`} />
                  <div className={`${styles.cell} ${styles.cellEmpty}`} />
                  <div className={`${styles.cell} ${styles.cellEmpty}`} />
                </div>
              </div>

              <div className={styles.bedSide}>
                <div className={styles.bedSideHead}>
                  <div className={styles.bedSideName}>Cherry Tomato</div>
                  <div className={styles.bedSideSci}>Solanum lycopersicum</div>
                  <div className={styles.bedSidePill}>Active</div>
                </div>
                <div className={styles.bedSideBody}>
                  <div className={styles.bedSideRow}>
                    <div className={styles.bedSideRowIcon}>✓</div>
                    <div className={styles.bedSideRowText}><strong>Basil</strong> — pest deterrent, improves flavor of nearby fruit.</div>
                  </div>
                  <div className={styles.bedSideRow}>
                    <div className={styles.bedSideRowIcon}>✓</div>
                    <div className={styles.bedSideRowText}><strong>Marigold</strong> — repels nematodes and aphids.</div>
                  </div>
                  <div className={styles.bedSideRow}>
                    <div className={`${styles.bedSideRowIcon} ${styles.bedSideRowIconWarn}`}>!</div>
                    <div className={styles.bedSideRowText}><strong>Fennel</strong> — keep at least 3 ft away. Inhibits growth.</div>
                  </div>
                  <div className={styles.bedSideRow}>
                    <div className={styles.bedSideRowIcon}>✓</div>
                    <div className={styles.bedSideRowText}><strong>Carrot</strong> — beneficial roots loosen soil.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.canvasStats}>
            <div className={styles.canvasStat}>
              <div className={styles.canvasStatLabel}>Beds planted</div>
              <div className={styles.canvasStatValue}><em>3</em></div>
            </div>
            <div className={styles.canvasStat}>
              <div className={styles.canvasStatLabel}>Active plantings</div>
              <div className={styles.canvasStatValue}>18</div>
            </div>
            <div className={styles.canvasStat}>
              <div className={styles.canvasStatLabel}>Last frost</div>
              <div className={`${styles.canvasStatValue} ${styles.canvasStatValueAmber}`}>Apr 15</div>
            </div>
            <div className={styles.canvasStat}>
              <div className={styles.canvasStatLabel}>Today</div>
              <div className={styles.canvasStatValue}>68°</div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Climate + Calendar duet ───── */}
      <section className={styles.duet}>
        <div className={styles.duetCard}>
          <div className={styles.duetNum}>03</div>
          <span className={styles.eyebrow}>Climate-aware</span>
          <h3>Knows your <em>zip code</em>. Tells you when to plant.</h3>
          <p>
            Your USDA hardiness zone. Your last and first frost dates. A
            calendar built around YOUR climate — not someone else&apos;s. Start-seeds
            reminders fire at the right week. Frost alerts come before the
            cold front.
          </p>

          <div className={styles.climateCard}>
            <div className={styles.climateRow}>
              <div className={styles.climateTemp}>68<sup>°</sup></div>
              <div className={styles.climateMeta}>
                <div className={styles.climateLoc}>Zone 7b · 45213</div>
                <div className={styles.climateDesc}>Partly cloudy</div>
              </div>
            </div>
            <div className={styles.climateDivider} />
            <div className={styles.climateList}>
              <div className={styles.climateLi}>
                <span className={styles.climateLiDot} />
                <span className={styles.climateLiName}>Last frost</span>
                <span className={styles.climateLiEvent}>Average · zone 7b</span>
                <span className={styles.climateLiDate}>Apr 15</span>
              </div>
              <div className={styles.climateLi}>
                <span className={styles.climateLiDot} />
                <span className={styles.climateLiName}>First frost</span>
                <span className={styles.climateLiEvent}>Average · zone 7b</span>
                <span className={styles.climateLiDate}>Oct 22</span>
              </div>
              <div className={styles.climateLi}>
                <span className={styles.climateLiDot} />
                <span className={styles.climateLiName}>Growing days</span>
                <span className={styles.climateLiEvent}>Until first frost</span>
                <span className={styles.climateLiDate}>186 days</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.duetCard}>
          <div className={styles.duetNum}>04</div>
          <span className={styles.eyebrow}>Personal calendar</span>
          <h3>The right thing, at the <em>right week</em>.</h3>
          <p>
            Pulled together from each plant&apos;s days-to-maturity, your local
            frost dates, and what you&apos;ve actually planted. Push and email
            reminders so you don&apos;t miss a sowing window again.
          </p>

          <div className={styles.calCard}>
            <div className={styles.calMonth}>March 2026</div>
            <div className={styles.calEvent}>
              <div className={styles.calEventDay}>
                <div className={styles.calEventDayNum}>04</div>
                <div className={styles.calEventDayDow}>Wed</div>
              </div>
              <div>
                <span className={`${styles.calEventType} ${styles.calEventTypeSeed}`}>Start seeds indoors</span>
                <div className={styles.calEventPlant}><em>Tomato</em></div>
                <div className={styles.calEventWhere}>Robyn&apos;s Garden · Bed B</div>
              </div>
              <div className={`${styles.calEventIcon} ${styles.calIconSeed}`}>🌱</div>
            </div>
            <div className={styles.calEvent}>
              <div className={styles.calEventDay}>
                <div className={styles.calEventDayNum}>18</div>
                <div className={styles.calEventDayDow}>Wed</div>
              </div>
              <div>
                <span className={`${styles.calEventType} ${styles.calEventTypeSeed}`}>Start seeds indoors</span>
                <div className={styles.calEventPlant}><em>Pepper</em></div>
                <div className={styles.calEventWhere}>Robyn&apos;s Garden · Bed B</div>
              </div>
              <div className={`${styles.calEventIcon} ${styles.calIconSeed}`}>🌶</div>
            </div>
            <div className={styles.calEvent}>
              <div className={styles.calEventDay}>
                <div className={styles.calEventDayNum}>29</div>
                <div className={styles.calEventDayDow}>Sun</div>
              </div>
              <div>
                <span className={`${styles.calEventType} ${styles.calEventTypeTrans}`}>Direct sow</span>
                <div className={styles.calEventPlant}><em>Snap peas</em></div>
                <div className={styles.calEventWhere}>Robyn&apos;s Garden · Bed A</div>
              </div>
              <div className={`${styles.calEventIcon} ${styles.calIconTrans}`}>↑</div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Companions ───── */}
      <section className={styles.companions}>
        <div className={styles.companionsInner}>
          <div className={styles.companionsText}>
            <span className={styles.eyebrow}>§ 05 · Companion science</span>
            <h2>What grows well together — <em>and what won&apos;t</em>.</h2>
            <p>
              Centuries of gardener wisdom plus modern horticultural research,
              baked into every cell you tap. The AI layout planner reads your
              wishlist and builds an arrangement that maximizes friends and
              keeps enemies apart.
            </p>
            <div className={styles.companionsStatLine}>
              <strong>129 companion relationships</strong> · across <strong>153 curated plants</strong>
            </div>
          </div>

          <div className={styles.companionsViz}>
            {COMPANIONS.map((c, i) => (
              <div
                key={i}
                className={`${styles.compCard} ${c.wide ? styles.compCardWide : ""} ${!c.good ? styles.compCardWarning : ""}`}
              >
                <div className={styles.compCardHead}>
                  <span className={styles.compCardBadge}>{c.good ? "✓" : "!"}</span>
                  <span className={styles.compCardHeadLabel}>{c.label}</span>
                </div>
                <div className={styles.compCardPair}>{c.pair}</div>
                <div className={styles.compCardNote}>{c.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Pull quote ───── */}
      <section className={styles.pullquote}>
        <div className={styles.pullquoteMark}>&ldquo;</div>
        <q>I&apos;ve been gardening for fifteen years and I&apos;ve never had a tool actually <em>think</em> the way I think about my beds.</q>
        <div className={styles.pullquoteAttribution}>
          Alpha tester <span className={styles.pullquoteName}>Robyn W.</span> · 7b · raised beds
        </div>
      </section>

      {/* ───── Journal ───── */}
      <section className={styles.journal}>
        <div className={styles.journalInner}>
          <div className={styles.journalHead}>
            <h2>Every season, <em>remembered</em>.</h2>
            <p>
              Log harvests, attach photos, rate what worked. Bare Root keeps the
              record so next year&apos;s plan can start from what you already learned.
            </p>
          </div>

          <div className={styles.journalGrid}>
            {[
              { cls: styles.polaroidImgTomato, stamp: "Aug 14", rating: "★★★★★", name: "Brandywine", yield: "12.4 lbs · 5 plants" },
              { cls: styles.polaroidImgBasil, stamp: "Jul 02", rating: "★★★★☆", name: "Genovese basil", yield: "Pesto · 3 bunches" },
              { cls: styles.polaroidImgPepper, stamp: "Sep 03", rating: "★★★★★", name: "Shishito pepper", yield: "Grow again · yes" },
              { cls: styles.polaroidImgBed, stamp: "Jun 12", rating: "★★★★☆", name: "Bed A · early summer", yield: "Companion mix worked" },
            ].map((p, i) => (
              <div key={i} className={styles.polaroid}>
                <div className={`${styles.polaroidImg} ${p.cls}`} />
                <div className={styles.polaroidMeta}>
                  <span className={styles.polaroidStamp}>{p.stamp}</span>
                  <span className={styles.polaroidRating}>{p.rating}</span>
                </div>
                <div className={styles.polaroidName}>{p.name}</div>
                <div className={styles.polaroidYield}>{p.yield}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Ledger ───── */}
      <section className={styles.ledger}>
        <div className={styles.ledgerHead}>
          <span className={styles.eyebrow}>§ 07 · Everything in the box</span>
          <h2>One tool for the <em>whole season</em>.</h2>
        </div>

        <div className={styles.ledgerRows}>
          {LEDGER.map((row) => (
            <div key={row.num} className={styles.ledgerRow}>
              <div className={styles.ledgerNum}>{row.num}</div>
              <div className={styles.ledgerTitle}>{row.title}</div>
              <div className={styles.ledgerDesc}>{row.desc}</div>
              <div className={styles.ledgerTagCell}><span className={`${styles.tag} ${styles.tagGreen}`}>{row.tier}</span></div>
              <div className={styles.ledgerArrow}>→</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── Pricing ───── */}
      <section className={styles.pricing} id="pricing">
        <div className={styles.pricingHead}>
          <span className={styles.eyebrow}>§ 08 · Honest pricing</span>
          <h2>Free to start. <em>Upgrade</em> when you want more.</h2>
          <p>No ads. No data sales. No surprise charges.</p>
        </div>

        <div className={styles.pricingGrid}>
          <div className={`${styles.plan} ${styles.planFree}`}>
            <div className={styles.planName}>Free · Forever</div>
            <div className={styles.planPrice}>$0</div>
            <div className={styles.planPeriod}>No card required</div>
            <ul className={styles.planFeatures}>
              <li>1 garden, 3 beds</li>
              <li>Full plant library (150+ curated)</li>
              <li>Visual canvas with multi-cell plants</li>
              <li>Companion planting warnings</li>
              <li>20 photo uploads</li>
            </ul>
            <Link href="/sign-up" className={styles.planCta}>Get started free</Link>
            <div className={styles.planFine}>Free forever — really</div>
          </div>

          <div className={`${styles.plan} ${styles.planPro}`}>
            <span className={styles.planTrial}>7-day trial</span>
            <div className={styles.planName}>Pro · Everything else</div>
            <div className={styles.planPrice}>
              $<em>4</em><sup style={{ fontSize: 28 }}>58</sup>
            </div>
            <div className={styles.planPeriod}>/mo · billed annually · or $7/mo</div>
            <ul className={styles.planFeatures}>
              <li>Unlimited gardens + beds</li>
              <li>Personalized planting calendar</li>
              <li>AI layout planner</li>
              <li>Weather + frost alerts</li>
              <li>Harvest tracking + season history</li>
              <li>Collaborators (up to 5)</li>
              <li>Unlimited photos + seed inventory</li>
            </ul>
            <Link href="/sign-up" className={styles.planCta}>Start 7-day trial</Link>
            <div className={styles.planFine}>No charge for 7 days · cancel anytime</div>
          </div>
        </div>
      </section>

      {/* ───── Final CTA ───── */}
      <section className={styles.final}>
        <div className={styles.finalInner}>
          <h2>The garden is <em>waiting</em>.</h2>
          <p>Plan it before the ground thaws.</p>
          <Link href="/sign-up" className={`${styles.btn} ${styles.btnPrimary} ${styles.finalCta}`}>
            Start planning — free
            <span className={styles.arrow}>→</span>
          </Link>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.wordmark}>
              <span className={styles.wordmarkText}>bare root</span>
              <span className={styles.wordmarkDot} />
            </div>
            <p>A visual garden planner built for home gardeners. Made by Kyle &amp; Robyn in zone 7b.</p>
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColHead}>Product</div>
            <ul>
              <li><a href="#field-guide">Field guide</a></li>
              <li><Link href="/pricing">Pricing</Link></li>
              <li><Link href="/sign-in">Sign in</Link></li>
              <li><Link href="/sign-up">Sign up</Link></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColHead}>Garden</div>
            <ul>
              <li><a href="#field-guide">Plant library</a></li>
              <li><a href="#field-guide">Growing zones</a></li>
              <li><a href="#field-guide">Companion guide</a></li>
              <li><a href="#field-guide">Seasonal notes</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <div className={styles.footerColHead}>Legal</div>
            <ul>
              <li><Link href="/privacy">Privacy policy</Link></li>
              <li><Link href="/terms">Terms of service</Link></li>
              <li><a href="mailto:hello@bareroot.garden">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Bare Root · bareroot.garden</span>
          <span>Companion data via OpenFarm · CC BY 4.0</span>
        </div>
      </footer>

    </div>
  );
}
