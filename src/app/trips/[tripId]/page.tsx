'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';
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

type Schedule = {
  id: string;
  trip_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string;
  location: string | null;
  note: string | null;
};

type TaskStatus = 'todo' | 'done';

type Task = {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskStatus;
  is_pinned: boolean;
  assignee_name: string | null;
};

type Note = {
  id: string;
  trip_id: string;
  title: string;
  content: string;
  created_at: string;
};

type MemberRow = {
  id: string;
  user_id: string | null;
  role: string | null;
  display_name: string | null;
  profiles: {
    email?: string | null;
  } | null;
};

const memberLabel = (m: MemberRow): string =>
  m.display_name || m.profiles?.email || 'メンバー';

type TabKey = 'overview' | 'schedule' | 'tasks' | 'notes' | 'members';

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId as string;

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // 概要編集
  const [overviewEditing, setOverviewEditing] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState('');
  const [savingOverview, setSavingOverview] = useState(false);

  // タイトル編集用
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);

  // 日程
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newScheduleNote, setNewScheduleNote] = useState('');
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  // タスク
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>(''); // '' = 未定
  const [creatingTask, setCreatingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [updatingAssigneeId, setUpdatingAssigneeId] = useState<string | null>(null);

  // メモ
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);

  // メンバー
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [addingNameMember, setAddingNameMember] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);

  // 削除中フラグ
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // 共有リンク
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // ----------------- 初期ロード -----------------
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      // ユーザー取得
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.push('/login');
        return;
      }

      setUserEmail(userData.user.email ?? null);
      setUserId(userData.user.id);

      // 旅行本体
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError || !tripData) {
        console.error(tripError);
        setError('この旅行が見つかりませんでした');
        setLoading(false);
        return;
      }

      setTrip(tripData as Trip);
      setOverviewDraft(tripData.description ?? '');

      // 日程
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (scheduleError) {
        console.error(scheduleError);
        setError('日程の取得に失敗しました');
      } else {
        setSchedules((scheduleData ?? []) as Schedule[]);
      }

      // タスク
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(
          'id, trip_id, title, description, due_date, status, is_pinned, assignee_name, created_at'
        )
        .eq('trip_id', tripId)
        .order('is_pinned', { ascending: false })
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (tasksError) {
        console.error(tasksError);
        setError('タスクの取得に失敗しました');
      } else {
        setTasks((tasksData ?? []) as Task[]);
      }

      // メモ
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.error(notesError);
        setError('メモの取得に失敗しました');
      } else {
        setNotes((notesData ?? []) as Note[]);
      }

      // メンバー（email だけ参照）
      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('id, user_id, role, display_name, profiles(email)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (membersError) {
        console.error(membersError);
        setError('メンバー情報の取得に失敗しました');
      } else {
        setMembers((membersData ?? []) as MemberRow[]);
      }

      setLoading(false);
    };

    if (tripId) {
      init();
    }
  }, [router, tripId]);

  // ----------------- 概要 -----------------
  const handleSaveOverview = async (e: FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    try {
      setSavingOverview(true);
      setError(null);

      const { data, error } = await supabase
        .from('trips')
        .update({ description: overviewDraft })
        .eq('id', trip.id)
        .select()
        .single();

      if (error) throw error;

      setTrip(prev => (prev ? { ...prev, description: data.description } : prev));
      setOverviewEditing(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '概要の更新に失敗しました');
    } finally {
      setSavingOverview(false);
    }
  };

    const handleSaveTitle = async (e: FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    const newTitle = titleDraft.trim();
    if (!newTitle) {
      setError('タイトルを入力してください');
      return;
    }

    setSavingTitle(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('trips')
        .update({ title: newTitle })
        .eq('id', trip.id)
        .select()
        .single();

      if (error) throw error;

      setTrip(data as Trip);
      setTitleEditing(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'タイトルの更新に失敗しました');
    } finally {
      setSavingTitle(false);
    }
  };

  // ----------------- 日程 -----------------
  const handleAddSchedule = async (e: React.FormEvent) => {
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
        .select()
        .single();

      if (error) throw error;

      const created = data as Schedule;
      setSchedules(prev => [...prev, created]);

      setNewScheduleTitle('');
      setNewStartTime('');
      setNewLocation('');
      setNewScheduleNote('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '日程の追加に失敗しました');
    } finally {
      setCreatingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!window.confirm('この日程を削除しますか？')) return;

    try {
      setDeletingScheduleId(scheduleId);
      setError(null);

      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '日程の削除に失敗しました');
    } finally {
      setDeletingScheduleId(null);
    }
  };

  // ----------------- タスク -----------------
  const nextStatus = (current: TaskStatus): TaskStatus =>
    current === 'done' ? 'todo' : 'done';

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!trip) return;

    const title = newTaskTitle.trim();
    if (!title) {
      setError('タスク名を入力してください');
      return;
    }

    setCreatingTask(true);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          trip_id: trip.id,
          title,
          description: null,
          due_date: null,
          status: 'todo' as TaskStatus,
          is_pinned: false,
          assignee_name: newTaskAssignee || null,
        })
        .select(
          'id, trip_id, title, description, due_date, status, is_pinned, assignee_name, created_at'
        )
        .single();

      if (error) throw error;

      setTasks(prev => [...prev, data as Task]);

      setNewTaskTitle('');
      setNewTaskAssignee('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'タスクの追加に失敗しました');
    } finally {
      setCreatingTask(false);
    }
  };

  const toggleStatus = (status: TaskStatus): TaskStatus =>
  status === 'done' ? 'todo' : 'done';

// ★ 修正版：先にUIを更新 → そのあとSupabaseへ保存
const handleToggleTaskStatus = async (task: Task) => {
  setError(null);

  const prevStatus = task.status;
  const newStatus = toggleStatus(task.status);

  // ✅ 楽観的更新：まず画面だけサクッと更新
  setTasks((prev) =>
    prev.map((t) =>
      t.id === task.id ? { ...t, status: newStatus } : t
    )
  );

  setUpdatingTaskId(task.id);

  try {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id);

    if (error) throw error;
  } catch (err: any) {
    console.error(err);

    // ❌ 失敗したら元に戻す
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: prevStatus } : t
      )
    );

    setError(err.message ?? 'タスクの更新に失敗しました');
  } finally {
    setUpdatingTaskId(null);
  }
};


  const handleChangeTaskAssignee = async (task: Task, assigneeName: string) => {
    setUpdatingAssigneeId(task.id);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          assignee_name: assigneeName || null,
        })
        .eq('id', task.id)
        .select(
          'id, trip_id, title, description, due_date, status, is_pinned, assignee_name, created_at'
        )
        .single();

      if (error) throw error;

      setTasks(prev =>
        prev.map(t => (t.id === task.id ? (data as Task) : t))
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '担当者の更新に失敗しました');
    } finally {
      setUpdatingAssigneeId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('このタスクを削除しますか？')) return;

    try {
      setDeletingTaskId(taskId);
      setError(null);

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'タスクの削除に失敗しました');
    } finally {
      setDeletingTaskId(null);
    }
  };

  // ----------------- メモ -----------------
  const handleAddNote = async (e: React.FormEvent) => {
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
          title: content.slice(0, 50),
          content,
        })
        .select()
        .single();

      if (error) throw error;

      const created = data as Note;
      setNotes(prev => [created, ...prev]);
      setNewNote('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'メモの追加に失敗しました');
    } finally {
      setCreatingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('このメモを削除しますか？')) return;

    try {
      setDeletingNoteId(noteId);
      setError(null);

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'メモの削除に失敗しました');
    } finally {
      setDeletingNoteId(null);
    }
  };

  // ----------------- メンバー：削除 -----------------
  const handleDeleteMember = async (member: MemberRow) => {
    if (!trip) return;

    if (member.role === 'owner') {
      setError('オーナーは削除できません');
      return;
    }

    const displayName =
      member.display_name || member.profiles?.email || 'このメンバー';

    if (!window.confirm(`${displayName} をメンバーから削除しますか？`)) {
      return;
    }

    setDeletingMemberId(member.id);
    setError(null);

    try {
      const { error } = await supabase
        .from('trip_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'メンバーの削除に失敗しました');
    } finally {
      setDeletingMemberId(null);
    }
  };

  // ----------------- メンバー：名前だけ追加 -----------------
  const handleAddMemberName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    const name = newMemberName.trim();
    if (!name) return;

    setAddingNameMember(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('trip_members')
        .insert({
          trip_id: trip.id,
          user_id: null,
          role: 'viewer',
          display_name: name,
        })
        .select('id, user_id, role, display_name, profiles(email)')
        .single();

      if (error) throw error;

      const newMember = data as MemberRow;
      setMembers(prev => [...prev, newMember]);
      setNewMemberName('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? 'メンバーの追加に失敗しました');
    } finally {
      setAddingNameMember(false);
    }
  };

  // ----------------- メンバー：メールで既存ユーザー招待 -----------------
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;

    const email = inviteEmail.trim();
    if (!email) return;

    setInviting(true);
    setError(null);

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        setError(
          'このメールアドレスのユーザーが見つかりませんでした。相手にアカウント登録をお願いしてください。'
        );
        return;
      }

      const { data, error } = await supabase
        .from('trip_members')
        .insert({
          trip_id: trip.id,
          user_id: (profile as any).id,
          role: 'member',
          display_name: (profile as any).email,
        })
        .select('id, user_id, role, display_name, profiles(email)')
        .single();

      if (error) throw error;

      const newMember = data as MemberRow;
      setMembers(prev => [...prev, newMember]);
      setInviteEmail('');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ??
          'メンバーの追加に失敗しました。メールアドレスを確認してください。'
      );
    } finally {
      setInviting(false);
    }
  };

  // ----------------- 共有リンク -----------------
  const handleToggleShare = async () => {
    if (!trip) return;
    setError(null);

    try {
      const { data, error } = await supabase
        .from('trips')
        .update({ is_share_public: !trip.is_share_public })
        .eq('id', trip.id)
        .select()
        .single();

      if (error) throw error;

      setTrip(data as Trip);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '共有設定の更新に失敗しました');
    }
  };

  const handleCopyShareLink = async () => {
    if (!trip?.share_token) return;

    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/share/${trip.share_token}`;
      await navigator.clipboard.writeText(url);
      setCopyMessage('リンクをコピーしました');
      setTimeout(() => setCopyMessage(null), 2000);
    } catch (err) {
      console.error(err);
      setCopyMessage('コピーに失敗しました');
      setTimeout(() => setCopyMessage(null), 2000);
    }
  };

  // ----------------- 共通ヘルパー -----------------
  const handleBack = () => router.push('/trips');

  const formatDateRange = () => {
    if (trip?.start_date && trip.end_date) {
      return `${trip.start_date} 〜 ${trip.end_date}`;
    }
    return '日程未設定';
  };

  const renderTabLabel = (key: TabKey) => {
    switch (key) {
      case 'overview':
        return '概要';
      case 'schedule':
        return '日程';
      case 'tasks':
        return 'タスク';
      case 'notes':
        return 'メモ';
      case 'members':
        return 'メンバー';
    }
  };

  const tabs: TabKey[] = ['overview', 'schedule', 'tasks', 'notes', 'members'];

  // ----------------- レンダリング -----------------
  if (loading || !trip) {
    return <LoadingScreen message="読み込み中…" />;
  }

  if (!trip) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-xs"
            onClick={handleBack}
          >
            ← 旅行一覧
          </Button>
        </div>
        <div className="text-[11px] text-slate-500 whitespace-nowrap">
          ログイン中: {userEmail}
        </div>
      </header>

      {/* 本文 */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* タブ */}
        <nav className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-200 p-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-full transition-all ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {renderTabLabel(tab)}
              </button>
            ))}
          </div>
        </nav>

       {/* タブ内容 */}
          <Card className="p-6 min-h-[220px]">
          {/* 概要タブ */}
           {/* 概要 */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* ★ 旅行タイトル + 日程（タイトル編集可） */}
                <section className="space-y-2">
                  {titleEditing ? (
                    <form
                      onSubmit={handleSaveTitle}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <input
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        placeholder="旅行のタイトルを入力"
                      />
                      <div className="flex gap-2 justify-end sm:justify-start">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTitleEditing(false)}
                          disabled={savingTitle}
                        >
                          キャンセル
                        </Button>
                        <Button type="submit" size="sm" disabled={savingTitle}>
                          {savingTitle ? '保存中…' : '保存'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <h1 className="text-lg sm:text-xl font-semibold text-slate-900">
                        {trip.title}
                      </h1>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setTitleDraft(trip.title);
                          setTitleEditing(true);
                        }}
                      >
                        タイトルを編集
                      </Button>
                    </div>
                  )}

                  <p className="text-xs text-slate-500">{formatDateRange()}</p>
                </section>

              {/* Divider：タイトルと概要の間 */}
              <div className="h-px w-full bg-slate-200/80" />

              {/* 概要（フラット） */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">概要</h2>
                  {!overviewEditing && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setOverviewDraft(trip.description ?? '');
                        setOverviewEditing(true);
                      }}
                    >
                      編集
                    </Button>
                  )}
                </div>

                {overviewEditing ? (
                  <form onSubmit={handleSaveOverview} className="space-y-3">
                    <textarea
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[80px]"
                      value={overviewDraft}
                      onChange={(e) => setOverviewDraft(e.target.value)}
                      placeholder="旅行の目的やざっくりとしたイメージを書いておくと便利です。"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOverviewEditing(false)}
                        disabled={savingOverview}
                      >
                        キャンセル
                      </Button>
                      <Button type="submit" size="sm" disabled={savingOverview}>
                        {savingOverview ? '保存中…' : '保存'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {trip.description || 'この旅行の概要はまだ入力されていません。'}
                  </p>
                )}
              </section>

              {/* Divider：概要と共有リンクの間 */}
              <div className="h-px w-full bg-slate-200/80" />

              {/* 共有リンク（フラット） */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900">共有リンク</h3>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">共有専用リンク</span>

                    {/* スイッチ本体 */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={trip.is_share_public}
                      onClick={handleToggleShare}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        trip.is_share_public ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className="sr-only">共有リンクのオン／オフを切り替え</span>
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          trip.is_share_public ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    <span className="text-xs text-slate-500">
                      {trip.is_share_public ? 'オン' : 'オフ'}
                    </span>
                  </div>

                  {trip.is_share_public && (
                    <Button
                      type="button"
                      size="xs"
                      onClick={handleCopyShareLink}
                      className="ml-1"
                    >
                      リンクをコピー
                    </Button>
                  )}
                </div>

                {trip.is_share_public && trip.share_token && (
                  <div className="text-[11px] text-slate-500 break-all">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/share/${trip.share_token}`
                      : `/share/${trip.share_token}`}
                  </div>
                )}

                {copyMessage && (
                  <div className="text-[11px] text-blue-600">{copyMessage}</div>
                )}

                <p className="text-[11px] text-slate-400">
                  共有をオンにすると、この旅行を誰でも閲覧できるURLが発行されます。
                  （このページからは編集はできません）
                </p>
              </section>

              {/* Divider：共有リンクと割り勘カードの間 */}
              <div className="h-px w-full bg-slate-200/80" />

              {/* お金・割り勘（カードのままリッチに） */}
              <Card className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">お金・割り勘</h3>
                    <p className="text-xs text-slate-500">
                      誰がいくら立て替えたかを登録して、自動で精算案を作成できます。
                    </p>
                  </div>
                  <Link href={`/trips/${trip.id}/expenses`}>
                    <Button size="sm" className="whitespace-nowrap">
                      割り勘ページを開く
                    </Button>
                  </Link>
                </div>
                <p className="text-[11px] text-slate-400">
                  割り勘ページでは、この旅行の支出を登録して「誰が誰にいくら払えばいいか」を自動計算します。
                </p>
              </Card>
            </div>
          )}

          {/* 日程 */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">日程を追加</h2>
                <form className="space-y-4" onSubmit={handleAddSchedule}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        日付 *
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        開始時間
                      </label>
                      <input
                        type="time"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        タイトル *
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例：空港へ移動 / ホテルチェックイン"
                        value={newScheduleTitle}
                        onChange={(e) => setNewScheduleTitle(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        場所
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例：羽田空港 第2ターミナル"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        メモ
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="例：1時間前には空港集合"
                        value={newScheduleNote}
                        onChange={(e) => setNewScheduleNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button type="submit" size="sm" disabled={creatingSchedule}>
                    {creatingSchedule ? '追加中...' : '日程を追加'}
                  </Button>
                </form>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-2">日程一覧</h2>
                {schedules.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    まだ日程がありません。上のフォームから追加してみてください。
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {schedules.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0"
                      >
                        <div className="flex-1 flex gap-3">
                          <div className="w-28 text-xs text-slate-500 shrink-0">
                            <div>{item.date}</div>
                            {item.start_time && (
                              <div>{item.start_time.slice(0, 5)}</div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">
                              {item.title}
                            </div>
                            {item.location && (
                              <div className="text-xs text-slate-600 mt-0.5">
                                {item.location}
                              </div>
                            )}
                            {item.note && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {item.note}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-[11px] text-slate-400 hover:text-red-500"
                          onClick={() => handleDeleteSchedule(item.id)}
                          disabled={deletingScheduleId === item.id}
                        >
                          {deletingScheduleId === item.id ? '削除中…' : '削除'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* タスク */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {/* タスク追加フォーム */}
              <Card className="p-4 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">タスクを追加</h2>

                <form onSubmit={handleAddTask} className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    {/* タスク名 */}
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="例：航空券を手配する"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />

                    {/* 担当者セレクト＋追加ボタン */}
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={newTaskAssignee}
                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                      >
                        <option value="">未定</option>
                        {members.map((m) => {
                          const label = memberLabel(m);
                          return (
                            <option key={m.id} value={label}>
                              {label}
                            </option>
                          );
                        })}
                      </select>

                      <Button
                        type="submit"
                        size="sm"
                        className="whitespace-nowrap"
                        disabled={creatingTask || !newTaskTitle.trim()}
                      >
                        {creatingTask ? '追加中…' : '追加'}
                      </Button>
                    </div>
                  </div>
                </form>

                <p className="text-[11px] text-slate-400">
                  担当者を選ばない場合は「未定」として登録されます。あとから変更できます。
                </p>
              </Card>

              {/* タスク一覧 */}
              <Card className="p-4 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">タスク一覧</h2>

                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    まだタスクが登録されていません。上のフォームから追加してみてください。
                  </p>
                ) : (
                 <ul className="space-y-2">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className={`group flex items-start justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2 shadow-sm transition-all duration-200 ease-out ${
                        task.status === 'done'
                          ? 'bg-slate-50/80 translate-y-[1px] opacity-80'
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          {/* 左：チェック＋タイトル */}
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-transform duration-150 ease-out group-hover:scale-105"
                              checked={task.status === 'done'}
                              onChange={() => handleToggleTaskStatus(task)}
                              disabled={updatingTaskId === task.id}
                            />
                            <span
                              className={`text-sm transition-all duration-200 ${
                                task.status === 'done'
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-800'
                              }`}
                            >
                              {task.title}
                            </span>
                          </label>

                          {/* 右：担当者セレクト */}
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 sm:mt-0">
                            <span>担当：</span>
                            <select
                              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150"
                              value={task.assignee_name ?? ''}
                              onChange={(e) =>
                                handleChangeTaskAssignee(task, e.target.value)
                              }
                              disabled={updatingAssigneeId === task.id}
                            >
                              <option value="">未定</option>
                              {members.map((m) => {
                                const label = memberLabel(m);
                                return (
                                  <option key={m.id} value={label}>
                                    {label}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* 削除ボタン */}
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-[11px] text-slate-400 hover:text-red-500 transition-colors duration-150"
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={deletingTaskId === task.id}
                      >
                        {deletingTaskId === task.id ? '削除中…' : '削除'}
                      </Button>
                    </li>
                  ))}
                </ul>
 
                )}
              </Card>
            </div>
          )}

          {/* メモ */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">メモを追加</h2>
                <form className="space-y-3" onSubmit={handleAddNote}>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="注意点・アイデア・リンクなどを自由にメモできます"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={creatingNote || !newNote.trim()}
                  >
                    {creatingNote ? '追加中...' : 'メモを追加'}
                  </Button>
                </form>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-2">メモ一覧</h2>
                {notes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    まだメモがありません。上のフォームから追加してみてください。
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {notes.map((note) => (
                      <li
                        key={note.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="text-xs text-slate-400">
                            {new Date(note.created_at).toLocaleString('ja-JP', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-sm text-slate-800 whitespace-pre-wrap">
                            {note.content}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-[11px] text-slate-400 hover:text-red-500"
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={deletingNoteId === note.id}
                        >
                          {deletingNoteId === note.id ? '削除中…' : '削除'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* メンバー */}
          {activeTab === 'members' && (
            <div className="space-y-8">
              {/* 名前だけでメンバーを追加 */}
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  名前だけでメンバーを追加
                </h2>

                <form onSubmit={handleAddMemberName} className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    表示名
                  </label>

                  <div className="flex items-center gap-3">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="例：田中さん / ママ / 幹事A"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      required
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="flex-shrink-0 whitespace-nowrap"
                      disabled={addingNameMember || !newMemberName.trim()}
                    >
                      {addingNameMember ? '追加中...' : 'メンバーを追加'}
                    </Button>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    まだアカウントを持っていない家族や友達も、とりあえず名前だけ登録できます。
                  </p>
                </form>
              </div>

              {/* メールアドレスで既存ユーザーを追加 */}
              <div>
                <h2 className="text-sm font-semibold mb-1 text-slate-800">
                  （任意）メールアドレスで既存ユーザーを追加
                </h2>

                <form onSubmit={handleInviteMember} className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700">
                    メールアドレス
                  </label>

                  <div className="flex items-center gap-3">
                    <input
                      type="email"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="friend@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="flex-shrink-0 whitespace-nowrap"
                      disabled={inviting || !inviteEmail.trim()}
                    >
                      {inviting ? '追加中...' : 'メンバーを追加'}
                    </Button>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    相手がこのアプリにログイン済みであれば、この旅行が一覧にも表示されます。
                  </p>
                </form>
              </div>

              {/* メンバー一覧 */}
              <div>
                <h2 className="text-lg font-semibold mb-2">参加メンバー</h2>

                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    まだメンバーがいません。
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => {
                      const isOwner = m.role === 'owner';
                      const isSelf = m.user_id === userId;
                      const displayName =
                        m.display_name ||
                        m.profiles?.email ||
                        (isSelf ? 'あなた' : 'メンバー');

                      return (
                        <li
                          key={m.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div>
                            <div className="text-sm text-slate-900">
                              {displayName}
                              {isSelf && '（自分）'}
                            </div>
                            {m.profiles?.email && (
                              <div className="text-xs text-slate-500">
                                {m.profiles.email}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isOwner && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-amber-400 bg-amber-50 text-amber-700">
                                オーナー
                              </span>
                            )}
                            {!isOwner && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                className="text-xs text-slate-400 hover:text-red-600"
                                onClick={() => handleDeleteMember(m)}
                                disabled={deletingMemberId === m.id}
                              >
                                {deletingMemberId === m.id ? '削除中…' : '削除'}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
