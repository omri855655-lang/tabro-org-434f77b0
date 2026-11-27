// Match the provider's Primary inbox and keep the scope on stored metadata.
export const GMAIL_PRIMARY_QUERY = "in:inbox category:primary";

export function isPrimaryInboxMail(row: { suggested_action?: unknown }) {
  const action = row.suggested_action;
  return !!action && typeof action === "object" && "gmailFolder" in action && action.gmailFolder === "primary";
}
