import posthog from "posthog-js";

let posthogInitialized = false;

export const initPostHog = () => {
  if (posthogInitialized) return;

  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const posthogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!posthogKey) {
    return;
  }

  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: "identified_only",
      capture_pageview: false, // Captured manually on route change in SPA
      capture_pageleave: true,
      autocapture: true,
    });
    posthogInitialized = true;
  } catch (err) {
    console.warn("Failed to initialize PostHog:", err);
  }
};

export const identifyUser = (userId: string, traits?: Record<string, unknown>) => {
  if (!posthogInitialized) return;
  try {
    posthog.identify(userId, traits);
  } catch (err) {
    console.warn("Failed to identify user in PostHog:", err);
  }
};

export const resetUser = () => {
  if (!posthogInitialized) return;
  try {
    posthog.reset();
  } catch (err) {
    console.warn("Failed to reset user in PostHog:", err);
  }
};

export const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
  if (!posthogInitialized) return;
  try {
    posthog.capture(eventName, properties);
  } catch (err) {
    console.warn("Failed to track PostHog event:", err);
  }
};

export const getActiveSurveys = (callback: (surveys: unknown[]) => void) => {
  if (!posthogInitialized) return;
  try {
    posthog.getActiveMatchingSurveys((surveys) => {
      callback(surveys);
    });
  } catch (err) {
    console.warn("Failed to get active PostHog surveys:", err);
  }
};

export { posthog };
