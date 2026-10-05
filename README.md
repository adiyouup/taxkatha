# 📈 TaxKatha — Smart Tax Planning & Financial Chronicles

TaxKatha is a modern, full-stack tax planning, calculation engine, and financial advisory web application built with **Node.js**, **Next.js 16 (App Router)**, **TypeScript**, and **Tailwind CSS**.

---

## 🚀 Features

- **⚡ Real-Time Tax Computation**: Instant calculation for both New and Old tax regimes (FY 2024–25 & FY 2025–26).
- **⚖️ Side-by-Side Regime Comparison**: Automated recommendations highlighting the most tax-efficient regime.
- **🛡️ Deduction Discovery**: Interactive deductions breakdown for Section 80C, 80D, HRA, and NPS.
- **📊 Cash Flow Breakdown**: Visual monthly in-hand take-home salary and effective tax rate metrics.
- **🔌 Full-Stack REST API**: Built-in backend route at `/api/tax` for programmatic tax calculations.

---

## 🛠️ Project Structure

```
taxkatha/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── tax/
│   │   │       └── route.ts       # Backend Node.js API (POST /api/tax, GET /api/tax)
│   │   ├── globals.css            # Tailwind CSS styling & themes
│   │   ├── layout.tsx             # Root layout with fonts & metadata
│   │   └── page.tsx               # Main landing & dashboard page
│   └── components/
│       ├── ApiTester.tsx          # Live in-browser API explorer
│       ├── Features.tsx           # Feature showcase grid
│       ├── Footer.tsx             # App footer & quick links
│       ├── Navbar.tsx             # Navigation header
│       └── TaxCalculator.tsx      # Interactive tax calculator & slider
├── public/                        # Static assets & icons
├── package.json                   # Dependencies & build scripts
├── tsconfig.json                  # TypeScript configuration
└── next.config.ts                 # Next.js configuration
```

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Build for Production
```bash
npm run build
npm run start
```

---

## 📡 API Reference

### `POST /api/tax`
Computes tax liability given gross income, regime, and deductions.

#### Request Body
```json
{
  "annualIncome": 1200000,
  "regime": "new",
  "deductions": 0
}
```

#### Response Example
```json
{
  "status": "success",
  "data": {
    "annualIncome": 1200000,
    "taxableIncome": 1125000,
    "baseTax": 65000,
    "healthAndEducationCess": 2600,
    "totalTaxPayable": 67600,
    "effectiveTaxRate": "5.63%",
    "regime": "new",
    "timestamp": "2026-10-04T10:48:00.000Z"
  }
}
```
