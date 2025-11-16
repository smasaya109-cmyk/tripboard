'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from "@/components/ui/LoadingScreen";

type Trip = {
  id: string;
  title: string;
};

type Expense = {
  id: string;
  trip_id: string;
  title: string;
  amount: number;
  payer_name: string;
  participant_names: string[] | null;
  memo: string | null;
  created_at: string;
};

type PersonSummary = {
  name: string;
  paid: number;
  shouldPay: number;
  net: number; // +なら受け取り / -なら支払い
};

type MemberRow = {
  user_id: string | null;
  display_name: string | null;
  profiles: {
    email?: string | null;
  } | null;
};

type Settlement = {
  from: string;
  to: string;
  amount: number;
};

export default function TripExpensesPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId as string;
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // メンバー
  const [members, setMembers] = useState<MemberRow[]>([]);

  // フォーム用
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(''); // 入力値は文字列
  const [selectedPayer, setSelectedPayer] = useState(''); // メンバーから選択
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [creating, setCreating] = useState(false);

  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
    null
  );

  // ラベル共通関数
  const memberLabel = (m: MemberRow): string =>
    m.display_name || m.profiles?.email || 'メンバー';

  // ----------------- 初期ロード -----------------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      // 旅行タイトルだけ取得
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('id, title')
        .eq('id', tripId)
        .single();

      if (tripError || !tripData) {
        console.error(tripError);
        setError('この旅行が見つかりませんでした');
        setLoading(false);
        return;
      }

      setTrip(tripData as Trip);

      // 支出一覧
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (expensesError) {
        console.error(expensesError);
        setError('支出の取得に失敗しました');
        setExpenses([]);
      } else {
        const list: Expense[] = (expensesData ?? []).map((row: any) => ({
          ...row,
          amount: Number(row.amount),
        }));
        setExpenses(list);
      }

      // メンバー一覧
      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('user_id, display_name, profiles(email)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (membersError) {
        console.error(membersError);
        setError('メンバー情報の取得に失敗しました');
        setMembers([]);
      } else {
        setMembers((membersData ?? []) as MemberRow[]);
      }

      setLoading(false);
    };

    if (tripId) {
      load();
    }
  }, [tripId]);

  // -------入力間違えの削除機能--------
  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('この支出を削除しますか？')) return;

    setError(null);
    setDeletingExpenseId(expenseId);

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '支出の削除に失敗しました');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  // ----------------- 支出追加 -----------------
  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!trip) return;

    const trimmedTitle = title.trim();
    const payer = selectedPayer.trim();
    const amountNumber = Number(amount);

    if (!trimmedTitle || !payer || !amountNumber || amountNumber <= 0) {
      setError('タイトル・支払った人・金額を正しく入力してください');
      return;
    }

    // 参加者が選ばれていない場合は「支払った人だけ」で割り勘
    const participants =
      selectedParticipants.length > 0 ? selectedParticipants : [payer];

    setCreating(true);

    try {
      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert({
          trip_id: trip.id,
          title: trimmedTitle,
          amount: amountNumber,
          payer_name: payer,
          participant_names: participants,
          memo: memo.trim() || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const created: Expense = {
        ...(data as any),
        amount: Number((data as any).amount),
      };

      setExpenses((prev) => [...prev, created]);

      // フォームクリア
      setTitle('');
      setAmount('');
      setSelectedPayer('');
      setSelectedParticipants([]);
      setMemo('');
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? '支出の追加に失敗しました');
    } finally {
      setCreating(false);
    }
  };

  // ヘルパー：参加者トグル
  const toggleParticipant = (name: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(name)
        ? prev.filter((n) => n !== name)
        : [...prev, name]
    );
  };

  // ----------------- 集計ロジック -----------------
  const summaries: PersonSummary[] = useMemo(() => {
    const map = new Map<string, PersonSummary>();

    for (const exp of expenses) {
      const participants = exp.participant_names ?? [];
      if (participants.length === 0) continue;

      const share = exp.amount / participants.length;

      // 参加者ごとの負担額
      for (const rawName of participants) {
        const name = rawName || '未設定';
        if (!map.has(name)) {
          map.set(name, { name, paid: 0, shouldPay: 0, net: 0 });
        }
        const s = map.get(name)!;
        s.shouldPay += share;
      }

      // 支払った人
      const payer = exp.payer_name || '未設定';
      if (!map.has(payer)) {
        map.set(payer, { name: payer, paid: 0, shouldPay: 0, net: 0 });
      }
      const payerSummary = map.get(payer)!;
      payerSummary.paid += exp.amount;
    }

    // 差額計算
    const list = Array.from(map.values());
    for (const s of list) {
      s.net = s.paid - s.shouldPay;
    }
    return list;
  }, [expenses]);

  const settlements: Settlement[] = useMemo(() => {
    // ±1円未満は誤差として無視
    const EPS = 1;

    const positives = summaries
      .filter((s) => s.net > EPS)
      .map((s) => ({ ...s }));
    const negatives = summaries
      .filter((s) => s.net < -EPS)
      .map((s) => ({ ...s }));

    positives.sort((a, b) => b.net - a.net); // 受け取り額が大きい順
    negatives.sort((a, b) => a.net - b.net); // 支払い額が大きい順（マイナス）

    const result: Settlement[] = [];

    let i = 0;
    let j = 0;

    while (i < positives.length && j < negatives.length) {
      const recv = positives[i];
      const pay = negatives[j];

      const amount = Math.min(recv.net, -pay.net);
      if (amount <= EPS) break;

      result.push({
        from: pay.name,
        to: recv.name,
        amount,
      });

      recv.net -= amount;
      pay.net += amount;

      if (recv.net <= EPS) i++;
      if (pay.net >= -EPS) j++;
    }

    return result;
  }, [summaries]);

  // 金額表示
  const formatYen = (value: number) =>
    Math.round(value).toLocaleString('ja-JP', {
      maximumFractionDigits: 0,
    });

  const handleBack = () => {
    router.push(`/trips/${tripId}`);
  };

  // ----------------- レンダリング -----------------
  if (loading) {
    return <LoadingScreen message="読み込み中…" />;
  }

  if (!trip) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-slate-100 gap-4">
        <p className="text-sm text-red-500">旅行情報を取得できませんでした</p>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          旅行一覧に戻る
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="px-2 text-xs"
            onClick={handleBack}
          >
            ← 旅行詳細へ戻る
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              {trip.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1">割り勘・精算</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <Card className="p-6 space-y-6">
          {/* 支出追加フォーム */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">支出を追加</h2>
            <form className="space-y-3" onSubmit={handleAddExpense}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    項目 *
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例：初日の夕食 / タクシー代"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    金額（円） *
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例：12000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* 支払った人＆参加者（メンバーから選択） */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    支払った人（メンバーから選択） *
                  </label>
                  {members.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      まだメンバーが登録されていません。
                      旅行詳細ページの「メンバー」タブから追加してから、ここで割り勘を登録してください。
                    </p>
                  ) : (
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedPayer}
                      onChange={(e) => setSelectedPayer(e.target.value)}
                    >
                      <option value="">選択してください</option>
                      {members.map((m) => {
                        const label = memberLabel(m);
                        return (
                          <option key={`${m.user_id ?? label}`} value={label}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    誰のための支払いか（複数選択可）
                  </label>
                  {members.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      メンバーが登録されていないため選択できません。
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => {
                        const label = memberLabel(m);
                        const checked = selectedParticipants.includes(label);
                        return (
                          <label
                            key={`${m.user_id ?? label}-check`}
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs cursor-pointer ${
                              checked
                                ? 'bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-slate-50 border-slate-300 text-slate-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={() => toggleParticipant(label)}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    何も選択しない場合は、「支払った人1人」で割り勘されます。
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  メモ
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例：クレカで立て替え / 飲み物代込み など"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={
                  creating ||
                  !title.trim() ||
                  !amount.trim() ||
                  !selectedPayer ||
                  members.length === 0
                }
              >
                {creating ? '追加中...' : '支出を追加'}
              </Button>
            </form>
          </section>

          {/* 支出一覧 */}
          <section className="space-y-2 pt-4 border-t border-slate-200">
            <h2 className="text-lg font-semibold">支出一覧</h2>
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-500">
                まだ支出が登録されていません。上のフォームから追加してみてください。
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {expenses.map((exp) => (
                  <li
                    key={exp.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">
                        {exp.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right text-slate-900">
                          {formatYen(exp.amount)} 円
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="text-xs text-slate-400 hover:text-red-600"
                          onClick={() => handleDeleteExpense(exp.id)}
                          disabled={deletingExpenseId === exp.id}
                        >
                          {deletingExpenseId === exp.id ? '削除中…' : '削除'}
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-3">
                      <span>支払：{exp.payer_name}</span>
                      <span>
                        参加者：
                        {exp.participant_names && exp.participant_names.length > 0
                          ? exp.participant_names.join(', ')
                          : '未設定'}
                      </span>
                    </div>
                    {exp.memo && (
                      <div className="text-xs text-slate-500 mt-1">
                        {exp.memo}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 人ごとの集計 */}
          <section className="space-y-2 pt-4 border-t border-slate-200">
            <h2 className="text-lg font-semibold">人ごとの集計</h2>
            {summaries.length === 0 ? (
              <p className="text-sm text-slate-500">
                支出を登録すると、ここに集計結果が表示されます。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1">名前</th>
                      <th className="text-right py-1">支払った合計</th>
                      <th className="text-right py-1">本来払うべき</th>
                      <th className="text-right py-1">差額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaries.map((s) => (
                      <tr key={s.name} className="border-b border-slate-100">
                        <td className="py-1">{s.name}</td>
                        <td className="py-1 text-right">
                          {formatYen(s.paid)} 円
                        </td>
                        <td className="py-1 text-right">
                          {formatYen(s.shouldPay)} 円
                        </td>
                        <td
                          className={`py-1 text-right ${
                            s.net > 0
                              ? 'text-emerald-600'
                              : s.net < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {s.net > 0
                            ? `+${formatYen(s.net)} 円（受け取り）`
                            : s.net < 0
                            ? `${formatYen(Math.abs(s.net))} 円（支払い）`
                            : '±0 円'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 最終的な精算案 */}
          <section className="mt-8 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">最終的な精算案</h2>
            <p className="text-xs text-slate-500">
              この一覧のとおりにお金を動かせば、全員の支払いがきれいにチャラになります。
            </p>

            <div className="space-y-3">
              {settlements.length === 0 ? (
                <p className="text-xs text-slate-500">
                  いまのところ精算が必要な差額はありません。
                </p>
              ) : (
                settlements.map((s, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* 左側：誰 → 誰 に払うか */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-500">支払う人</span>
                        <span className="text-sm font-semibold text-slate-900 break-all">
                          {s.from}
                        </span>
                      </div>

                      {/* 矢印 */}
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-base">
                        →
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-500">受け取る人</span>
                        <span className="text-sm font-semibold text-slate-900 break-all">
                          {s.to}
                        </span>
                      </div>
                    </div>

                    {/* 右側：金額 */}
                    <div className="flex items-end justify-between gap-2 sm:flex-col sm:items-end">
                      <span className="text-[11px] text-slate-500">支払う金額</span>
                      <span className="text-base font-semibold text-emerald-600 tabular-nums">
                        ¥{s.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </Card>
      </div>
    </main>
  );
}
