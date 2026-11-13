const sign = "\n\nSquaremeter by CW\nLagos land prices, plots and reports";
const first = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

export function confirmEmail({ name, link, role }) {
  const after = role === "agent"
    ? "Once your email is confirmed, CW reviews agent accounts before they are switched on. We will email you when yours is approved."
    : "Once your email is confirmed you can sign in straight away.";
  return {
    subject: "Confirm your email for Squaremeter",
    text: `Hello ${first(name)},\n\nPlease confirm this email address to finish setting up your Squaremeter account:\n\n${link}\n\nThe link works once and expires in 24 hours. ${after}\n\nIf you did not sign up, you can ignore this email.${sign}`
  };
}

export function resetEmail({ name, link }) {
  return {
    subject: "Reset your Squaremeter password",
    text: `Hello ${first(name)},\n\nUse this link to choose a new password:\n\n${link}\n\nThe link works once and expires in 60 minutes. If you did not ask for it, you can ignore this email and your password stays the same.${sign}`
  };
}

export function alreadyRegisteredEmail({ name, loginLink, resetLink }) {
  return {
    subject: "You already have a Squaremeter account",
    text: `Hello ${first(name)},\n\nSomeone tried to sign up with this email address, but it already has an account.\n\nSign in: ${loginLink}\nForgot your password: ${resetLink}\n\nIf this was not you, there is nothing you need to do.${sign}`
  };
}

export function approvedEmail({ name, loginLink }) {
  return {
    subject: "Your Squaremeter agent account is approved",
    text: `Hello ${first(name)},\n\nCW has approved your agent account. You can now sign in:\n\n${loginLink}${sign}`
  };
}
