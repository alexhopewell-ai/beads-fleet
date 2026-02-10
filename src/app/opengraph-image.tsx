import { ImageResponse } from "next/og";

export const alt = "Beads Web - Issue Tracker Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f1117",
          fontFamily: "sans-serif",
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: "120px",
            height: "120px",
            marginRight: "40px",
          }}
        >
          {/* Thread */}
          <div
            style={{
              position: "absolute",
              width: "96px",
              height: "3px",
              background: "#353845",
              transform: "rotate(-45deg)",
              borderRadius: "2px",
            }}
          />
          {/* Green bead */}
          <div
            style={{
              position: "absolute",
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "#22c55e",
              left: "9px",
              bottom: "9px",
            }}
          />
          {/* Amber bead */}
          <div
            style={{
              position: "absolute",
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "#f59e0b",
            }}
          />
          {/* Blue bead */}
          <div
            style={{
              position: "absolute",
              width: "34px",
              height: "34px",
              borderRadius: "50%",
              background: "#3b82f6",
              right: "9px",
              top: "9px",
            }}
          />
        </div>
        {/* Text */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#f3f4f6",
              letterSpacing: "-2px",
            }}
          >
            Beads Web
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#6b7280",
              marginTop: "8px",
            }}
          >
            Issue Tracker Dashboard
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
