import { ImageResponse } from "next/og";

export const alt = "TransitLab route intelligence studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 82px",
        color: "#fffdf8",
        background: "#111923",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            width: 72,
            height: 72,
            alignItems: "center",
            justifyContent: "center",
            color: "#111923",
            background: "#f0c75e",
            borderRadius: "18px 18px 18px 4px",
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          TL
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          TransitLab
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 930,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-0.055em",
          }}
        >
          Route intelligence, under pressure.
        </div>
        <div
          style={{
            display: "flex",
            color: "#a9b5bc",
            fontSize: 28,
            lineHeight: 1.35,
          }}
        >
          Compare Dijkstra and A* while closures, delays, transfers, and
          accessibility reshape the graph.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            width: 260,
            height: 8,
            background: "#e85d3f",
            borderRadius: 99,
          }}
        />
        <div
          style={{
            display: "flex",
            width: 170,
            height: 8,
            background: "#2a9d8f",
            borderRadius: 99,
          }}
        />
        <div
          style={{
            display: "flex",
            width: 110,
            height: 8,
            background: "#f0c75e",
            borderRadius: 99,
          }}
        />
        <div
          style={{
            display: "flex",
            width: 70,
            height: 8,
            background: "#8067b7",
            borderRadius: 99,
          }}
        />
      </div>
    </div>,
    size,
  );
}
