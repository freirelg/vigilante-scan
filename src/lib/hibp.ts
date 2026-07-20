// Have I Been Pwned - Pwned Passwords API (k-anonymity)
// https://haveibeenpwned.com/API/v3#PwnedPasswords
// Nunca envia a senha - só os 5 primeiros caracteres do hash SHA-1.

async function sha1Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export interface PwnedResult {
  pwned: boolean;
  count: number;
}

export async function checkPasswordPwned(password: string): Promise<PwnedResult> {
  if (!password) return { pwned: false, count: 0 };
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!res.ok) throw new Error(`HIBP error: ${res.status}`);

  const text = await res.text();
  for (const line of text.split("\n")) {
    const [suf, countStr] = line.trim().split(":");
    if (suf === suffix) {
      return { pwned: true, count: parseInt(countStr, 10) || 0 };
    }
  }
  return { pwned: false, count: 0 };
}
