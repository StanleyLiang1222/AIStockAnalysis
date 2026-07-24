import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { authConfig } from '@/auth.config';
import { ensureSchema, isEmailAllowed } from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [Google],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user?.email) return false;
      await ensureSchema();
      const allowed = await isEmailAllowed(user.email);
      return allowed;
    },
    async session({ session }) {
      return session;
    },
  },
});
