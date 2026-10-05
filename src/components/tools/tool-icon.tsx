import {
  ArrowDownToLine,
  BriefcaseBusiness,
  CalendarClock,
  Car,
  ChartNoAxesCombined,
  Coins,
  Flower2,
  Gift,
  House,
  Landmark,
  Percent,
  ReceiptIndianRupee,
  ShieldCheck,
  Sunset,
  TrendingUp,
  Vault,
  Wallet,
  Warehouse,
  ChartColumnIncreasing,
  type LucideIcon,
} from "lucide-react";

import type { ToolIcon as Name } from "@/lib/tools/registry";

const ICONS: Record<Name, LucideIcon> = {
  receipt: ReceiptIndianRupee,
  percent: Percent,
  home: Warehouse,
  gift: Gift,
  landmark: Landmark,
  house: House,
  car: Car,
  wallet: Wallet,
  trending: TrendingUp,
  stairs: ChartColumnIncreasing,
  coins: Coins,
  "arrow-down": ArrowDownToLine,
  chart: ChartNoAxesCombined,
  vault: Vault,
  calendar: CalendarClock,
  shield: ShieldCheck,
  flower: Flower2,
  briefcase: BriefcaseBusiness,
  sunset: Sunset,
};

export function ToolIcon({ name, className }: { name: Name; className?: string }) {
  const Icon = ICONS[name];
  return <Icon strokeWidth={1.5} className={className} aria-hidden />;
}
