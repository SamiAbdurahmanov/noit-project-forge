"use client";

import { useUser } from "@/context/UserContext";
import LoadingScreen from "@/src/lib/components/LoadingScreen";
import Unregistered from "@/src/lib/components/Unregistered";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { withAuth } from "@/src/withAuth";
import { getToken } from "@/src/lib/authHelper";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Context = {
    id: number;
    original_prompt: string;
    hobby: string;
    level: string | null;
    goals: string[] | null;
    created_at: string;
    updated_at: string;
    progress: number;
};

type ContextUpdate = {
    contextId: number;
    update: string;
    response?: string;
    progressIncrement?: number;
    planUpdated?: boolean;   // ← from backend plan_updated flag
};

function deriveStatus(progress: number): "learning" | "practicing" | "mastering" {
    if (progress < 40) return "learning";
    if (progress < 80) return "practicing";
    return "mastering";
}

export default function ContextsPage() {
    const { user, isLoading } = useUser();
    
    const router = useRouter();

    const [contexts, setContexts] = useState<Context[]>([]);
    const [fetchingContexts, setFetchingContexts] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [selectedContext, setSelectedContext] = useState<Context | null>(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [updateInput, setUpdateInput] = useState("");
    const [contextUpdates, setContextUpdates] = useState<ContextUpdate[]>([]);
    const [loadingUpdate, setLoadingUpdate] = useState(false);
    const [completedContext, setCompletedContext] = useState<Context | null>(null);

    // ── Delete flow (your additions) ─────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = useState<Context | null>(null);
    const [deleteCountdown, setDeleteCountdown] = useState(10);
    const [deleting, setDeleting] = useState(false);
    const [disabling, setDisabling] = useState(false);
    const token = getToken();
    // Countdown timer — resets every time a new delete target is set
    useEffect(() => {
        if (!deleteTarget) return;
        setDeleteCountdown(10);
        const interval = setInterval(() => {
            setDeleteCountdown((prev) => {
                if (prev <= 1) { clearInterval(interval); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [deleteTarget]);

    // ── Fetch contexts ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const fetchContexts = async () => {
            setFetchingContexts(true);
            setFetchError(null);
            try {
                const res = await fetch(`${API}/context/my-contexts`, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error("Неуспешно зареждане на контекстите");
                const data: Context[] = await res.json();
                setContexts(data);
            } catch (e: any) {
                setFetchError(e.message ?? "Грешка при зареждане");
            } finally {
                setFetchingContexts(false);
            }
        };
        fetchContexts();
    }, [user]);
if (!user) return <Unregistered />;
    if (isLoading || fetchingContexts) return <LoadingScreen />;
    

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleDeleteContext = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`${API}/context/${deleteTarget.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Неуспешно изтриване");
            setContexts((prev) => prev.filter((ctx) => ctx.id !== deleteTarget.id));
            setDeleteTarget(null);
            setCompletedContext(null);
        } catch {
            alert("Грешка при изтриване");
        } finally {
            setDeleting(false);
        }
    };

    const handleSubmitUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedContext || !updateInput.trim()) return;
        setLoadingUpdate(true);
        setDisabling(true);

        try {
            const res = await fetch(`${API}/context/${selectedContext.id}/update`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    original_prompt: updateInput,
                    hobby: selectedContext.hobby,
                    level: selectedContext.level,
                    goals: selectedContext.goals,
                }),
            });

            if (!res.ok) throw new Error("Неуспешна актуализация");

            const updated = await res.json();
            const newProgress: number = updated.progress ?? selectedContext.progress;
            const increment = newProgress - selectedContext.progress;
            const planWasRegenerated = updated.plan_updated === true;

            // Build response message — include plan notice when relevant
            const responseMsg = [
                increment > 0
                    ? `Отлично! Прогресът е актуализиран с ${increment}%.`
                    : "Продължавайте да практикувате — прогресът ви ще бъде отчетен следващия път.",
                planWasRegenerated ? "🔄 Планът ви е актуализиран спрямо новото ви ниво!" : null,
            ].filter(Boolean).join(" ");

            setContextUpdates((prev) => [
                ...prev,
                {
                    contextId: selectedContext.id,
                    update: updateInput,
                    response: responseMsg,
                    progressIncrement: increment,
                    planUpdated: planWasRegenerated,
                },
            ]);

            // Update context card — level/goals/hobby may have changed too
            setContexts((prev) =>
                prev.map((ctx) => {
                    if (ctx.id !== selectedContext.id) return ctx;
                    const merged = {
                        ...ctx,
                        progress: newProgress,
                        level:    updated.level ?? ctx.level,
                        goals:    updated.goals ?? ctx.goals,
                        hobby:    updated.hobby ?? ctx.hobby,
                    };
                    if (newProgress === 100) setCompletedContext({ ...merged });
                    return merged;
                })
            );
            setUpdateInput("");
        } catch (err: any) {
            setContextUpdates((prev) => [
                ...prev,
                {
                    contextId: selectedContext.id,
                    update: updateInput,
                    response: err.message ?? "Грешка при актуализацията",
                    progressIncrement: 0,
                },
            ]);
        } finally {
            setLoadingUpdate(false);
            setDisabling(false);
        }
    };

    const getStatusColor = (progress: number) => {
        const s = deriveStatus(progress);
        if (s === "learning")   return "from-blue-500 to-blue-600";
        if (s === "practicing") return "from-orange-500 to-orange-600";
        return "from-green-500 to-green-600";
    };
   
    return (
        <>
            {loadingUpdate && <LoadingScreen />}

            {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
            <AnimatePresence>
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="max-w-md w-full mx-4 p-8 rounded-2xl bg-gray-900 border border-red-500/30 shadow-2xl text-center"
                        >
                            <div className="mb-4 text-5xl">⚠️</div>
                            <h3 className="text-2xl font-bold mb-3 text-red-400">Сигурни ли сте?</h3>
                            <p className="text-gray-400 mb-6">
                                Това действие ще изтрие контекста{" "}
                                <span className="text-red-400 font-semibold">{deleteTarget.hobby}</span>{" "}
                                завинаги. Това действие е необратимо.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={deleting}
                                    className="flex-1 py-3 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 transition-all"
                                >
                                    Отказ
                                </button>
                                <button
                                    onClick={handleDeleteContext}
                                    disabled={deleteCountdown > 0 || deleting}
                                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                                        deleteCountdown > 0
                                            ? "bg-red-900/40 text-red-400 cursor-not-allowed"
                                            : "bg-gradient-to-br from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                                    }`}
                                >
                                    {deleteCountdown > 0
                                        ? `Изчакайте ${deleteCountdown}s`
                                        : deleting ? "Изтриване..." : "Да, изтрий"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── COMPLETION MODAL ──────────────────────────────────────────── */}
            <AnimatePresence>
                {completedContext && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="max-w-md w-full mx-4 p-8 rounded-2xl bg-gray-900 border border-green-500/30 shadow-2xl text-center"
                        >
                            <div className="mb-6 text-6xl">🎉</div>
                            <h3 className="text-2xl font-bold mb-2 bg-gradient-to-br from-green-300 to-green-500 bg-clip-text text-transparent">
                                Поздравления!
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Завършили сте{" "}
                                <span className="text-green-400 font-semibold">{completedContext.hobby}</span>!
                                Можете да го изтриете и да създадете нов контекст.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setCompletedContext(null)}
                                    className="flex-1 py-3 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 transition-all"
                                >
                                    Затвори
                                </button>
                                <button
                                    onClick={() => {
                                        setCompletedContext(null);
                                        setDeleteTarget(completedContext);
                                    }}
                                    className="flex-1 py-3 rounded-lg font-semibold bg-gradient-to-br from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all"
                                >
                                    Изтрий контекст
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── UPDATE MODAL ──────────────────────────────────────────────── */}
            <AnimatePresence>
                {showUpdateModal && selectedContext && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className="max-w-3xl w-full mx-4 my-8 p-6 rounded-2xl bg-gray-900 border border-orange-500/30 shadow-2xl"
                        >
                            <div className="mb-6">
                                <h3 className="text-2xl font-bold mb-2 bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent">
                                    {selectedContext.hobby} — Обновяване на прогреса
                                </h3>
                                <p className="text-gray-400 text-sm">Разкажете ни какво сте научили или на какво работите</p>
                            </div>

                            <div className="bg-black/40 p-4 rounded-lg mb-6 border border-orange-500/10">
                                <p className="text-sm text-gray-400 mb-2">
                                    <span className="text-orange-400 font-semibold">Текущо ниво:</span>{" "}
                                    {selectedContext.level ?? "—"}
                                </p>
                                <p className="text-sm text-gray-400">
                                    <span className="text-orange-400 font-semibold">Цели:</span>{" "}
                                    {selectedContext.goals?.join(", ") ?? "—"}
                                </p>
                            </div>

                            <form onSubmit={handleSubmitUpdate} className="mb-6">
                                <label className="block text-sm font-semibold text-orange-400 mb-3">
                                    Моята актуализация
                                </label>
                                <textarea
                                    value={updateInput}
                                    onChange={(e) => setUpdateInput(e.target.value)}
                                    rows={4}
                                    placeholder="Например: Научих да свиря акорди, сега искам да работя с двете ръце..."
                                    className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-orange-500/20 focus:ring-2 focus:ring-orange-500/40 outline-none transition-all resize-none text-gray-200"
                                />
                                <button
                                    type="submit"
                                    disabled={!updateInput.trim() || disabling}
                                    className={`mt-4 w-full py-3 rounded-lg font-semibold transition-all ${
                                        !updateInput.trim() || disabling
                                            ? "bg-orange-900/40 text-orange-400 cursor-not-allowed"
                                            : "bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 shadow-lg shadow-orange-500/20"
                                    }`}
                                >
                                    {disabling
                                        ? "Изпращане..."
                                        : !updateInput.trim()
                                            ? "Въведете актуализация..."
                                            : "Изпрати актуализация"}
                                </button>
                            </form>

                            {contextUpdates
                                .filter((upd) => upd.contextId === selectedContext.id)
                                .map((upd, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-4 space-y-3 border-t border-gray-700 pt-4"
                                    >
                                        <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
                                            <p className="text-xs text-blue-400 font-semibold mb-1">Вашата актуализация</p>
                                            <p className="text-gray-300">{upd.update}</p>
                                        </div>
                                        {upd.response && (
                                            <div className={`p-4 rounded-lg border ${
                                                upd.progressIncrement && upd.progressIncrement > 0
                                                    ? "bg-green-500/10 border-green-500/20"
                                                    : "bg-orange-500/10 border-orange-500/20"
                                            }`}>
                                                <p className={`text-xs font-semibold mb-1 ${
                                                    upd.progressIncrement && upd.progressIncrement > 0
                                                        ? "text-green-400"
                                                        : "text-orange-400"
                                                }`}>
                                                    {upd.progressIncrement && upd.progressIncrement > 0
                                                        ? "✓ Валидирано"
                                                        : "💡 Обратна връзка"}
                                                </p>
                                                <p className="text-gray-300 text-sm">{upd.response}</p>
                                                {/* Plan regenerated badge */}
                                                {upd.planUpdated && (
                                                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-xs text-violet-400 font-semibold">
                                                        🔄 Планът е обновен — виж детайлната страница
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}

                            <button
                                onClick={() => { setShowUpdateModal(false); setSelectedContext(null); }}
                                className="w-full mt-6 py-3 rounded-lg font-semibold bg-gray-700 hover:bg-gray-600 transition-all"
                            >
                                Затвори
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── MAIN ──────────────────────────────────────────────────────── */}
            <div className="min-h-screen px-4 py-10 text-white">
                <div className="max-w-7xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-12"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent mb-2">
                                    Моите контексти
                                </h1>
                                <p className="text-gray-400">Управлявайте вашите контексти и следете напредъка си.</p>
                            </div>
                            <Link
                                href="/context/new"
                                className="px-6 py-3 rounded-lg font-semibold bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 transition-all shadow-lg shadow-orange-500/20"
                            >
                                + Нов контекст
                            </Link>
                        </div>
                    </motion.div>

                    {fetchError && (
                        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            {fetchError}
                        </div>
                    )}

                    {contexts.length === 0 ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                            <p className="text-gray-400 mb-4">Все още нямате създадени контексти</p>
                            <Link
                                href="/context/new"
                                className="inline-block px-6 py-3 rounded-lg font-semibold bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 transition-all"
                            >
                                Създайте първия си контекст
                            </Link>
                        </motion.div>
                    ) : (
                        <div className="grid gap-8 mb-12">
                            {contexts.map((context, idx) => (
                                <motion.div
                                    key={context.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                                    className="p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-orange-500/20 shadow-xl hover:shadow-2xl transition-all"
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Link href={`/context/${context.id}`}>
                                                    <h3 className="text-2xl font-bold text-white hover:text-orange-400 transition-colors cursor-pointer">
                                                        {context.hobby}
                                                    </h3>
                                                </Link>
                                                {context.progress === 100 && (
                                                    <button
                                                        onClick={() => setCompletedContext(context)}
                                                        className="text-2xl cursor-pointer hover:scale-125 transition-transform"
                                                        title="Контекст завършен"
                                                    >
                                                        ❗
                                                    </button>
                                                )}
                                                {/* Delete button — your addition */}
                                                <button
                                                    onClick={() => setDeleteTarget(context)}
                                                    className="px-5 py-3 rounded-lg font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm"
                                                >
                                                    Изтрий
                                                </button>
                                            </div>
                                            <p className="text-gray-400 text-sm mb-4">{context.original_prompt}</p>

                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">Статус:</span>
                                                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-br ${getStatusColor(context.progress)} text-white`}>
                                                        {deriveStatus(context.progress) === "learning"   && "🎓 Учене"}
                                                        {deriveStatus(context.progress) === "practicing" && "⚡ Практика"}
                                                        {deriveStatus(context.progress) === "mastering"  && "🏆 Майстор"}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    Създаден: {new Date(context.created_at).toLocaleDateString("bg-BG")}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-orange-400">Ниво познания</span>
                                            <span className="text-xs text-gray-400">{context.level ?? "—"}</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${context.progress}%` }}
                                                transition={{ duration: 0.8 }}
                                                className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">{context.progress}% завършено</p>
                                    </div>

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-y border-gray-800">
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-orange-400">{context.goals?.length ?? 0}</p>
                                            <p className="text-xs text-gray-400">Цели</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-orange-400">
                                                {contextUpdates.filter(
                                                    (upd) => upd.contextId === context.id && upd.progressIncrement && upd.progressIncrement > 0
                                                ).length}
                                            </p>
                                            <p className="text-xs text-gray-400">Валидни актуализации</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-orange-400">{Math.floor(context.progress / 10)}</p>
                                            <p className="text-xs text-gray-400">Сесии</p>
                                        </div>
                                    </div>

                                    {/* Goals */}
                                    {context.goals && context.goals.length > 0 && (
                                        <div className="mb-6">
                                            <p className="text-xs font-semibold text-orange-400 mb-3">Текущи цели</p>
                                            <div className="flex flex-wrap gap-2">
                                                {context.goals.map((goal, i) => (
                                                    <span key={i} className="px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs text-gray-300">
                                                        {goal}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setSelectedContext(context); setShowUpdateModal(true); }}
                                            className="flex-1 py-3 rounded-lg font-semibold bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 transition-all"
                                        >
                                            Актуализирай прогреса
                                        </button>
                                        <Link
                                            href={`/context/${context.id}`}
                                            className="px-5 py-3 rounded-lg font-semibold border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all text-sm flex items-center gap-1"
                                        >
                                            Виж план →
                                        </Link>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}