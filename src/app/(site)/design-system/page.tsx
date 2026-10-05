import type { Metadata } from "next";

import { BrandLockup, BrandLogo, BrandMark } from "@/components/brand/logo";
import { BalanceArc, GoldRule, QuillStroke } from "@/components/brand/motif";
import { PageHeader, Section, SectionHeading } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const navy = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const gold = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

const swatch: Record<string, string> = {
  "navy-50": "bg-navy-50", "navy-100": "bg-navy-100", "navy-200": "bg-navy-200", "navy-300": "bg-navy-300",
  "navy-400": "bg-navy-400", "navy-500": "bg-navy-500", "navy-600": "bg-navy-600", "navy-700": "bg-navy-700",
  "navy-800": "bg-navy-800", "navy-900": "bg-navy-900", "navy-950": "bg-navy-950",
  "gold-50": "bg-gold-50", "gold-100": "bg-gold-100", "gold-200": "bg-gold-200", "gold-300": "bg-gold-300",
  "gold-400": "bg-gold-400", "gold-500": "bg-gold-500", "gold-600": "bg-gold-600", "gold-700": "bg-gold-700",
  "gold-800": "bg-gold-800", "gold-900": "bg-gold-900",
};

function Swatches({ name, steps }: { name: string; steps: string[] }) {
  return (
    <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
      {steps.map((s) => (
        <div key={s}>
          <div className={`h-14 rounded-md border ${swatch[`${name}-${s}`]}`} />
          <p className="type-caption mt-1.5 text-muted-foreground">{s}</p>
        </div>
      ))}
    </div>
  );
}

function Controls() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="lg">Get Started</Button>
      <Button size="lg" variant="navy">Navy</Button>
      <Button size="lg" variant="outline">Explore Services</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Read the ruling</Button>
      <Badge>Featured</Badge>
      <Badge variant="secondary">High Court</Badge>
      <Badge variant="outline">CGST S.74</Badge>
    </div>
  );
}

/** Living reference for the TaxKatha design tokens and primitives. */
export default function DesignSystemPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="TaxKatha design system"
        description="Tokens, type and primitives. Every page is composed from these — no one-off values."
      />
      <Section>
        <div className="container-wide space-y-14">
          <SectionHeading eyebrow="Colour" title="Navy, gold and paper" />
          <div className="space-y-6">
            <Swatches name="navy" steps={navy} />
            <Swatches name="gold" steps={gold} />
          </div>
          <SectionHeading eyebrow="Typography" title="Playfair Display with Manrope" />
          <div className="space-y-5">
            <p className="type-display-2xl">Tax made simple.</p>
            <p className="type-display-xl">Decisions made smarter.</p>
            <p className="type-display-lg">Accuracy first.</p>
            <p className="type-display-md">Built around clarity.</p>
            <p className="type-display-sm">Designed for confident financial decisions.</p>
            <p className="type-eyebrow text-gold-text">Smarter tax. Simpler finances.</p>
            <p className="type-lede max-w-2xl text-muted-foreground">
              Lede — TaxKatha understands the complexity so you don&apos;t have to.
            </p>
            <p className="type-body max-w-2xl">
              Body — Where complaint alleged wrongful availment of ITC but did not arraign the company as accused,
              prosecution of the Director alone was not maintainable.
            </p>
          </div>
          <SectionHeading eyebrow="Controls" title="Buttons, badges and fields" />
          <Controls />
          <Input placeholder="Search rulings by case, section or court" className="max-w-md" />
          <SectionHeading eyebrow="Brand" title="Logo and motifs" />
          <div className="flex flex-wrap items-center gap-10">
            <BrandLogo className="h-56 w-auto" />
            <BrandMark className="size-24" />
            <BrandLockup showTagline />
          </div>
          <GoldRule />
        </div>
      </Section>
      <Section tone="navy">
        <div className="container-wide space-y-12">
          <SectionHeading
            eyebrow="On navy"
            title="The same components, flipped tokens"
            description="Gold is the connecting accent. On navy it is used at full strength."
          />
          <Controls />
          <Input placeholder="Search rulings by case, section or court" className="max-w-md" />
          <div className="flex flex-wrap items-center gap-10">
            <BrandLogo tone="reverse" className="h-56 w-auto" />
            <BrandMark tone="reverse" className="size-24" />
            <BrandLockup tone="reverse" showTagline />
            <QuillStroke className="h-40 w-auto" />
          </div>
          <BalanceArc className="h-16 w-full" />
        </div>
      </Section>
    </>
  );
}
