import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./completion.css";
import "./market-insights.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://redvitalia.srv1480016.hstgr.cloud"),
  title: "Inteligencia Mundial de Captación · RedVitalia",
  description:
    "712 fichas empresariales estructuradas, cobertura territorial mundial, mapa 3D, precios, anuncios y evidencias públicas con límites documentados.",
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
      "Mapa 3D territorial, fichas estructuradas, precios, anuncios y evidencia competitiva con trazabilidad.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
