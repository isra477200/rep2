import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./completion.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://redvitalia.srv1480016.hstgr.cloud"),
  title: "Radar Mundial de Captación · RedVitalia",
  description:
    "712 fichas empresariales, 195 países, mapa 3D, precios, anuncios y evidencias públicas en el portal de inteligencia competitiva de RedVitalia.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    title: "Radar Mundial de Captación · RedVitalia",
    description:
      "El mercado mundial de captación, geolocalizado y convertido en una sala de mando estratégica.",
    images: [
      {
        url: "/og.png",
        width: 1792,
        height: 935,
        alt: "Radar Mundial de Captación de RedVitalia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Radar Mundial de Captación · RedVitalia",
    description:
      "Mapa 3D, fichas completas, precios, anuncios y evidencia competitiva mundial.",
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
