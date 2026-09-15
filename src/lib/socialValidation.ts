/**
 * Validates a social profile URL for Instagram or LinkedIn.
 * Accepts full URLs like:
 *  - https://instagram.com/handle
 *  - https://www.instagram.com/handle
 *  - https://linkedin.com/in/slug
 *  - https://www.linkedin.com/in/slug
 */

const INSTAGRAM_URL_RE = /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]{1,30}\/?$/i;
const LINKEDIN_URL_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]{3,100}\/?$/i;

export function validateSocialUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Please enter your Instagram or LinkedIn profile URL.";
  if (INSTAGRAM_URL_RE.test(value)) return null;
  if (LINKEDIN_URL_RE.test(value)) return null;
  return "Enter a valid Instagram or LinkedIn profile URL (e.g. https://instagram.com/yourhandle or https://linkedin.com/in/your-slug).";
}

// Keep old exports for backward compat during migration
export function parseSocialHandle(raw: string): string {
  let value = raw.trim();
  if (value.startsWith("@")) value = value.slice(1);
  const igMatch = value.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]+)/i);
  if (igMatch) return igMatch[1];
  const liMatch = value.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i);
  if (liMatch) return liMatch[1];
  return value;
}

export function validateSocialHandle(raw: string): string | null {
  return validateSocialUrl(raw);
}
