const CONSENT_KEY = "lyceum:smart-source-search";

export type SmartSearchConsent = "granted" | "declined" | null;

export function readSmartSearchConsent(): SmartSearchConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function writeSmartSearchConsent(value: Exclude<SmartSearchConsent, null>) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Without storage the question is simply asked again next time.
  }
}
