/*
 * GST on a price. Since 22 September 2025 ("GST 2.0") the main rates are
 * nil, 5%, 18% and 40% (luxury and sin goods); 3% (gold, silver) and 0.25%
 * (rough diamonds) remain for precious items.
 */

export const GST_RATES = [0, 0.25, 3, 5, 18, 40] as const;

export type GstMode = "add" | "remove";
export type SupplyType = "intra" | "inter";

/**
 * `add`: the amount excludes GST. `remove`: the amount already includes GST.
 * Within a state the tax splits equally into CGST and SGST; between states it is IGST.
 */
export function gst({ amount, rate, mode, supply }: { amount: number; rate: number; mode: GstMode; supply: SupplyType }) {
  const net = mode === "add" ? amount : amount / (1 + rate / 100);
  const tax = (net * rate) / 100;
  const gross = net + tax;
  return { net, tax, gross, cgst: supply === "intra" ? tax / 2 : 0, sgst: supply === "intra" ? tax / 2 : 0, igst: supply === "inter" ? tax : 0 };
}
