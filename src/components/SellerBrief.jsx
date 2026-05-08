/*
 * ═══════════════════════════════════════════════════════════════════════════════
 *  REPRIME GROUP — SELLER CONVERSATION BRIEF
 *
 *  Design intent: Gideon picks this up 2 minutes before a call.
 *  He needs to absorb the entire deal in 30 seconds.
 *
 *  Rules:
 *    1. Numbers are HUGE — he should see them from across the room
 *    2. Color = signal — green is good, red is risk, gold is money
 *    3. No walls of text — every word earns its place
 *    4. Atkinson Hyperlegible everywhere — designed for dyslexia
 *    5. The right column is pure "what to say on the call"
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── AI PROMPT (export for the API route) ────────────────────────────────────
export const buildSellerBriefPrompt = (deal, tenants, capexItems, addresses = []) => ({
  system: `You are a senior CRE acquisitions analyst at RePrime Group preparing a seller conversation brief for the CEO. Write sharp, specific talking points using actual numbers from the data. Every bullet must be actionable — something the CEO can literally say on the call. Keep each bullet to one punchy sentence. No hedging, no fluff, no "consider" or "potential" — be direct.`,
  user: `Generate seller call talking points. Return ONLY valid JSON with these exact keys:

{
  "opener": "One sentence the CEO can open the call with — reference something specific about the property that shows he's done his homework",
  "rent_plays": ["3-4 bullets: specific rent situations to discuss — name the tenant, the number, and what to push for"],
  "risk_flags": ["2-3 bullets: things the seller might bring up that Gideon should be ready for — with a suggested response"],
  "value_story": ["3-4 bullets: the upside narrative — what makes this property worth buying and how to frame it to the seller"],
  "leverage_points": ["2-3 bullets: why the seller should take OUR offer — what we bring that others don't"],
  "ask_list": ["2-3 bullets: specific things to request on the call — documents, concessions, or information"]
}

${addresses.length > 1 ? `NOTE: This is a PORTFOLIO of ${addresses.length} properties. Talking points should reflect the portfolio nature — call out per-property dynamics where they differ.\n\n` : ""}DEAL: ${JSON.stringify(deal, null, 2)}
ADDRESSES: ${JSON.stringify(addresses, null, 2)}
TENANTS: ${JSON.stringify(tenants, null, 2)}
CAPEX: ${JSON.stringify(capexItems, null, 2)}`
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n.replace(/[^0-9.-]/g, "")) : n;
  if (isNaN(num)) return String(n);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${Math.round(num / 1_000).toLocaleString()}K`;
  return `$${num.toLocaleString()}`;
};
const pct = (n) => (n == null || n === "") ? "—" : `${parseFloat(n).toFixed(1)}%`;
const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtShort = (d) => {
  if (!d) return "—";
  if (/^\d{1,2}\/\d{4}$/.test(d)) return d;
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
const yearsUntil = (d) => {
  if (!d) return null;
  const parts = d.match(/(\d{1,2})\/(\d{4})/);
  if (!parts) return null;
  const end = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1);
  return ((end - new Date()) / (365.25 * 24 * 60 * 60 * 1000));
};

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const P = {
  bg:         "#07090E",
  surface:    "#0F1218",
  card:       "#151A23",
  cardHover:  "#1A2030",
  border:     "#1E2636",
  borderLit:  "#2A3548",

  ivory:      "#F0E6D0",
  ivoryDim:   "#C4B394",
  gold:       "#D4A843",
  goldBright: "#F2D272",
  goldMuted:  "#8B7740",

  text:       "#E8ECF4",
  textMid:    "#C8D2E4",
  textDim:    "#A2ABBE",

  green:      "#34D058",
  greenDim:   "#1B6E2D",
  greenBg:    "#0B1F12",

  red:        "#F85149",
  redDim:     "#8B2520",
  redBg:      "#1A0A0A",

  amber:      "#E3B341",
  amberDim:   "#7D5E10",
  amberBg:    "#1A1500",

  blue:       "#58A6FF",
  blueDim:    "#1F4E8C",
  blueBg:     "#0A1628",

  purple:     "#BC8CFF",
  purpleDim:  "#5B3A8C",
  purpleBg:   "#120A22",
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function SellerBrief({ deal, tenants = [], capexItems = [], addresses = [], aiTalkingPoints = null }) {

  // ── DEMO DATA ──────────────────────────────────────────────────────────────
  if (!deal) {
    deal = {
      name: "Clocktower Plaza", address: "927 N Cable Road", city: "Lima", state: "OH",
      property_type: "Retail", class_type: "B", year_built: 1988, year_renovated: "2019",
      square_footage: "237605", occupancy: "91.76", purchase_price: "10500000", noi: "842000",
      cap_rate: "8.02", asking_cap_rate: "8.0", area_cap_rate: "7.25",
      ltv: "75", interest_rate: "6.00", amortization_years: "30",
      mezz_percent: "15", mezz_rate: "5.00", mezz_term_months: "60",
      equity_required: "1050000", deposit_amount: "$100,000", loan_estimate: "7875000",
      dd_deadline: "2026-05-25T17:48:00+00:00", close_deadline: "2026-06-17T17:48:00+00:00",
      special_terms: "$8.4M cash at closing + $2.1M seller mezz note at 5% IO for 60 months. IRC §453 installment sale treatment.",
      seller_credit: "0", io_period_months: "0", metro_population: "68722",
      neighborhood: "N Cable Road corridor",
      investment_highlights: [
        "19,575 SF vacant — 14,000 SF can be combined into one contiguous unit for a mid-box tenant",
        "Runnings paying $1.75/SF — well below market, push to $4.50+ at renewal",
        "Planet Fitness extended 13 years through 2039 — locked-in income",
        "Dollar Tree lease expires Jan 2028 — negotiate early renewal with rent bump or re-tenant at market",
        "Roof, HVAC, LED lights, pylon sign all recently replaced — minimal near-term capex",
        "17,623 VPD traffic + Walmart supercenter proximity = strong retail draw"
      ],
      acquisition_thesis: "Value-add play: lease up 19,575 SF of vacancy and mark Runnings to market. Stabilized NOI north of $1M at an 8-cap basis.",
    };
    tenants = [
      { tenant_name: "Tractor Supply", leased_sf: 42172, rent_per_sf: "2.50", annual_base_rent: "105430", lease_type: "NNN", lease_end_date: "12/2035", escalation_structure: "Bumps every 5 years", guarantor: "Corporate", tenant_credit_rating: "Investment Grade", is_anchor: true, is_vacant: false, market_rent_estimate: null },
      { tenant_name: "Runnings", leased_sf: 28000, rent_per_sf: "1.75", annual_base_rent: "49000", lease_type: "NNN", lease_end_date: "03/2030", escalation_structure: "Flat", guarantor: "Corporate", tenant_credit_rating: null, is_anchor: true, is_vacant: false, market_rent_estimate: "4.50" },
      { tenant_name: "Planet Fitness", leased_sf: 18500, rent_per_sf: "6.25", annual_base_rent: "115625", lease_type: "NNN", lease_end_date: "06/2039", escalation_structure: "2% annual", guarantor: "Franchisee", tenant_credit_rating: null, is_anchor: true, is_vacant: false, market_rent_estimate: null },
      { tenant_name: "Dollar Tree", leased_sf: 12400, rent_per_sf: "5.50", annual_base_rent: "68200", lease_type: "NNN", lease_end_date: "01/2028", escalation_structure: "Flat", guarantor: "Corporate", tenant_credit_rating: null, is_anchor: false, is_vacant: false, market_rent_estimate: null },
      { tenant_name: "VACANT", leased_sf: 19575, rent_per_sf: null, annual_base_rent: null, lease_type: null, lease_end_date: null, escalation_structure: null, guarantor: null, tenant_credit_rating: null, is_anchor: false, is_vacant: true, market_rent_estimate: "5.00" },
    ];
    capexItems = [
      { component_name: "Roof (older sections)", current_condition: "Fair", priority: "Near-Term", estimated_replacement_cost: "275000", useful_life_remaining: "3-5 years", notes: "Ollie's & USGS sections replaced 2017. Tractor Supply section patched but never fully replaced." },
      { component_name: "HVAC — 3 R-22 units", current_condition: "Poor", priority: "Immediate", estimated_replacement_cost: "95000", useful_life_remaining: "1-2 years", notes: "Running phased-out refrigerant. Two limping, one serviced spring 2025." },
      { component_name: "Parking lot east aisle", current_condition: "Fair", priority: "Near-Term", estimated_replacement_cost: "42000", useful_life_remaining: "12-18 months", notes: "Cracking and alligatoring. Resurface + restripe." },
    ];
  }

  // ── COMPUTED VALUES ────────────────────────────────────────────────────────
  const isPortfolio = addresses.length > 1;
  const totalSF   = parseFloat(deal.square_footage) || 0;
  const price     = parseFloat(String(deal.purchase_price ?? "0").replace(/[^0-9.-]/g, "")) || 0;
  const pricePSF  = totalSF > 0 ? price / totalSF : 0;
  const vacants   = tenants.filter(t => t.is_vacant);
  const occupied  = tenants.filter(t => !t.is_vacant);
  const vacantSF  = vacants.reduce((s, t) => s + (t.leased_sf || 0), 0);
  const totalCapex = capexItems.reduce((s, c) => s + (parseFloat(String(c.estimated_replacement_cost ?? "0").replace(/[^0-9.-]/g, "")) || 0), 0);
  const mezzAmt   = deal.mezz_percent ? price * parseFloat(deal.mezz_percent) / 100 : 0;
  const sellerCredit = parseFloat(String(deal.seller_credit ?? "0").replace(/[^0-9.-]/g, "")) || 0;

  // Sort tenants: anchors first, then by SF descending, vacant last
  const sortedTenants = [...tenants].sort((a, b) => {
    if (a.is_vacant && !b.is_vacant) return 1;
    if (!a.is_vacant && b.is_vacant) return -1;
    if (a.is_anchor && !b.is_anchor) return -1;
    if (!a.is_anchor && b.is_anchor) return 1;
    return (b.leased_sf || 0) - (a.leased_sf || 0);
  });

  // Parse AI
  let ai = null;
  if (aiTalkingPoints) {
    try { ai = typeof aiTalkingPoints === "string" ? JSON.parse(aiTalkingPoints) : aiTalkingPoints; } catch {}
  }

  // Lease color logic
  const leaseSignal = (t) => {
    if (t.is_vacant) return "vacant";
    const yrs = yearsUntil(t.lease_end_date);
    if (yrs === null) return "neutral";
    if (yrs < 2) return "danger";
    if (yrs < 5) return "warning";
    return "safe";
  };

  const signalColors = {
    safe:    { bg: P.greenBg,  border: P.greenDim,  accent: P.green,     label: P.green },
    warning: { bg: P.amberBg,  border: P.amberDim,  accent: P.amber,     label: P.amber },
    danger:  { bg: P.redBg,    border: P.redDim,    accent: P.red,       label: P.red },
    vacant:  { bg: P.amberBg,  border: P.amberDim,  accent: P.amber,     label: P.amber },
    neutral: { bg: P.card,     border: P.border,    accent: P.textMid,   label: P.textMid },
  };

  const capexSignal = (c) => {
    if (c.priority === "Immediate") return signalColors.danger;
    if (c.priority === "Near-Term") return signalColors.warning;
    return signalColors.safe;
  };

  // Weighted Average Lease Term
  const occupiedSF = occupied.reduce((s, t) => s + (t.leased_sf || 0), 0);
  const walt = occupiedSF > 0
    ? occupied.reduce((s, t) => {
        const yrs = yearsUntil(t.lease_end_date);
        return s + (yrs || 0) * (t.leased_sf || 0);
      }, 0) / occupiedSF
    : 0;

  return (
    <div style={{
      fontFamily: "'Atkinson Hyperlegible', 'Verdana', sans-serif",
      backgroundColor: P.bg, color: P.text,
      minHeight: "100vh", padding: "0", margin: "0",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:wght@500;600;700&display=swap');
        @media print {
          html, body { margin:0 !important; padding:0 !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          /* Page size is injected dynamically by the brief page on print so
             the whole brief fits on a single tall portrait page. */
        }
        /* Box-sizing only — no global padding/margin reset, because some
           renderers misorder inline style vs. cascade and can null out
           badge padding. */
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px 28px" }}>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  HEADER BAR                                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 0", borderBottom: `1px solid ${P.borderLit}`,
          marginBottom: "14px",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "11px", color: P.goldMuted, letterSpacing: "1px", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{'B"SD'}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "18px", fontWeight: 700, color: P.ivory, letterSpacing: "2px" }}>
                RePrime Group
              </div>
            </div>
            <div style={{ width: "1px", height: "28px", backgroundColor: P.borderLit }} />
            <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "4px", color: P.goldMuted, textTransform: "uppercase" }}>
              Seller Conversation Brief
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: "12px", color: P.textDim }}>
            <div>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
            <div style={{ letterSpacing: "2px", textTransform: "uppercase", marginTop: "2px" }}>Confidential</div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  HERO — PROPERTY IDENTITY                                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{
          background: `linear-gradient(145deg, ${P.card} 0%, ${P.surface} 50%, ${P.card} 100%)`,
          border: `1px solid ${P.borderLit}`,
          borderLeft: `5px solid ${P.gold}`,
          borderRadius: "8px",
          padding: "20px 28px",
          marginBottom: "14px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Subtle gold glow */}
          <div style={{
            position: "absolute", top: "-40px", left: "-40px",
            width: "180px", height: "180px",
            background: `radial-gradient(circle, ${P.gold}08 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
            <div>
              <div style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: "42px", fontWeight: 700,
                color: P.ivory,
                lineHeight: 1.05,
                letterSpacing: "0.5px",
              }}>
                {deal.name || "Untitled Property"}
              </div>
              <div style={{ fontSize: "17px", color: P.ivoryDim, marginTop: "6px", fontWeight: 400, letterSpacing: "0.3px" }}>
                {isPortfolio
                  ? `${addresses.length} Properties · ${deal.city}, ${deal.state}`
                  : <>{deal.address && `${deal.address} · `}{deal.city}, {deal.state}</>
                }
              </div>
              <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                {[
                  isPortfolio ? `PORTFOLIO · ${addresses.length} PROPERTIES` : null,
                  deal.property_type,
                  deal.class_type ? `Class ${deal.class_type}` : null,
                  deal.year_built ? `Built ${deal.year_built}` : null,
                  deal.year_renovated ? `Reno'd ${deal.year_renovated}` : null,
                  deal.neighborhood,
                ].filter(Boolean).map((tag, i) => (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
                    lineHeight: 1, boxSizing: "content-box",
                    fontSize: "12px", fontWeight: 700, color: P.goldMuted,
                    backgroundColor: `${P.gold}12`, border: `1px solid ${P.gold}25`,
                    padding: "4px 12px", borderRadius: "4px", letterSpacing: "0.5px",
                  }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Quick-glance deal status */}
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "24px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2px", color: P.textDim, textTransform: "uppercase", marginBottom: "4px" }}>
                Our Price
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "44px", fontWeight: 700, color: P.goldBright, lineHeight: 1, letterSpacing: "1px" }}>
                {fmt(deal.purchase_price)}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  PORTFOLIO PROPERTIES (only when multiple addresses)              */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isPortfolio && (
          <div style={{ marginBottom: "14px" }}>
            <SectionHead icon="◱" title={`Portfolio · ${addresses.length} Properties`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
              {addresses.map((a, i) => {
                const sf = parseFloat(String(a.square_footage ?? "0").replace(/[^0-9.-]/g, "")) || 0;
                return (
                  <div key={a.id ?? i} style={{
                    backgroundColor: P.card,
                    border: `1px solid ${P.border}`,
                    borderLeft: `4px solid ${P.gold}`,
                    borderRadius: "6px",
                    padding: "10px 14px",
                  }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: P.text, lineHeight: 1.2 }}>
                      {a.label || `Property ${i + 1}`}
                    </div>
                    <div style={{ fontSize: "14px", color: P.textMid, marginTop: "3px", lineHeight: 1.4 }}>
                      {[a.address, a.city, a.state].filter(Boolean).join(", ") || "—"}
                    </div>
                    {sf > 0 && (
                      <div style={{ fontSize: "14px", color: P.textDim, marginTop: "3px" }}>
                        <strong style={{ color: P.gold }}>{sf.toLocaleString()} SF</strong>
                        {a.units && <span> · {a.units} units</span>}
                        {a.year_built && <span> · Built {a.year_built}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  HEADLINE METRICS — THE FOUR NUMBERS THAT MATTER                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px", marginBottom: "14px" }}>
          {[
            { label: "NOI", value: fmt(deal.noi), sub: "Net Operating Income", color: P.green },
            { label: "CAP RATE", value: pct(deal.cap_rate), sub: deal.area_cap_rate ? `Market: ${pct(deal.area_cap_rate)}` : "Market: TBD", color: P.blue },
            { label: "OCCUPANCY", value: deal.occupancy ? `${parseFloat(deal.occupancy).toFixed(0)}%` : "—", sub: `${vacantSF.toLocaleString()} SF vacant`, color: parseFloat(deal.occupancy) >= 90 ? P.green : P.amber },
            { label: "PRICE / SF", value: pricePSF > 0 ? `$${pricePSF.toFixed(0)}` : "—", sub: `${totalSF.toLocaleString()} total SF`, color: P.text },
            { label: "WALT", value: walt > 0 ? `${walt.toFixed(1)} yr` : "—", sub: "Weighted avg lease term", color: walt > 5 ? P.green : P.amber },
            { label: "CAPEX NEED", value: fmt(totalCapex), sub: `${capexItems.length} item${capexItems.length !== 1 ? "s" : ""} flagged`, color: totalCapex > 200000 ? P.red : P.amber },
          ].map((m, i) => (
            <div key={i} style={{
              backgroundColor: P.card,
              border: `1px solid ${P.border}`,
              borderTop: `3px solid ${m.color}`,
              borderRadius: "6px",
              padding: "14px 12px 12px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2.5px", color: P.textDim, marginBottom: "8px" }}>
                {m.label}
              </div>
              <div style={{ fontSize: "34px", fontWeight: 700, color: m.color, lineHeight: 1, marginBottom: "6px" }}>
                {m.value}
              </div>
              <div style={{ fontSize: "13px", color: P.textMid }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/*  MAIN BODY — TWO COLUMNS                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "55% 43%", gap: "18px" }}>

          {/* ─── LEFT: THE DEAL ─── */}
          <div>

            {/* CAPITAL STACK */}
            <SectionHead icon="◈" title="How We're Buying It" />
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "16px" }}>
              <CapRow
                label={`Senior Debt — ${deal.ltv || "—"}% LTV`}
                amount={fmt(deal.loan_estimate)}
                terms={`${pct(deal.interest_rate)} · ${deal.amortization_years}yr amort${deal.io_period_months && deal.io_period_months !== "0" ? ` · ${deal.io_period_months}mo IO` : ""}`}
                color={P.blue} pct={deal.ltv}
              />
              {mezzAmt > 0 && (
                <CapRow
                  label={`Seller Mezz — ${deal.mezz_percent}%`}
                  amount={fmt(mezzAmt)}
                  terms={`${pct(deal.mezz_rate)} IO · ${deal.mezz_term_months}mo balloon`}
                  color={P.purple} pct={deal.mezz_percent}
                />
              )}
              <CapRow
                label="Our Equity"
                amount={fmt(deal.equity_required)}
                terms={`Deposit: ${deal.deposit_amount || "—"}`}
                color={P.gold}
                pct={100 - (parseFloat(deal.ltv) || 0) - (parseFloat(deal.mezz_percent) || 0)}
              />
              {sellerCredit > 0 && (
                <CapRow label="Seller Credit" amount={`(${fmt(sellerCredit)})`} terms="Applied at closing" color={P.green} pct={0} />
              )}
            </div>

            {/* TENANTS */}
            {sortedTenants.length > 0 && (
              <>
                <SectionHead icon="◧" title={`Who's In The Building — ${occupied.length} Tenant${occupied.length !== 1 ? "s" : ""}`} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                  {sortedTenants.map((t, i) => {
                    const sig = leaseSignal(t);
                    const sc = signalColors[sig];
                    const yrs = yearsUntil(t.lease_end_date);
                    const pctOfTotal = totalSF > 0 ? ((t.leased_sf || 0) / totalSF * 100) : 0;

                    return (
                      <div key={i} style={{
                        backgroundColor: sc.bg,
                        border: `1.5px solid ${sc.border}`,
                        borderLeft: `5px solid ${sc.accent}`,
                        borderRadius: "6px",
                        padding: "12px 16px",
                        display: "grid",
                        gridTemplateColumns: t.is_vacant ? "1fr" : "1fr auto",
                        gap: "8px",
                        alignItems: "center",
                      }}>
                        <div>
                          {/* Tenant name row */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "19px", fontWeight: 700, color: P.text, lineHeight: 1.2 }}>
                              {t.tenant_name}
                            </span>
                            {t.is_anchor && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
                                lineHeight: 1, boxSizing: "content-box",
                                fontSize: "12px", fontWeight: 700, backgroundColor: P.gold, color: P.bg,
                                padding: "3px 10px", borderRadius: "3px", letterSpacing: "1px",
                              }}>ANCHOR</span>
                            )}
                            {t.tenant_credit_rating && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
                                lineHeight: 1, boxSizing: "content-box",
                                fontSize: "12px", fontWeight: 700, backgroundColor: P.greenBg, color: P.green,
                                padding: "3px 10px", borderRadius: "3px", border: `1px solid ${P.greenDim}`,
                              }}>{t.tenant_credit_rating}</span>
                            )}
                          </div>

                          {/* Detail row */}
                          <div style={{ fontSize: "15px", color: P.textMid, marginTop: "4px", lineHeight: 1.5 }}>
                            {t.is_vacant ? (
                              <span style={{ color: P.amber, fontWeight: 700, fontSize: "16px" }}>
                                {(t.leased_sf || 0).toLocaleString()} SF available
                                {t.market_rent_estimate && ` — est. $${t.market_rent_estimate}/SF market`}
                              </span>
                            ) : (
                              <>
                                <strong style={{ color: P.text }}>{(t.leased_sf || 0).toLocaleString()} SF</strong>
                                <span style={{ color: P.textDim }}> ({pctOfTotal.toFixed(0)}% of property)</span>
                                <span style={{ color: P.textDim }}> · {t.lease_type}</span>
                                <span style={{ color: P.textDim }}> · {t.guarantor || "—"}</span>
                                {yrs !== null && (
                                  <span style={{ color: sc.label, fontWeight: 700 }}>
                                    {" "}· {yrs < 1 ? "EXPIRING THIS YEAR" : yrs < 2 ? `${Math.ceil(yrs * 12)}mo left` : `${yrs.toFixed(1)}yr left`}
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Escalation callout */}
                          {!t.is_vacant && t.escalation_structure && (
                            <div style={{
                              fontSize: "14px", fontWeight: 700, marginTop: "4px",
                              color: t.escalation_structure === "Flat" ? P.amber : P.green,
                            }}>
                              {t.escalation_structure === "Flat"
                                ? "⚠ FLAT RENT — No escalations"
                                : `↑ ${t.escalation_structure}`
                              }
                            </div>
                          )}

                          {/* Below market callout */}
                          {!t.is_vacant && t.market_rent_estimate && parseFloat(t.rent_per_sf) < parseFloat(t.market_rent_estimate) && (
                            <div style={{
                              fontSize: "14px", fontWeight: 700, marginTop: "3px", color: P.goldBright,
                              backgroundColor: `${P.gold}15`, padding: "3px 8px", borderRadius: "3px",
                              display: "inline-block",
                            }}>
                              💰 BELOW MARKET — paying ${t.rent_per_sf}, market is ${t.market_rent_estimate}/SF
                            </div>
                          )}
                        </div>

                        {/* Rent callout */}
                        {!t.is_vacant && (
                          <div style={{ textAlign: "right", paddingLeft: "12px" }}>
                            <div style={{ fontSize: "32px", fontWeight: 700, color: sc.accent, lineHeight: 1 }}>
                              ${t.rent_per_sf}
                            </div>
                            <div style={{ fontSize: "13px", color: P.textDim, marginTop: "2px" }}>per SF · {t.lease_type}</div>
                            <div style={{ fontSize: "14px", color: P.textDim }}>
                              Exp {fmtShort(t.lease_end_date)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* CAPEX */}
            {capexItems.length > 0 && (
              <>
                <SectionHead icon="⚙" title={`CapEx Risk — ${fmt(totalCapex)} Identified`} />
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "16px" }}>
                  {capexItems.map((c, i) => {
                    const cc = capexSignal(c);
                    return (
                      <div key={i} style={{
                        backgroundColor: cc.bg,
                        border: `1.5px solid ${cc.border}`,
                        borderLeft: `5px solid ${cc.accent}`,
                        borderRadius: "6px",
                        padding: "10px 14px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                        <div>
                          <div style={{ fontSize: "17px", fontWeight: 700, color: P.text }}>{c.component_name}</div>
                          <div style={{ fontSize: "14px", color: P.textMid, marginTop: "2px" }}>
                            <span style={{ color: cc.accent, fontWeight: 700 }}>{c.priority}</span>
                            <span> · {c.current_condition} condition · {c.useful_life_remaining || "?"} remaining</span>
                          </div>
                          {c.notes && (
                            <div style={{ fontSize: "14px", color: P.textDim, marginTop: "3px", lineHeight: 1.4, maxWidth: "400px" }}>
                              {c.notes}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: "24px", fontWeight: 700, color: cc.accent, flexShrink: 0, marginLeft: "16px" }}>
                          {fmt(c.estimated_replacement_cost)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ─── RIGHT: WHAT TO SAY ─── */}
          <div>

            {/* TIMELINE */}
            <SectionHead icon="◷" title="Timeline" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "16px" }}>
              {[
                { label: "DUE DILIGENCE", value: fmtDate(deal.dd_deadline), urgent: deal.dd_deadline && (new Date(deal.dd_deadline) - new Date()) < 14 * 86400000 },
                { label: "CLOSING", value: fmtDate(deal.close_deadline), urgent: false },
                { label: "DEPOSIT", value: deal.deposit_amount || "—", urgent: false },
              ].map((item, i) => (
                <div key={i} style={{
                  backgroundColor: item.urgent ? P.redBg : P.card,
                  border: `1px solid ${item.urgent ? P.redDim : P.border}`,
                  borderRadius: "6px",
                  padding: "12px 10px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "2px", color: item.urgent ? P.red : P.textDim, marginBottom: "6px" }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: item.urgent ? P.red : P.gold, lineHeight: 1.1 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* DEAL STRUCTURE */}
            {deal.special_terms && (
              <>
                <SectionHead icon="◈" title="Deal Structure" />
                <div style={{
                  backgroundColor: P.card, border: `1px solid ${P.border}`, borderLeft: `5px solid ${P.gold}`,
                  borderRadius: "6px", padding: "14px 16px", marginBottom: "16px",
                  fontSize: "15px", lineHeight: 1.7, color: P.text,
                }}>
                  {deal.special_terms}
                </div>
              </>
            )}

            {/* AI TALKING POINTS or INVESTMENT HIGHLIGHTS */}
            {ai ? (
              <>
                {ai.opener && (
                  <>
                    <SectionHead icon="📞" title="Open The Call With" />
                    <div style={{
                      backgroundColor: P.blueBg, border: `1px solid ${P.blueDim}`, borderLeft: `5px solid ${P.blue}`,
                      borderRadius: "6px", padding: "14px 16px", marginBottom: "16px",
                      fontSize: "16px", lineHeight: 1.6, color: P.text, fontWeight: 400,
                    }}>
                      {`"${ai.opener}"`}
                    </div>
                  </>
                )}
                {ai.rent_plays?.length > 0 && <TalkBlock icon="$" title="Rent Plays" items={ai.rent_plays} color={P.green} />}
                {ai.value_story?.length > 0 && <TalkBlock icon="↑" title="The Value Story" items={ai.value_story} color={P.blue} />}
                {ai.risk_flags?.length > 0 && <TalkBlock icon="⚠" title="Be Ready For" items={ai.risk_flags} color={P.amber} />}
                {ai.leverage_points?.length > 0 && <TalkBlock icon="◆" title="Why Us" items={ai.leverage_points} color={P.purple} />}
                {ai.ask_list?.length > 0 && <TalkBlock icon="→" title="Ask For" items={ai.ask_list} color={P.gold} />}
              </>
            ) : deal.investment_highlights?.length > 0 ? (
              <TalkBlock icon="→" title="Key Talking Points" items={deal.investment_highlights} color={P.gold} />
            ) : null}

            {/* THESIS */}
            {deal.acquisition_thesis && (
              <>
                <SectionHead icon="◎" title="Why We're Buying This" />
                <div style={{
                  backgroundColor: P.card, border: `1px solid ${P.border}`, borderLeft: `5px solid ${P.green}`,
                  borderRadius: "6px", padding: "14px 16px", marginBottom: "16px",
                  fontSize: "16px", lineHeight: 1.7, color: P.text,
                }}>
                  {deal.acquisition_thesis}
                </div>
              </>
            )}

            {/* MARKET */}
            {(deal.metro_population || deal.area_cap_rate) && (
              <>
                <SectionHead icon="⊕" title="Market" />
                <div style={{
                  backgroundColor: P.card, border: `1px solid ${P.border}`, borderRadius: "6px",
                  padding: "14px 16px", fontSize: "15px", lineHeight: 1.8, color: P.text,
                }}>
                  {deal.metro_population && (
                    <div><span style={{ color: P.textDim }}>Metro:</span> <strong>{parseInt(deal.metro_population).toLocaleString()}</strong></div>
                  )}
                  {deal.area_cap_rate && (
                    <div><span style={{ color: P.textDim }}>Market Cap:</span> <strong style={{ color: P.blue }}>{pct(deal.area_cap_rate)}</strong>
                      {deal.cap_rate && parseFloat(deal.cap_rate) > parseFloat(deal.area_cap_rate) && (
                        <span style={{ color: P.green, fontWeight: 700 }}> — we&apos;re buying above market</span>
                      )}
                    </div>
                  )}
                  {deal.asking_cap_rate && (
                    <div><span style={{ color: P.textDim }}>Asking Cap:</span> <strong>{pct(deal.asking_cap_rate)}</strong></div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: "16px", paddingTop: "10px",
          borderTop: `1px solid ${P.border}`,
          fontSize: "12px", color: P.textDim, letterSpacing: "1px",
        }}>
          <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "13px", color: P.goldMuted }}>
            RePrime Group · {deal.name}
          </span>
          <span>CONFIDENTIAL — INTERNAL USE ONLY</span>
        </div>
      </div>
    </div>
  );
}


// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function SectionHead({ icon, title }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      marginBottom: "8px",
    }}>
      <span style={{ fontSize: "15px", color: "#E8D4A8" }}>{icon}</span>
      <span style={{
        fontSize: "14px", fontWeight: 700, letterSpacing: "3px",
        textTransform: "uppercase", color: "#C4B394",
      }}>{title}</span>
      <div style={{ flex: 1, height: "1px", backgroundColor: "#1E2636", marginLeft: "8px" }} />
    </div>
  );
}

function CapRow({ label, amount, terms, color, pct: pctVal }) {
  return (
    <div style={{
      backgroundColor: "#151A23", border: "1px solid #1E2636",
      borderLeft: `5px solid ${color}`,
      borderRadius: "6px", padding: "11px 16px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "#E8ECF4" }}>{label}</div>
        <div style={{ fontSize: "14px", color: "#C8D2E4", marginTop: "2px" }}>{terms}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        {pctVal > 0 && (
          <span style={{ fontSize: "15px", color: "#A2ABBE", fontWeight: 700 }}>{pctVal}%</span>
        )}
        <span style={{ fontSize: "26px", fontWeight: 700, color }}>{amount}</span>
      </div>
    </div>
  );
}

function TalkBlock({ icon, title, items, color }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <SectionHead icon={icon} title={title} />
      <div style={{
        backgroundColor: "#151A23", border: "1px solid #1E2636",
        borderLeft: `5px solid ${color}`,
        borderRadius: "6px", padding: "8px 14px",
      }}>
        {items.map((item, i) => (
          <div key={i} style={{
            fontSize: "15px", lineHeight: 1.65, color: "#E8ECF4",
            padding: "6px 0",
            borderBottom: i < items.length - 1 ? "1px solid #1E2636" : "none",
            display: "flex", alignItems: "flex-start", gap: "10px",
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              whiteSpace: "nowrap", lineHeight: 1, boxSizing: "content-box",
              color, fontWeight: 700, fontSize: "12px",
              backgroundColor: `${color}18`, border: `1px solid ${color}35`,
              padding: "3px 6px", borderRadius: "3px",
              flexShrink: 0, marginTop: "3px",
              minWidth: "22px",
            }}>{i + 1}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
