import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
  redirect("/nichos-redvitalia.html");
}
