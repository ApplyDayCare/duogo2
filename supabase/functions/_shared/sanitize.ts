// Shared helpers to safely embed user-controlled values in HTML emails.

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip markup/control characters from plain-text fields (names) and cap length.
export function safeName(input: unknown, fallback = "User"): string {
  const raw = (input ?? "").toString().replace(/[<>&"'`\u0000-\u001F\u007F]/g, "").trim();
  const cleaned = raw.slice(0, 60).trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

const ALLOWED_SOCIAL_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",
];

// Re-validate a social link server-side. Returns a safe absolute URL or null.
export function safeSocialUrl(input: unknown): string | null {
  if (!input) return null;
  let value = String(input).trim();
  if (value.length === 0 || value.length > 300) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!ALLOWED_SOCIAL_HOSTS.includes(url.hostname.toLowerCase())) return null;
  if (!/^[A-Za-z0-9/\-._~%]*$/.test(url.pathname)) return null;

  url.protocol = "https:";
  url.username = "";
  url.password = "";
  url.hash = "";
  url.search = "";
  return url.toString();
}
