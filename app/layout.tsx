import type { Metadata } from "next";

import NicheNavBridge from "./NicheNavBridge";
import ContactBridge from "./ContactBridge";
import "./globals.css";
import "./completion.css";
import "./market-insights.css";
import "./typography.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://redvitalia.srv1480016.hstgr.cloud"),
  title: "Inteligencia Mundial de Captación · RedVitalia",
  description:
    "Fichas empresariales estructuradas, cobertura territorial mundial, precios, anuncios y evidencias públicas con límites documentados.",
  icons: { icon: "/favicon.svg" },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    title: "Inteligencia Mundial de Captación · RedVitalia",
    description:
      "Inteligencia competitiva mundial con ubicación territorial, funnel comercial, evidencia pública y nivel de verificación visible.",
    images: [
      {
        url: "/og.png",
        width: 1792,
        height: 935,
        alt: "Inteligencia Mundial de Captación de RedVitalia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inteligencia Mundial de Captación · RedVitalia",
    description:
      "Fichas estructuradas, cobertura por países, precios, anuncios y evidencia competitiva con trazabilidad.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body >
        <NicheNavBridge />
        <ContactBridge />
        {children}
      </body>
    </html>
  );
}
