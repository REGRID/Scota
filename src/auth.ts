import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, account, profile }) {
      if (account && profile) {
        token.googleId = account.providerAccountId || (profile as any).sub || token.sub
      }
      return token
    },
    session({ session, token }) {
      if (session?.user) {
        if (token?.googleId) {
          (session.user as any).id = token.googleId as string
        } else if (token?.sub) {
          (session.user as any).id = token.sub
        }
      }
      return session
    },
  },
  secret: process.env.AUTH_SECRET || "default_auth_secret_minimum_32_chars_for_local_dev",
  trustHost: true,
})
