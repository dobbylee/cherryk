import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "CherryK — Learn Korean with clarity";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(
    path.join(process.cwd(), "public/brand/cherryk-mark-512.png"),
  );
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background:
          "linear-gradient(135deg, #f5f8f8 0%, #edf7f8 58%, #fff2eb 100%)",
        color: "#16313b",
        display: "flex",
        height: "100%",
        justifyContent: "space-between",
        overflow: "hidden",
        padding: "72px 84px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "rgba(8, 123, 147, 0.08)",
          borderRadius: 999,
          display: "flex",
          height: 460,
          position: "absolute",
          right: -120,
          top: -150,
          width: 460,
        }}
      />
      <div
        style={{
          background: "rgba(217, 92, 98, 0.08)",
          borderRadius: 999,
          bottom: -180,
          display: "flex",
          height: 420,
          left: 380,
          position: "absolute",
          width: 420,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: 650,
        }}
      >
        <div
          style={{
            color: "#087b93",
            display: "flex",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          CherryK
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: "-0.055em",
            lineHeight: 0.98,
            marginTop: 28,
          }}
        >
          <div style={{ display: "flex" }}>Learn Korean</div>
          <div style={{ display: "flex" }}>with clarity.</div>
        </div>
        <div
          style={{
            color: "#5d7078",
            display: "flex",
            fontSize: 27,
            marginTop: 34,
          }}
        >
          Write · Review · Practice
        </div>
        <div
          style={{
            color: "#34525d",
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            marginTop: 58,
          }}
        >
          cherryk.kr
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.78)",
          border: "2px solid #d7e2e4",
          borderRadius: 64,
          display: "flex",
          height: 390,
          justifyContent: "center",
          position: "relative",
          width: 390,
        }}
      >
        <img alt="" height={320} src={logoSrc} width={320} />
      </div>
    </div>,
    size,
  );
}
