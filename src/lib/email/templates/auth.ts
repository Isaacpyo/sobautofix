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
