import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { upsertUser, consumeLoginCode } from "@/lib/store";
import { hashCode, normEmail } from "@/lib/logincode";

const dev = process.env.NODE_ENV !== "production";
const admins = () => (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const same = (x, y) => { const a = createHash("sha256").update(String(x)).digest(), b = createHash("sha256").update(String(y)).digest(); return timingSafeEqual(a, b); };

// Sign-in is by email: we send a 6-digit code, the user types it back.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "email-code",
      name: "Email code",
      credentials: { email: {}, code: {} },
      authorize: async (c) => {
        const email = normEmail(c?.email), code = String(c?.code || "").replace(/\D/g, "");
        if (!email || code.length !== 6) return null;
        const ok = await consumeLoginCode(email, hashCode(email, code));
        return ok ? { id: email, email, name: email.split("@")[0] } : null;
      },
    }),
    // Owner sign-in without email: an admin email plus the secret ADMIN_KEY. Works even before email is set up.
    Credentials({
      id: "admin-key",
      name: "Admin key",
      credentials: { email: {}, key: {} },
      authorize: async (c) => {
        const email = normEmail(c?.email), key = String(c?.key || "");
        if (!email || !process.env.ADMIN_KEY || process.env.ADMIN_KEY.length < 16) return null;
        if (!admins().includes(email) || !same(key, process.env.ADMIN_KEY)) return null;
        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 },
  trustHost: true,
  secret: process.env.AUTH_SECRET || (dev ? "dev-only-secret-not-for-production" : undefined),
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        const deviceId = (await cookies()).get("mira_device")?.value;
        const u = await upsertUser({ email: user.email.toLowerCase(), name: null, image: null, deviceId });
        token.uid = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid;
      return session;
    },
  },
});
