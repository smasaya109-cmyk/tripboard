'use client';

import { useEffect, useState, FormEvent } from 'react';
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
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  location: string | null;
  note: string | null;
};

// タスク
type Task = {
  id: string;
  title: string;
  status: string; // 'todo' | 'doing' | 'done' を想定
  due_date: string | null;
  assignee_name: string | null;
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

  // 追加用 state（編集機能用）
  // 日程
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newScheduleNote, setNewScheduleNote] = useState('');
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  // タスク
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // メモ
  const [newNote, setNewNote] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        // ① share_token から旅行本体を取得
        const { data: tripData, error: tripError } = await supabase
          .from('trips')
          .select('id, title, start_date, end_date, description, share_token')
          .eq('share_token', token)
          .maybeSingle();

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

        // ② 関連データ（日程 / タスク / メモ）を取得
        const [
          { data: schedulesData, error: schedulesError },
          { data: tasksData, error: tasksError },
          { data: notesData, error: notesError },
        ] = await Promise.all([
          supabase
            .from('schedules')
            .select('id, date, start_time, end_time, title, location, note')
            .eq('trip_id', tripId)
            .order('date', { ascending: true })
            .order('start_time', { ascending: true }),
          supabase
            .from('tasks')
            .select('id, title, status, due_date, assignee_name')
            .eq('trip_id', tripId)
            .order('is_pinned', { ascending: false })
            .order('due_date', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase
            .from('notes')
            .select('id, content, created_at')
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

  // 日程追加
  const handleAddSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    if (!newDate || !newScheduleTitle.trim()) {
      setError('日付とタイトルは必須です');
      return;
    }

    setCreatingSchedule(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('schedules')
        .insert({
          trip_id: trip.id,
          date: newDate,
          start_time: newStartTime ? `${newStartTime}:00` : null,
          end_time: null,
          title: newScheduleTitle.trim(),
          location: newLocation || null,
          note: newScheduleNote || null,
        })
        .select(
          'id, date, start_time, end_time, title, location, note'
        )
        .single();

      if (error) throw error;

      setSchedules((prev) => [...prev, data as Schedule]);
      setNewDate('');
      setNewStartTime('');
      setNewScheduleTitle('');
      setNewLocation('');
      setNewScheduleNote('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '日程の追加に失敗しました');
    } finally {
      setCreatingSchedule(false);
    }
  };

  // タスク追加
  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    const title = newTaskTitle.trim();
    if (!title) {
      setError('タスク名を入力してください');
      return;
    }

    setCreatingTask(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          trip_id: trip.id,
          title,
          description: null,
          due_date: null,
          status: 'todo',
          is_pinned: false,
          assignee_name: newTaskAssignee || null,
        })
        .select('id, title, status, due_date, assignee_name')
        .single();

      if (error) throw error;

      setTasks((prev) => [...prev, data as Task]);
      setNewTaskTitle('');
      setNewTaskAssignee('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'タスクの追加に失敗しました');
    } finally {
      setCreatingTask(false);
    }
  };

  // タスクの完了 / 未完了トグル
  const toggleStatus = (status: string) =>
    status === 'done' ? 'todo' : 'done';

  const handleToggleTaskStatus = async (task: Task) => {
    setUpdatingTaskId(task.id);
    setError(null);

    try {
      const newStatus = toggleStatus(task.status);

      const { data, error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
        .select('id, title, status, due_date, assignee_name')
        .single();

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? (data as Task) : t))
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'タスクの更新に失敗しました');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // メモ追加
  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    const content = newNote.trim();
    if (!content) return;

    setCreatingNote(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          trip_id: trip.id,
          title: content.slice(0, 50), // DB に title がある想定
          content,
        })
        .select('id, content, created_at')
        .single();

      if (error) throw error;

      setNotes((prev) => [data as Note, ...prev]);
      setNewNote('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'メモの追加に失敗しました');
    } finally {
      setCreatingNote(false);
    }
  };

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
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* 上部ヘッダー */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-[0.16em] uppercase text-slate-400">
              Tripboard
            </span>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 border border-sky-100">
              共有リンク（編集可）
            </span>
          </div>

          <Link href="/">
            <Button variant="ghost" size="xs" className="text-[11px] px-3 py-1">
              トップへ
            </Button>
          </Link>
        </div>

        {/* 旅行タイトル */}
        <Card className="p-5 space-y-2">
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {trip.title}
          </h1>
          <p className="text-xs text-slate-500">{formatDateRange()}</p>
          <p className="text-sm text-slate-700 mt-2">
            {trip.description || 'この旅行の概要はまだ入力されていません。'}
          </p>
          <p className="text-[11px] text-slate-400 mt-2">
            このページのURLを知っている人なら、誰でもこの旅行の内容を一緒に編集できます。
          </p>
        </Card>

        {/* 日程 */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">日程</h2>
          </div>

          {/* 日程追加フォーム */}
          <form
            onSubmit={handleAddSchedule}
            className="space-y-3 rounded-xl bg-white/70 p-3 border border-slate-200"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  日付 *
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  開始時間
                </label>
                <input
                  type="time"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  タイトル *
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例：空港へ移動 / ホテルチェックイン"
                  value={newScheduleTitle}
                  onChange={(e) => setNewScheduleTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  場所
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例：羽田空港 第2ターミナル"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  メモ
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例：1時間前には空港集合"
                  value={newScheduleNote}
                  onChange={(e) => setNewScheduleNote(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={creatingSchedule}
              className="text-xs"
            >
              {creatingSchedule ? '追加中…' : '日程を追加'}
            </Button>
          </form>

          {/* 日程一覧 */}
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
        </Card>

        {/* タスク */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">タスク</h2>
          </div>

          {/* タスク追加フォーム */}
          <form
            onSubmit={handleAddTask}
            className="space-y-3 rounded-xl bg-white/70 p-3 border border-slate-200"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例：航空券を手配する"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
              />
              <input
                className="w-full sm:w-40 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="担当（任意）"
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                className="whitespace-nowrap text-xs"
                disabled={creatingTask || !newTaskTitle.trim()}
              >
                {creatingTask ? '追加中…' : '追加'}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              担当を空欄にすると「未定」として登録されます。
            </p>
          </form>

          {/* タスク一覧 */}
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
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={t.status === 'done'}
                        onChange={() => handleToggleTaskStatus(t)}
                        disabled={updatingTaskId === t.id}
                      />
                      <span
                        className={`text-sm ${
                          t.status === 'done'
                            ? 'text-slate-400 line-through'
                            : 'text-slate-800'
                        }`}
                      >
                        {t.title}
                      </span>
                      <span
                        className={`ml-2 text-[11px] rounded-full px-2 py-[2px] border ${
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
                          期限:{' '}
                          {new Date(t.due_date).toLocaleDateString('ja-JP')}
                        </span>
                      )}
                      <span>担当: {t.assignee_name || '未定'}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* メモ */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">メモ</h2>
          </div>

          {/* メモ追加フォーム */}
          <form
            onSubmit={handleAddNote}
            className="space-y-3 rounded-xl bg-white/70 p-3 border border-slate-200"
          >
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="注意点・アイデア・リンクなどを自由にメモできます"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              disabled={creatingNote || !newNote.trim()}
              className="text-xs"
            >
              {creatingNote ? '追加中…' : 'メモを追加'}
            </Button>
          </form>

          {/* メモ一覧 */}
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
        </Card>
      </div>
    </main>
  );
}
