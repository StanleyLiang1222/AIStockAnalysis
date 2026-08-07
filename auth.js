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
      if (!user?.email) return '/access-denied?reason=not-whitelisted';
      try {
        await ensureSchema();
        const allowed = await isEmailAllowed(user.email);
        return allowed ? true : '/access-denied?reason=not-whitelisted';
      } catch (err) {
        console.error('[signIn] 資料庫連線失敗', err);
        return '/access-denied?reason=db-down';
      }
    },
    async session({ session }) {
      return session;
    },
  },
});
