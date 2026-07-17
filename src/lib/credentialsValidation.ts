const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_LABEL_PATTERN = /^[a-zA-Z0-9-]+$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmailFormat(email: string): boolean {
  if (!EMAIL_PATTERN.test(email)) return false;

  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;

  const domain = email.slice(at + 1);
  if (domain.includes("..")) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;

  if (!labels.every((label) => label.length > 0 && DOMAIN_LABEL_PATTERN.test(label))) {
    return false;
  }

  const tld = labels[labels.length - 1];
  // Reject likely typos like user@gmail.co (single-label TLD must be 3+ chars).
  if (labels.length === 2 && tld.length < 3) return false;

  return true;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address.";
  if (!isValidEmailFormat(trimmed)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(
  password: string,
  options: { forRegister?: boolean } = {},
): string | null {
  if (!password) return "Enter your password.";

  if (!options.forRegister) return null;

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (password !== password.trim()) {
    return "Password cannot start or end with spaces.";
  }
  if (!/[A-Za-z]/.test(password)) {
    return "Password must include at least one letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }

  return null;
}
