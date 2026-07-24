import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { ensureSchema, isEmailAllowed } from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: '/login',
    error: '/access-denied',
  },
  callbacks: {
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
