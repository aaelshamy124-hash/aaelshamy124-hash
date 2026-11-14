import fs from "node:fs";
import path from "node:path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const firebaseConfigPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8")) as {
  projectId: string;
  apiKey: string;
};

const ADMIN_EMAILS = new Set(["aaelshamy124@gmail.com"]);

let adminInitialized = false;
function ensureFirebaseAdmin() {
  if (!adminInitialized && getApps().length === 0) {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
    adminInitialized = true;
  }
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: "ADMIN" | "MANAGER";
}

/**
 * Verifies a Firebase ID token cleanly via firebase-admin when ADC credentials
 * exist, or via Google Identity Toolkit accounts:lookup using the project API key.
 */
export async function verifyFirebaseBearerToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || idToken.trim().length < 20) return null;

  try {
    ensureFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(idToken);
    const email = (decoded.email || "").toLowerCase();
    const emailVerified = Boolean(decoded.email_verified);
    if (!decoded.uid || !email || !emailVerified) {
      return null;
    }
    return {
      uid: decoded.uid,
      email,
      name: decoded.name || email.split("@")[0],
      emailVerified,
      role: ADMIN_EMAILS.has(email) ? "ADMIN" : "MANAGER",
    };
  } catch (adminErr: any) {
    // Fallback to Identity Toolkit token lookup when local ADC credentials aren't mounted
    try {
      const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        }
      );
      if (!resp.ok) return null;
      const payload = (await resp.json()) as {
        users?: Array<{
          localId?: string;
          email?: string;
          displayName?: string;
          emailVerified?: boolean;
        }>;
      };
      const user = payload.users?.[0];
      if (!user?.localId || !user.email || !user.emailVerified) {
        return null;
      }
      const email = user.email.toLowerCase();
      return {
        uid: user.localId,
        email,
        name: user.displayName || email.split("@")[0],
        emailVerified: true,
        role: ADMIN_EMAILS.has(email) ? "ADMIN" : "MANAGER",
      };
    } catch {
      console.warn("[FirebaseAuth] Token verification failed:", adminErr?.message || "Invalid token");
      return null;
    }
  }
}
