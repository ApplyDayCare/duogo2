import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { posthog } from "@/lib/posthog";

export const PostHogPageView = () => {
  const location = useLocation();

  useEffect(() => {
    // Only capture if posthog is initialized and active
    if (typeof window !== "undefined" && import.meta.env.VITE_POSTHOG_KEY) {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
        pathname: location.pathname,
        search: location.search,
      });
    }
  }, [location]);

  return null;
};
