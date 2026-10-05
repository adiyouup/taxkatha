import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { formatDate } from "@/lib/format";
import { outcomeShort, type OutcomeSide } from "@/lib/labels";
import { truncate } from "@/lib/legal-text";

/*
 * Branded share images, rendered with next/og (Satori): flexbox only, and
 * every element with more than one child needs `display: flex`.
 *
 * Cards are built from PUBLIC fields only — never pass gated text here.
 */

export const CARD_FORMATS = {
  /** Link previews (Open Graph / X / LinkedIn / WhatsApp). */
  og: { width: 1200, height: 630 },
  /** Instagram and LinkedIn feed posts. */
  square: { width: 1080, height: 1080 },
  /** Instagram and WhatsApp stories. */
  story: { width: 1080, height: 1920 },
} as const;

export type CardFormat = keyof typeof CARD_FORMATS;

export type CardContent = {
  /** Small gold line above the title, e.g. "Madras High Court · 1 Aug 2026". */
  eyebrow: string;
  title: string;
  /** Public teaser text (the headnote). Shown on square and story cards. */
  summary: string;
  outcome?: { side: OutcomeSide; remanded: boolean };
  chips?: string[];
  kind: "Case law" | "Insight";
};

const NAVY = "#0A1F44";
const GOLD = "#D4AF37";
const PAPER = "#FAFAF7";
const MUTED = "#AEB9CF";

// Paths are literal so the bundler traces exactly these files into the deployment.
// Read once per server instance, not per request.
const assets = Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/PlayfairDisplay-SemiBold.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/Manrope-Medium.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/Manrope-Bold.ttf")),
  readFile(join(process.cwd(), "public/brand/taxkatha-mark-reverse.svg"), "utf8"),
]);

function Mark({ src, size }: { src: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img>.
  return <img src={src} width={size} height={size} alt="" />;
}

function Rule({ width }: { width: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ width: 12, height: 12, backgroundColor: GOLD, transform: "rotate(45deg)", borderRadius: 2 }} />
      <div style={{ width, height: 2, marginLeft: 18, backgroundImage: `linear-gradient(90deg, ${GOLD}, rgba(212,175,55,0))` }} />
    </div>
  );
}

function Pill({ label, filled, scale }: { label: string; filled: boolean; scale: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 44 * scale,
        padding: `0 ${18 * scale}px`,
        borderRadius: 6,
        border: `2px solid ${filled ? PAPER : "rgba(255,255,255,0.4)"}`,
        backgroundColor: filled ? PAPER : "transparent",
        color: filled ? NAVY : PAPER,
        fontFamily: "Manrope",
        fontWeight: 700,
        fontSize: 20 * scale,
        letterSpacing: 0.6,
      }}
    >
      {filled ? <div style={{ width: 9 * scale, height: 9 * scale, borderRadius: 99, backgroundColor: GOLD, marginRight: 10 * scale }} /> : null}
      {label}
    </div>
  );
}

export async function renderCard(content: CardContent, format: CardFormat, init?: { headers?: Record<string, string> }) {
  const [playfair, manropeMedium, manropeBold, markSvg] = await assets;
  const mark = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;
  const { width, height } = CARD_FORMATS[format];

  const tall = format !== "og";
  const story = format === "story";
  const pad = story ? 88 : tall ? 80 : 64;
  const scale = story ? 1.3 : tall ? 1.15 : 1;

  const title = truncate(content.title, story ? 150 : tall ? 130 : 110);
  const titleSize = (title.length > 90 ? 50 : title.length > 55 ? 58 : 68) * (story ? 1.2 : 1);
  const summary = tall ? truncate(content.summary, story ? 420 : 250) : "";
  const outcome = content.outcome ? outcomeShort(content.outcome.side) : null;
  const chips = (content.chips ?? []).slice(0, tall ? 4 : 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          backgroundColor: NAVY,
          backgroundImage: `radial-gradient(circle at 88% 0%, rgba(212,175,55,0.2), rgba(10,31,68,0) 55%)`,
          color: PAPER,
          fontFamily: "Manrope",
        }}
      >
        {/* decorative seal rings */}
        <div
          style={{
            position: "absolute",
            right: -(story ? 260 : 190),
            bottom: -(story ? 260 : 190),
            width: story ? 820 : 620,
            height: story ? 820 : 620,
            borderRadius: 9999,
            border: "2px solid rgba(212,175,55,0.22)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -(story ? 200 : 140),
            bottom: -(story ? 200 : 140),
            width: story ? 700 : 520,
            height: story ? 700 : 520,
            borderRadius: 9999,
            border: "1px solid rgba(212,175,55,0.12)",
            display: "flex",
          }}
        />

        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <Mark src={mark} size={72 * scale} />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 20 * scale }}>
              <div style={{ fontFamily: "Playfair Display", fontSize: 32 * scale, letterSpacing: 7 * scale, color: PAPER }}>TAXKATHA</div>
              <div style={{ fontSize: 12 * scale, letterSpacing: 4.2 * scale, color: GOLD, marginTop: 6, fontWeight: 700 }}>
                INSIGHTS • ANALYSIS • SUMMARY
              </div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 16 * scale, letterSpacing: 4, color: MUTED, fontWeight: 700 }}>
            {content.kind.toUpperCase()}
          </div>
        </div>

        {/* body */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 21 * scale, letterSpacing: 4, color: GOLD, fontWeight: 700 }}>
            {content.eyebrow.toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Playfair Display",
              fontSize: titleSize,
              lineHeight: 1.14,
              marginTop: 26 * scale,
              color: PAPER,
              maxWidth: width - pad * 2,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", marginTop: 34 * scale }}>
            <Rule width={160 * scale} />
          </div>
          {summary ? (
            <div
              style={{
                display: "flex",
                fontSize: (story ? 34 : 30) * (story ? 1.05 : 1),
                lineHeight: 1.5,
                color: "rgba(250,250,247,0.86)",
                marginTop: 40 * scale,
                maxWidth: width - pad * 2,
              }}
            >
              {summary}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            {outcome ? (
              <div style={{ display: "flex", marginRight: 12 }}>
                <Pill label={outcome} filled={content.outcome?.side === "assessee"} scale={scale} />
              </div>
            ) : null}
            {content.outcome?.remanded ? (
              <div style={{ display: "flex", marginRight: 12 }}>
                <Pill label="Remanded" filled={false} scale={scale} />
              </div>
            ) : null}
            {chips.map((chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 44 * scale,
                  padding: `0 ${16 * scale}px`,
                  marginRight: 12,
                  borderRadius: 6,
                  border: "2px solid rgba(212,175,55,0.5)",
                  color: "#F6E3A1",
                  fontSize: 20 * scale,
                  fontWeight: 500,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
          {tall ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 44 * scale,
                paddingTop: 30 * scale,
                borderTop: "1px solid rgba(212,175,55,0.35)",
              }}
            >
              <div style={{ display: "flex", fontSize: 24 * scale, color: MUTED }}>Read the full analysis</div>
              <div style={{ display: "flex", fontSize: 26 * scale, fontWeight: 700, color: GOLD }}>taxkatha.com</div>
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: init?.headers,
      fonts: [
        { name: "Playfair Display", data: playfair, weight: 600, style: "normal" },
        { name: "Manrope", data: manropeMedium, weight: 500, style: "normal" },
        { name: "Manrope", data: manropeBold, weight: 700, style: "normal" },
      ],
    },
  );
}

/** Card content for a case law, from its public teaser. */
export function caseCardContent(post: {
  title: string;
  excerpt: string;
  caseLaw: { court: { shortName: string }; decisionDate: string; outcomeSide: OutcomeSide; remanded: boolean; sectionRefs: string[] };
}): CardContent {
  return {
    kind: "Case law",
    eyebrow: `${post.caseLaw.court.shortName}  ·  ${formatDate(post.caseLaw.decisionDate)}`,
    title: post.title,
    summary: post.excerpt,
    outcome: { side: post.caseLaw.outcomeSide, remanded: post.caseLaw.remanded },
    chips: post.caseLaw.sectionRefs,
  };
}
