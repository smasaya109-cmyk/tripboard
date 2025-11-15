'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from "@/components/ui/LoadingScreen";

type Trip = {
  id: string;
  owner_id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export default function TripsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 新規旅行フォーム
  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // 初期ロード：ユーザー確認＆旅行一覧取得
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.push('/login');
        return;
      }

      const user = data.user;
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      // プロフィール upsert（存在しなければ作成＆emailを保存）
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email, // 追加
          },
          { onConflict: 'id' }
        );


      // 自分が owner の旅行一覧を取得
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (tripsError) {
        console.error(tripsError);
        setError('旅行一覧の取得に失敗しました');
      } else {
        setTrips((tripsData ?? []) as Trip[]);
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!newTitle.trim()) {
      setError('タイトルは必須です');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // trips に挿入
      const { data, error } = await supabase
        .from('trips')
        .insert({
          owner_id: userId,
          title: newTitle.trim(),
          start_date: newStartDate || null,
          end_date: newEndDate || null,
          description: newDescription || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newTrip = data as Trip;

      // trip_members に owner として登録
      await supabase.from('trip_members').insert({
        trip_id: newTrip.id,
        user_id: userId,
        role: 'owner',
      });

      // state に反映
      setTrips((prev) => [newTrip, ...prev]);

      // フォームリセット
      setNewTitle('');
      setNewStartDate('');
      setNewEndDate('');
      setNewDescription('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '旅行の作成に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
  return <LoadingScreen message="旅行一覧を読み込み中です…" />;
}

  return (
    <main className="min-h-screen bg-slate-100">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur border-b border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            旅行一覧
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ログイン中: {userEmail}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          ログアウト
        </Button>
      </header>

      {/* コンテンツ */}
      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {/* エラー表示 */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 新規旅行作成 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            新しい旅行を作成
          </h2>
          <form className="space-y-4" onSubmit={handleCreateTrip}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                タイトル *
              </label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例：沖縄 2泊3日 友達旅行"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  終了日
                </label>
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                メモ
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="旅行の目的やざっくりしたイメージなど"
              />
            </div>

            <Button type="submit" disabled={creating} fullWidth className="mt-2">
              {creating ? '作成中...' : '旅行を作成'}
            </Button>
          </form>
        </Card>

        {/* 旅行一覧 */}
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            あなたの旅行
          </h2>

          {trips.length === 0 ? (
            <p className="text-sm text-slate-500">
              まだ旅行がありません。上のフォームから作成してみてください。
            </p>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <Card
                  key={trip.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/trips/${trip.id}`)}
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {trip.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {trip.start_date && trip.end_date
                        ? `${trip.start_date} 〜 ${trip.end_date}`
                        : '日程未設定'}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    詳細を開く
                  </span>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
