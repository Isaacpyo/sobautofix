type RecoveryError = {
  code?: string;
  status?: number;
};

const GENERIC_RECOVERY_ERROR = "We couldn't send the reset email. Please try again shortly.";
const RATE_LIMIT_RECOVERY_ERROR = "Please wait before requesting another reset email.";

export function getRecoveryErrorMessage(error: RecoveryError | null): string {
  if (error?.status === 429 || error?.code === "over_email_send_rate_limit") {
    return RATE_LIMIT_RECOVERY_ERROR;
  }

  return GENERIC_RECOVERY_ERROR;
}
