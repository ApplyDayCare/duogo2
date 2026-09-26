import Clarity from "@microsoft/clarity";

let clarityInitialized = false;

export const initClarity = () => {
  if (clarityInitialized) return;

  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID || "yo2o477fvk";
  if (!projectId) {
    return;
  }

  try {
    Clarity.init(projectId);
    clarityInitialized = true;
  } catch (err) {
    console.warn("Failed to initialize Microsoft Clarity:", err);
  }
};

export const identifyClarityUser = (customId: string, friendlyName?: string) => {
  if (!clarityInitialized) return;
  try {
    Clarity.identify(customId, undefined, undefined, friendlyName);
  } catch (err) {
    console.warn("Failed to identify user in Microsoft Clarity:", err);
  }
};

export const setClarityTag = (key: string, value: string | string[]) => {
  if (!clarityInitialized) return;
  try {
    Clarity.setTag(key, value);
  } catch (err) {
    console.warn("Failed to set Microsoft Clarity tag:", err);
  }
};

export { Clarity };
