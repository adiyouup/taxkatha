import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the seal on brand navy. */
export default async function AppleIcon() {
  const svg = await readFile(join(process.cwd(), "public/brand/taxkatha-mark-reverse.svg"), "utf8");
  const mark = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0A1F44" }}>
        <img src={mark} width={148} height={148} alt="" />
      </div>
    ),
    size,
  );
}
