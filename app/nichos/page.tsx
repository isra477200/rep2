import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nichos · Inteligencia Mundial de Captación · RedVitalia",
  description:
    "Sistemas verticales de RedVitalia conectados con las fichas de competencia del mercado.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function NichosPage() {
  return (
    <iframe
      title="Nichos y competencia · RedVitalia"
      src="/nichos-redvitalia.html"
      style={{
        display: "block",
        width: "100%",
        height: "100dvh",
        border: 0,
        background: "#f7f9fc",
      }}
    />
  );
}
