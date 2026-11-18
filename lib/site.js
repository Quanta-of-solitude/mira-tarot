// Business details shown on the legal pages, from server-side environment variables.
// SUPPORT_EMAIL falls back to the address in EMAIL_FROM ("Mira <hello@example.com>" or "hello@example.com").
const fromAddress = () => (process.env.EMAIL_FROM || "").match(/[^\s<>]+@[^\s<>]+/)?.[0] || "";

export const site = {
  get supportEmail() { return (process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || fromAddress()).trim() || null; },
  get owner() { return (process.env.BUSINESS_NAME || "").trim() || null; },
  get address() { return (process.env.BUSINESS_ADDRESS || "").trim() || null; },
  get phone() { return (process.env.BUSINESS_PHONE || "").trim() || null; },
};
