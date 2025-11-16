'use client';

import { useEffect, useState, FormEvent } from 'react';
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
  share_token: string | null;
  is_share_public: boolean;
};

export default function TripsPage() {
  const router = useRouter();

  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 新規旅行フォーム
  const [newTitle, setNewTitle] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // 共有リンクコピー用
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyingTripId, setCopyingTripId] = useState<string | null>(null);

  // 初期ロード：ユーザー確認＆旅行一覧取得
  useEffect(() => {
  const init = async () => {
    setLoading(true);
    setError(null);

    // ① このブラウザ専用の deviceId を用意
    let storedId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('tripboard_device_id')
        : null;

    if (!storedId && typeof window !== 'undefined') {
      storedId = crypto.randomUUID();
      window.localStorage.setItem('tripboard_device_id', storedId);
    }

    if (!storedId) {
      // ありえないけど一応
      setError('端末IDの取得に失敗しました');
      setLoading(false);
      return;
    }

    setDeviceId(storedId);

    // ② この deviceId が owner_id の旅行だけ取得
    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .eq('owner_id', storedId)
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


  const handleCreateTrip = async (e: FormEvent) => {
    e.preventDefault();
    if (!deviceId) return; 
    if (!newTitle.trim()) {
      setError('タイトルは必須です');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // trips に挿入（share_token / is_share_public はDBのデフォルトに任せる想定）
      const { data, error } = await supabase
        .from('trips')
        .insert({
          owner_id: deviceId,  
          title: newTitle.trim(),
          start_date: newStartDate || null,
          end_date: newEndDate || null,
          description: newDescription || null,
        })
        .select('id, owner_id, title, start_date, end_date, description, share_token, is_share_public')
        .single();

      if (error) throw error;

      const newTrip = data as Trip;

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

  

  const formatDateRange = (trip: Trip) => {
    if (trip.start_date && trip.end_date) {
      return `${trip.start_date} 〜 ${trip.end_date}`;
    }
    return '日程未設定';
  };

  const handleCopyShareLink = async (trip: Trip) => {
    if (!trip.share_token) return;
    try {
      setCopyingTripId(trip.id);
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/share/${trip.share_token}`;
      await navigator.clipboard.writeText(url);
      setCopyMessage('共有リンクをコピーしました');
      setTimeout(() => setCopyMessage(null), 2000);
    } catch (err) {
      console.error(err);
      setCopyMessage('コピーに失敗しました');
      setTimeout(() => setCopyMessage(null), 2000);
    } finally {
      setCopyingTripId(null);
    }
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
            ログイン不要で使えます
          </p>
        </div>
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
                  className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/trips/${trip.id}`)}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {trip.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {formatDateRange(trip)}
                    </div>

                    {/* 共有ステータス */}
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] ${
                          trip.is_share_public
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        {trip.is_share_public ? '共有オン（URLあり）' : '共有オフ'}
                      </span>
                      {trip.is_share_public && trip.share_token && (
                        <button
                          type="button"
                          className="text-[11px] text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation(); // カード遷移を止める
                            handleCopyShareLink(trip);
                          }}
                          disabled={copyingTripId === trip.id}
                        >
                          {copyingTripId === trip.id
                            ? 'コピー中…'
                            : '共有リンクをコピー'}
                        </button>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    詳細を開く
                  </span>
                </Card>
              ))}
            </div>
          )}

          {copyMessage && (
            <p className="mt-2 text-[11px] text-slate-500">{copyMessage}</p>
          )}
        </section>
      </div>
    </main>
  );
}
