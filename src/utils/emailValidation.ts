import { EmailVerificationStatus, EmailVerificationStatusEnum } from "../types";

export const GENERIC_FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "gmx.de",
]);

const SENTINEL_PHRASES = new Set([
  "",
  "n/a",
  "na",
  "none",
  "null",
  "undefined",
  "-",
  "--",
  "not found",
  "not_found",
  "not verified",
  "not_verified",
  "unverified",
  "pending",
  "no email",
  "no verified email",
  "no verified email found",
  "not publicly disclosed",
  "not disclosed",
  "direct procurement email requires b2b outreach or nda",
]);

export type ParsedEmailKind = "NOT_FOUND" | "VALID_SYNTAX" | "INVALID_SYNTAX";

export interface ParsedEmailResult {
  kind: ParsedEmailKind;
  raw: string;
  primaryEmail: string;
  allEmails: string[];
  domain: string;
  isFreeMail: boolean;
  reason: string;
}

export interface EmailVerificationLayerReport {
  rawInput: string;
  emailNormalized: string;
  allEmails: string[];
  domain: string;
  isFreeMail: boolean;
  syntax: {
    valid: boolean;
    reason: string;
  };
  domainMx: {
    checked: boolean;
    reachable: boolean;
    mxVerified: boolean;
    mxHosts: string[];
    hasDnsFallback: boolean;
    reason: string;
  };
  publicSource: {
    confirmed: boolean;
    sourceUrl?: string;
    reason: string;
  };
  mailboxDelivery: {
    status: "NOT_PROBED";
    note: string;
  };
  domainMatch: boolean | null;
  statusEnum: EmailVerificationStatusEnum;
  classification: EmailVerificationStatus;
  checkedAt: string;
}

/**
 * Removes zero-width characters, bidirectional marks, and converts NBSP to regular space.
 */
export function normalizeUnicodeWhitespace(input: string): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

/**
 * Returns true for recognized placeholder/sentinel strings (never valid addresses, never syntax errors).
 */
export function isSentinelEmailValue(raw: string): boolean {
  const cleaned = normalizeUnicodeWhitespace(raw).toLowerCase();
  if (!cleaned) return true;
  if (SENTINEL_PHRASES.has(cleaned)) return true;
  if (
    cleaned.startsWith("no verified email") ||
    cleaned.startsWith("not publicly disclosed") ||
    cleaned.startsWith("unverified") ||
    cleaned.startsWith("direct procurement email requires")
  ) {
    return true;
  }
  return false;
}

function toAsciiDomain(domain: string): string {
  const trimmed = normalizeUnicodeWhitespace(domain).toLowerCase().replace(/\.+$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(`http://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return trimmed;
  }
}

export function isValidDomainSyntax(rawDomain: string): boolean {
  const ascii = toAsciiDomain(rawDomain);
  if (!ascii || ascii.length > 253 || !ascii.includes(".")) return false;
  const labels = ascii.split(".");
  if (labels.length < 2) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
    if (!/^[a-z0-9-]+$/i.test(label)) return false;
  }

  const tld = labels[labels.length - 1];
  if (tld.length < 2) return false;
  if (!/^([a-z]{2,}|xn--[a-z0-9]{2,})$/i.test(tld)) return false;
  return true;
}

export function isValidSingleEmailSyntax(candidate: string): { valid: boolean; normalized: string; domain: string; reason: string } {
  let clean = normalizeUnicodeWhitespace(candidate);
  if (!clean) {
    return { valid: false, normalized: "", domain: "", reason: "Empty email value" };
  }

  // Strip surrounding <...> or mailto:
  if (clean.startsWith("<") && clean.endsWith(">")) {
    clean = clean.slice(1, -1).trim();
  }
  if (clean.toLowerCase().startsWith("mailto:")) {
    clean = clean.slice(7).split("?")[0].trim();
  }
  clean = clean.replace(/^["']|["']$/g, "").trim();

  const atIndex = clean.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === clean.length - 1) {
    return { valid: false, normalized: clean.toLowerCase(), domain: "", reason: "Missing '@' separator or local/domain segment" };
  }

  const localPart = clean.slice(0, atIndex);
  const rawDomain = clean.slice(atIndex + 1);

  if (localPart.length > 64) {
    return { valid: false, normalized: clean.toLowerCase(), domain: "", reason: "Email local-part exceeds 64 characters" };
  }

  // Check quoted vs unquoted local part
  const isQuotedLocal = localPart.startsWith('"') && localPart.endsWith('"') && localPart.length >= 2;
  if (!isQuotedLocal) {
    if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
      return { valid: false, normalized: clean.toLowerCase(), domain: "", reason: "Invalid leading, trailing, or consecutive dots in local-part" };
    }
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) {
      return { valid: false, normalized: clean.toLowerCase(), domain: "", reason: "Local-part contains unsupported characters" };
    }
  }

  const asciiDomain = toAsciiDomain(rawDomain);
  if (!isValidDomainSyntax(asciiDomain)) {
    return { valid: false, normalized: `${localPart.toLowerCase()}@${asciiDomain}`, domain: asciiDomain, reason: `Malformed domain syntax (${rawDomain})` };
  }

  const normalized = `${localPart.toLowerCase()}@${asciiDomain}`;
  return {
    valid: true,
    normalized,
    domain: asciiDomain,
    reason: "RFC-aligned syntax and domain structure valid",
  };
}

/**
 * Extracts and validates emails from display-name headers ("Name <user@domain.com>"),
 * mailto URIs, and multi-address strings ("info@edeka.de / procurement@edeka.de").
 */
export function parseAndNormalizeEmail(rawInput: string): ParsedEmailResult {
  const raw = rawInput ?? "";
  const cleaned = normalizeUnicodeWhitespace(raw);

  if (isSentinelEmailValue(cleaned)) {
    return {
      kind: "NOT_FOUND",
      raw,
      primaryEmail: "",
      allEmails: [],
      domain: "",
      isFreeMail: false,
      reason: "No email address recorded",
    };
  }

  // 1. Extract explicit <email@domain> captures first if present
  const bracketMatches = Array.from(cleaned.matchAll(/<([^<>@\s]+@[^<>\s]+)>/g)).map((m) => m[1]);

  // 2. Split on common multi-email delimiters: / , ; | newlines
  const segments =
    bracketMatches.length > 0
      ? bracketMatches
      : cleaned
          .split(/\s*(?:\/|,|;|\||\n|\r)\s*/)
          .map((seg) => seg.trim())
          .filter(Boolean);

  const validEmails: string[] = [];
  let firstDomain = "";
  let firstFailureReason = "Invalid email format";

  for (const segment of segments) {
    // Handle inline "Display Name <user@domain>" or "mailto:..." per segment
    const innerBracket = segment.match(/<([^<>@\s]+@[^<>\s]+)>/);
    const candidate = innerBracket ? innerBracket[1] : segment;

    const check = isValidSingleEmailSyntax(candidate);
    if (check.valid) {
      if (!validEmails.includes(check.normalized)) {
        validEmails.push(check.normalized);
      }
      if (!firstDomain) firstDomain = check.domain;
    } else {
      firstFailureReason = check.reason;
    }
  }

  if (validEmails.length > 0) {
    const primary = validEmails[0];
    const domain = firstDomain || primary.split("@")[1] || "";
    return {
      kind: "VALID_SYNTAX",
      raw,
      primaryEmail: primary,
      allEmails: validEmails,
      domain,
      isFreeMail: GENERIC_FREE_EMAIL_DOMAINS.has(domain),
      reason: validEmails.length > 1
        ? `Valid syntax (${validEmails.length} addresses parsed cleanly)`
        : "Valid RFC-aligned email syntax",
    };
  }

  // Fallback token scan inside noisy strings (e.g., "Contact: export@company.com (Mon-Fri)")
  const tokenMatch = cleaned.match(/(?:mailto:)?([^\s<>()[\],;:"']+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (tokenMatch) {
    const tokenCheck = isValidSingleEmailSyntax(tokenMatch[1]);
    if (tokenCheck.valid) {
      return {
        kind: "VALID_SYNTAX",
        raw,
        primaryEmail: tokenCheck.normalized,
        allEmails: [tokenCheck.normalized],
        domain: tokenCheck.domain,
        isFreeMail: GENERIC_FREE_EMAIL_DOMAINS.has(tokenCheck.domain),
        reason: "Valid email extracted from formatted string",
      };
    }
  }

  return {
    kind: "INVALID_SYNTAX",
    raw,
    primaryEmail: cleaned.toLowerCase(),
    allEmails: [],
    domain: "",
    isFreeMail: false,
    reason: firstFailureReason,
  };
}
