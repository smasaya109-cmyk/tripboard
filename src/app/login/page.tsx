'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }

      // 成功したら trips ページへ
      router.push('/trips');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          {mode === 'login' ? 'ログイン' : '新規登録'}
        </h1>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-medium py-2.5 disabled:opacity-50"
          >
            {loading
              ? '処理中...'
              : mode === 'login'
              ? 'ログイン'
              : '新規登録'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {mode === 'login' ? (
            <>
              アカウントがありませんか？{' '}
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => setMode('signup')}
              >
                新規登録
              </button>
            </>
          ) : (
            <>
              すでにアカウントをお持ちですか？{' '}
              <button
                type="button"
                className="text-blue-600 underline"
                onClick={() => setMode('login')}
              >
                ログイン
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
