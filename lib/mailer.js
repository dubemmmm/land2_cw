// Sends through Resend when RESEND_API_KEY is set. Without it (local work) the
// message is printed in the server log so links can still be followed.
export async function sendMail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Squaremeter by CW <no-reply@cwlagos.com>";
  if (!key) {
    const notice = process.env.VERCEL ? "RESEND_API_KEY is not set, so this email was NOT sent." : "No RESEND_API_KEY: email printed instead of sent.";
    console.log(`\n[mail] ${notice}\n[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text })
    });
    if (!response.ok) {
      console.error(`[mail] Resend refused the message (${response.status}): ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[mail] Could not reach Resend:", error);
    return false;
  }
}

// Base address for links in emails. APP_URL wins; otherwise the address the request came in on.
export function siteUrl(request) {
  const configured = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || (String(host).startsWith("localhost") || String(host).startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
