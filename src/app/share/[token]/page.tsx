'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { supabase } from '@/lib/supabaseClient';

// 旅行
type Trip = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

// 日程
type Schedule = {
  id: string;
  date: string; // date 型を string で受け取る
  start_time: string | null; // '09:00' など
  end_time: string | null;
  title: string;
  location: string | null;
  note: string | null;
};

// タスク（ステータスは string にしておくと楽）
type Task = {
  id: string;
  title: string;
  status: string; // 'todo' | 'doing' | 'done' を想定
  due_date: string | null;
  assignee_name: string | null; // DB に合わせて調整
};

// メモ
type Note = {
  id: string;
  content: string;
  created_at: string;
};

export default function ShareTripPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('share token from URL:', token);

        // ① 旅行情報を取得
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .select('id, title, start_date, end_date, description, share_token')
          .eq('share_token', token)
          .maybeSingle();

        console.log('trip result:', { tripData, tripError });

        if (tripError) {
          console.error(tripError);
          setError('共有ページの読み込みに失敗しました。');
          return;
        }

        if (!tripData) {
          setError('この共有リンクは無効か、公開が終了しています。');
          return;
        }

        const baseTrip: Trip = {
          id: tripData.id,
          title: tripData.title,
          start_date: tripData.start_date,
          end_date: tripData.end_date,
          description: tripData.description,
        };
        setTrip(baseTrip);

        const tripId = tripData.id;

        // ② 関連データをまとめて取得（日程 / タスク / メモ）
        const [
          { data: schedulesData, error: schedulesError },
          { data: tasksData, error: tasksError },
          { data: notesData, error: notesError },
        ] = await Promise.all([
          supabase
            .from('schedules')
            .select(
              'id, date, start_time, end_time, title, location, note'
            )
            .eq('trip_id', tripId)
            .order('date', { ascending: true })
            .order('start_time', { ascending: true }),
          supabase
            .from('tasks')
            .select(
              'id, title, status, due_date, assignee_name'
            )
            .eq('trip_id', tripId)
            .order('is_pinned', { ascending: false })
            .order('due_date', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase
            .from('notes')
            .select(
              'id, content, created_at'
            )
            .eq('trip_id', tripId)
            .order('created_at', { ascending: false }),
        ]);

        if (schedulesError) console.error('schedulesError', schedulesError);
        if (tasksError) console.error('tasksError', tasksError);
        if (notesError) console.error('notesError', notesError);

        setSchedules((schedulesData ?? []) as Schedule[]);
        setTasks((tasksData ?? []) as Task[]);
        setNotes((notesData ?? []) as Note[]);
      } catch (err: any) {
        console.error(err);
        setError('共有ページの読み込みに失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const formatDateRange = () => {
    if (!trip?.start_date && !trip?.end_date) return '日程未定';
    const fmt = (d: string | null) =>
      d ? new Date(d).toLocaleDateString('ja-JP') : '未定';
    if (!trip?.end_date || trip.start_date === trip.end_date) {
      return fmt(trip.start_date);
    }
    return `${fmt(trip.start_date)} 〜 ${fmt(trip.end_date)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const formatTimeRange = (s: string | null, e: string | null) => {
    if (!s && !e) return '';
    if (!e) return s;
    return `${s}〜${e}`;
  };

  const statusLabel = (status: string) => {
    if (status === 'done') return '完了';
    if (status === 'doing') return '進行中';
    return '未完了';
  };

  if (loading || !token) {
    return <LoadingScreen message="旅行情報を読み込み中です…" />;
  }

  if (error || !trip) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <Card className="max-w-md w-full p-6 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">
            共有リンクが無効です
          </h1>
          <p className="text-sm text-slate-600">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="mt-2"
          >
            トップページへ戻る
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* 上部ヘッダー */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.16em] uppercase text-slate-400">
              Tripboard
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">
              閲覧専用リンク
            </span>
          </div>

          <Link href="/">
            <Button variant="ghost" size="xs" className="text-[11px] px-3 py-1">
              アプリトップへ
            </Button>
          </Link>
        </div>

        {/* メインカード */}
        <Card className="p-6 space-y-6">
          {/* タイトル & 日程 */}
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              {trip.title}
            </h1>
            <p className="text-xs text-slate-500">{formatDateRange()}</p>
          </div>

          {/* 概要 */}
          <div className="border-t border-slate-200 pt-4 space-y-1">
            <h2 className="text-xs font-semibold text-slate-700">概要</h2>
            <p className="text-sm text-slate-700">
              {trip.description || 'この旅行の概要はまだ入力されていません。'}
            </p>
          </div>

          {/* 日程（閲覧専用） */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-700">日程</h2>
            </div>

            {schedules.length === 0 ? (
              <p className="text-xs text-slate-400">
                まだ日程が登録されていません。
              </p>
            ) : (
              <ul className="space-y-3">
                {schedules.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                  >
                    <div className="text-[11px] text-slate-500 min-w-[90px]">
                      <div>{formatDate(s.date)}</div>
                      <div>{formatTimeRange(s.start_time, s.end_time)}</div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium text-slate-800">
                        {s.title}
                      </div>
                      {(s.location || s.note) && (
                        <p className="text-[11px] text-slate-500">
                          {s.location && <span>{s.location}</span>}
                          {s.location && s.note && <span> ｜ </span>}
                          {s.note && <span>{s.note}</span>}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* タスク（閲覧専用） */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-700">タスク</h2>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400">
                まだタスクが登録されていません。
              </p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {t.title}
                        </span>
                        <span
                          className={`text-[11px] rounded-full px-2 py-[2px] border ${
                            t.status === 'done'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : t.status === 'doing'
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {statusLabel(t.status)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        {t.due_date && (
                          <span>
                            期限:{" "}
                            {new Date(t.due_date).toLocaleDateString('ja-JP')}
                          </span>
                        )}
                        <span>
                          担当: {t.assignee_name || '未定'}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* メモ（閲覧専用） */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-slate-700">メモ</h2>
            </div>

            {notes.length === 0 ? (
              <p className="text-xs text-slate-400">
                まだメモが登録されていません。
              </p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-xl bg-slate-50 px-3 py-2 space-y-1"
                  >
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">
                      {n.content}
                    </p>
                    <p className="text-[10px] text-slate-400 text-right">
                      {new Date(n.created_at).toLocaleString('ja-JP')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* アプリ参加への導線 */}
            <div className="border-t border-slate-200 pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* 左側テキスト */}
                <div className="space-y-1 sm:max-w-[60%]">
                <p className="text-sm font-medium text-slate-800">
                    この旅行に参加して、アプリで一緒に編集しませんか？
                </p>
                <p className="text-[11px] text-slate-500">
                    ログインすると、タスクの追加・担当者の設定・割り勘の記録など、すべての機能が使えます。
                </p>
                </div>

                {/* 右側：モバイルは中央揃え、PC は右揃え */}
                <div className="flex flex-col gap-2 items-center sm:items-end text-center sm:text-right sm:min-w-[240px]">
                <Link href={`/login?redirect=/trips/${trip.id}`}>
                    <Button
                    size="sm"
                    className="px-6 whitespace-nowrap"
                    >
                    ログインしてこの旅行を開く
                    </Button>
                </Link>

                {/* 新規登録リンク：文言だけにリンクを付与 */}
                <Link href="/login">
                    <button
                    className="
                        text-[11px]
                        text-slate-500 hover:text-slate-700
                        underline-offset-2 hover:underline
                    "
                    >
                    こちらから新規登録できます
                    </button>
                </Link>
                </div>
            </div>
            </div>
        </Card>
      </div>
    </main>
  );
}

