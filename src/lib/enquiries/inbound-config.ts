import "server-only";

const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function getEnquiryReplyDomain() {
  const domain = (process.env.ENQUIRY_REPLY_DOMAIN || process.env.RESEND_INBOUND_DOMAIN)?.trim().toLowerCase();
  return domain && domainPattern.test(domain) ? domain : null;
}

export function getCloudflareInboundConfig() {
  const replyDomain = getEnquiryReplyDomain();
  const webhookSecret = process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET?.trim();
  if (!replyDomain || !webhookSecret || webhookSecret.length < 32) return null;
  return { replyDomain, webhookSecret };
}
