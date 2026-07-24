// Edge-safe 設定：不能匯入任何觸及資料庫（'pg'）的模組，因為 middleware 跑在 Edge runtime。
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/access-denied',
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
};
