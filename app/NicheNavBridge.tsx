"use client";

import { useEffect } from "react";

const shouldOpenNichos = () => {
  if (window.location.pathname !== "/") return false;
  return new URLSearchParams(window.location.search).get("vista") === "verticals";
};

export default function NicheNavBridge() {
  useEffect(() => {
    if (shouldOpenNichos()) {
      window.location.replace("/nichos");
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const button = target?.closest(".sidebar nav button");
      if (!(button instanceof HTMLButtonElement)) return;

      const label = button.querySelector("span")?.textContent?.trim();
      if (label !== "Nichos") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.location.assign("/nichos");
    };

    const handlePopState = () => {
      if (shouldOpenNichos()) window.location.replace("/nichos");
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}
