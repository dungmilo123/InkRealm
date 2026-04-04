import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { encode as defaultEncode } from "next-auth/jwt";

import { normalizeEmail } from "@/app/lib/auth-validation";

const adapter = PrismaAdapter(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  providers: [
    Google,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email as string;
        const password = credentials?.password as string;
        if (!rawEmail || !password) return null;

        const email = normalizeEmail(rawEmail);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth, check for conflicts with password-only accounts
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: { where: { provider: "google" } } },
        });

        // If user exists with a password but no Google account linked, block sign-in
        if (
          existing &&
          existing.passwordHash &&
          existing.accounts.length === 0
        ) {
          return "/login?error=OAuthAccountConflict";
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      // When signing in with credentials, create a database session
      // and attach the session token so jwt.encode can return it
      if (account?.provider === "credentials" && user?.id) {
        const sessionToken = randomUUID();
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await adapter.createSession!({
          sessionToken,
          userId: user.id,
          expires,
        });

        token.sessionToken = sessionToken;
      }

      return token;
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  jwt: {
    // Override encode: if we have a credentials sessionToken, return it
    // directly so the cookie holds a database session token (not a JWT)
    async encode({ token, ...rest }) {
      if (token?.sessionToken) {
        return token.sessionToken as string;
      }
      return defaultEncode({ token, ...rest });
    },
  },
});
