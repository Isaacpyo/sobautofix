import "server-only";

import { emailLayout, notice, plainTextFooter, type RenderedEmail } from "./components";

export function renderPasswordReset(input: { actionUrl: string }): RenderedEmail {
  return {
    html: emailLayout({
      preheader: "Use this secure link to reset your SOB Autofix admin password.",
      status: "PASSWORD RESET",
      tone: "warning",
      title: "Reset your SOB Autofix admin password",
      intro: "We received a request to reset the password for your SOB Autofix administration account.",
      contentHtml: notice("Authorised administrators only", "This secure link is intended only for the authorised administrator. If you did not request this reset, you can ignore this email."),
      cta: { label: "Reset password", url: input.actionUrl },
    }),
    text: ["SOB AUTOFIX", "", "PASSWORD RESET", "", "Reset your SOB Autofix admin password", "", "We received a request to reset the password for your SOB Autofix administration account.", "", `Reset password: ${input.actionUrl}`, "", "This link is intended only for the authorised administrator. If you did not request this reset, you can ignore this email.", plainTextFooter()].join("\n"),
  };
}

export function renderPasswordChanged(): RenderedEmail {
  return {
    html: emailLayout({
      preheader: "Your SOB Autofix admin password was changed successfully.",
      status: "SECURITY NOTICE",
      tone: "success",
      title: "Password updated",
      intro: "Your SOB Autofix admin password was changed successfully.",
      contentHtml: notice("No action is needed if this was you", "If you did not make this change, contact the system administrator immediately."),
    }),
    text: ["SOB AUTOFIX", "", "PASSWORD UPDATED", "", "Your SOB Autofix admin password was changed successfully.", "", "If you made this change, no further action is required.", "If you did not make this change, contact the system administrator immediately.", plainTextFooter()].join("\n"),
  };
}

export function renderStaffInvite(input: { name: string; invitedBy: string; roleLabel: string; actionUrl: string }): RenderedEmail {
  const intro = `${input.invitedBy} has given you access to the SOB Autofix admin as ${input.roleLabel}. Choose a password to finish setting up your account.`;
  const expiry = "The link works once and expires after a short time. If it has expired, ask for a new invite.";
  return {
    html: emailLayout({
      preheader: "Set up your SOB Autofix admin account.",
      status: "STAFF INVITE",
      tone: "info",
      title: `Welcome, ${input.name}`,
      intro,
      contentHtml: notice("Keep this link to yourself", `It signs you in to set your password. ${expiry}`),
      cta: { label: "Set your password", url: input.actionUrl },
      afterCta: "After setting your password, sign in at sobautofix.com/admin. You may be asked to set up two-step verification.",
    }),
    text: ["SOB AUTOFIX", "", "STAFF INVITE", "", `Welcome, ${input.name}`, "", intro, "", `Set your password: ${input.actionUrl}`, "", `Keep this link to yourself. ${expiry}`, "", "After setting your password, sign in at sobautofix.com/admin. You may be asked to set up two-step verification.", plainTextFooter()].join("\n"),
  };
}
