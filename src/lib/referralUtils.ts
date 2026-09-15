const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export const REFERRAL_STORAGE_KEY = "duogo_referral_code";

export function storeReferralCode(code: string) {
  localStorage.setItem(REFERRAL_STORAGE_KEY, code);
}

export function getStoredReferralCode(): string | null {
  return localStorage.getItem(REFERRAL_STORAGE_KEY);
}

export function clearStoredReferralCode() {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}
