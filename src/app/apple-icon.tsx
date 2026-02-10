import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: "34px",
          position: "relative",
        }}
      >
        {/* Thread */}
        <div
          style={{
            position: "absolute",
            width: "143px",
            height: "3px",
            background: "#353845",
            transform: "rotate(-45deg)",
            borderRadius: "2px",
          }}
        />
        {/* Green bead (bottom-left) */}
        <div
          style={{
            position: "absolute",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background: "#22c55e",
            left: "14px",
            bottom: "14px",
          }}
        />
        {/* Amber bead (center) */}
        <div
          style={{
            position: "absolute",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background: "#f59e0b",
          }}
        />
        {/* Blue bead (top-right) */}
        <div
          style={{
            position: "absolute",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background: "#3b82f6",
            right: "14px",
            top: "14px",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
