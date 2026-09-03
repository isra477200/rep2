import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LandingBlueprintView from "./LandingBlueprintView";
import { getLandingBlueprint, LANDING_BLUEPRINTS } from "../../ejecucion/landing-blueprints";

type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => LANDING_BLUEPRINTS.map((item) => ({ slug: item.slug }));

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params;
  const blueprint = getLandingBlueprint(slug);
  if (!blueprint) return { title: "Landing no encontrada · RedVitalia" };
  return {
    title: `${blueprint.name} · RedVitalia`,
    description: `Propuesta interna no publicada para ${blueprint.name}.`,
    robots: { index: false, follow: false, noarchive: true },
  };
};

export default async function LandingBlueprintPage({ params }: Props) {
  const { slug } = await params;
  const blueprint = getLandingBlueprint(slug);
  if (!blueprint) notFound();
  return <LandingBlueprintView blueprint={blueprint} />;
}
