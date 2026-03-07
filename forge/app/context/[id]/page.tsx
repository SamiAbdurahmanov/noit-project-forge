"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { withAuth } from "@/src/withAuth";
import { getToken } from "@/src/lib/authHelper";


const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanStep = { title: string; detail: string };

type PlanPhase = {
    id: number;
    phase: string;
    title: string;
    duration: string;
    icon: string;
    status: "completed" | "current" | "upcoming";
    steps: PlanStep[];
};

type PlanTip = { icon: string; text: string };

type LearningPlan = {
    title: string;
    description: string;
    phases: PlanPhase[];
    tips: PlanTip[];
};

type Context = {
    id: number;
    user_id: number;
    original_prompt: string;
    hobby: string;
    level: string | null;
    goals: string[] | null;
    plan: LearningPlan | null;
    created_at: string;
    updated_at: string;
    progress: number;
};

type AnalysisFeedbackItem = {
    category: string;
    score: number;
    feedback: string;
    suggestion: string;
};

type AnalysisResult = {
    overall_score: number;
    summary: string;
    feedback_items: AnalysisFeedbackItem[];
    next_focus: string;
    progress_increment: number;
};

type UploadedFile = {
    file: File;
    preview: string;
    b64: string;
    mediaType: string;
};

// ─── Phase palette ────────────────────────────────────────────────────────────

const PHASE_PALETTE = [
    { color: "from-sky-400 to-blue-500", border: "border-sky-500/30", glow: "shadow-sky-500/10" },
    { color: "from-orange-400 to-orange-500", border: "border-orange-500/30", glow: "shadow-orange-500/10" },
    { color: "from-violet-400 to-purple-500", border: "border-violet-500/30", glow: "shadow-violet-500/10" },
    { color: "from-emerald-400 to-green-500", border: "border-emerald-500/30", glow: "shadow-emerald-500/10" },
];

const statusConfig = {
    completed: {
        label: "Завършена",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        dot: "bg-emerald-400",
    },
    current: {
        label: "В момента",
        color: "text-orange-400",
        bg: "bg-orange-500/10 border-orange-500/20",
        dot: "bg-orange-400 animate-pulse",
    },
    upcoming: {
        label: "Предстояща",
        color: "text-gray-500",
        bg: "bg-gray-800/60 border-gray-700/40",
        dot: "bg-gray-600",
    },
};

// ─── File → base64 helper ─────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<{ b64: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const [header, b64] = result.split(",");
            const mediaType = header.replace("data:", "").replace(";base64", "");
            resolve({ b64, mediaType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function FileDropZone({
    label,
    icon,
    uploaded,
    onUpload,
    onRemove,
    disabled,
}: {
    label: string;
    icon: string;
    uploaded: UploadedFile | null;
    onUpload: (f: UploadedFile) => void;
    onRemove: () => void;
    disabled?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const processFile = async (file: File) => {
        if (!file.type.startsWith("image/")) return; // images only
        const preview = URL.createObjectURL(file);
        const { b64, mediaType } = await fileToBase64(file);
        onUpload({ file, preview, b64, mediaType });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };

    return (
        <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-400 mb-2 tracking-widest uppercase">{label}</p>
            {!uploaded ? (
                <motion.div
                    onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => !disabled && inputRef.current?.click()}
                    animate={{ borderColor: dragging ? "rgba(249,115,22,0.7)" : "rgba(249,115,22,0.15)" }}
                    className={`relative flex flex-col items-center justify-center gap-3 h-44 rounded-xl border-2 border-dashed border-orange-500/20 bg-black/30 transition-all group ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-orange-500/5 hover:border-orange-500/40"
                        }`}
                >
                    <span className="text-4xl">{icon}</span>
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-300 group-hover:text-orange-300 transition-colors">
                            Плъзни файл тук
                        </p>
                        <p className="text-xs text-gray-600 mt-1">или клик за избор</p>
                    </div>
                    <p className="text-xs text-gray-700">PNG, JPG, WEBP</p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) processFile(file);
                        }}
                    />
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative h-44 rounded-xl overflow-hidden border border-orange-500/30 bg-black"
                >
                    <img src={uploaded.preview} alt="upload" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                        <p className="text-xs text-white font-medium truncate max-w-[140px]">{uploaded.file.name}</p>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="text-xs px-2 py-1 rounded-md bg-red-600/80 hover:bg-red-500 text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="absolute top-2 right-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/80 text-white font-semibold">✓</span>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = score >= 75 ? "#34d399" : score >= 50 ? "#fb923c" : "#f87171";

    return (
        <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="-rotate-90" width="96" height="96">
                <circle cx="48" cy="48" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
                <motion.circle
                    cx="48" cy="48" r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - dash }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                />
            </svg>
            <span className="absolute text-xl font-black" style={{ color }}>{score}</span>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────



export default function ContextPage() {

    const router = useRouter();
    const [ctx, setCtx] = useState<Context | null>(null);
    withAuth(ContextPage);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

    const [myFile, setMyFile] = useState<UploadedFile | null>(null);
    const [refFile, setRefFile] = useState<UploadedFile | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [expandedSchedules, setExpandedSchedules] = useState<Record<string, string>>({});
    const [loadingStep, setLoadingStep] = useState<string | null>(null);
    const { id } = useParams<{ id: string }>();
    const token = getToken();
    // ── Fetch context ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!id) return;

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(`${API}/context/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    if (res.status === 404)
                        throw new Error("Контекстът не е намерен");
                    throw new Error("Грешка при зареждане");
                }

                const data: Context = await res.json();
                setCtx(data);

                const current = data.plan?.phases.find(
                    (p) => p.status === "current"
                );

                if (current) setExpandedPhase(current.id);
                else if (data.plan?.phases[0])
                    setExpandedPhase(data.plan.phases[0].id);
            } catch (e: any) {
                setError(e.message ?? "Неизвестна грешка");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    // ── Media analysis ─────────────────────────────────────────────────────────
    const handleAnalysis = async () => {
        if (!myFile || !refFile || !ctx) return;
        setAnalysisLoading(true);
        setAnalysisError(null);
        setAnalysisResult(null);

        try {
            const res = await fetch(`${API}/context/${ctx.id}/analyze`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    user_image_b64: myFile.b64,
                    reference_image_b64: refFile.b64,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail ?? "Анализът не успя");
            }

            const result: AnalysisResult = await res.json();
            setAnalysisResult(result);

            // Update local progress
            if (result.progress_increment > 0 && ctx) {
                setCtx((prev) =>
                    prev ? { ...prev, progress: Math.min(100, prev.progress + result.progress_increment) } : prev
                );
            }
        } catch (e: any) {
            setAnalysisError(e.message ?? "Неизвестна грешка");
        } finally {
            setAnalysisLoading(false);
        }
    };

    // ── Reset analysis ─────────────────────────────────────────────────────────
    const resetAnalysis = () => {
        setMyFile(null);
        setRefFile(null);
        setAnalysisResult(null);
        setAnalysisError(null);
    };

    // ── Loading / error states ─────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">Зареждане на контекст...</p>
                </div>
            </div>
        );
    }

    if (error || !ctx) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="text-center max-w-sm">
                    <p className="text-6xl mb-4">⚠️</p>
                    <p className="text-red-400 mb-4">{error ?? "Контекстът не беше намерен"}</p>
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition-all"
                    >
                        ← Назад
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen  text-white">
            {/* Ambient */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -right-60 w-[500px] h-[500px] bg-violet-500/4 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-blue-500/3 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-4xl mx-auto px-4 py-12">

                {/* ── Header ── */}
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-12"
                >
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-5 tracking-widest uppercase">
                        <button onClick={() => router.back()} className="hover:text-orange-400 transition-colors">
                            ← Контексти
                        </button>
                        <span>/</span>
                        <span className="text-orange-500">{ctx.hobby}</span>
                    </div>

                    <div className="flex items-start gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-3xl shadow-lg shadow-orange-500/20 shrink-0">
                            {ctx.plan?.phases[0]?.icon ?? "🎯"}
                        </div>
                        <div className="flex-1">
                            <h1 className="text-3xl font-black tracking-tight mb-1">{ctx.hobby}</h1>
                            <p className="text-gray-500 text-sm">
                                {ctx.level ?? "—"} · {ctx.goals?.length ?? 0} цели
                            </p>
                            <div className="mt-4 flex items-center gap-3">
                                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${ctx.progress}%` }}
                                        transition={{ duration: 1, delay: 0.3 }}
                                        className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                                    />
                                </div>
                                <span className="text-xs font-bold text-orange-400 shrink-0">{ctx.progress}%</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ── No plan fallback ── */}
                {!ctx.plan && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mb-12 p-6 rounded-2xl border border-orange-500/20 bg-black/30 text-center"
                    >
                        <p className="text-gray-400 mb-4 text-sm">
                            Планът за обучение не е генериран все още.
                        </p>
                        <button
                            onClick={async () => {
                                const res = await fetch(`${API}/context/${ctx.id}/regenerate-plan`, {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                if (res.ok) {
                                    const updated: Context = await res.json();
                                    setCtx(updated);
                                    const current = updated.plan?.phases.find((p) => p.status === "current");
                                    setExpandedPhase(current?.id ?? updated.plan?.phases[0]?.id ?? null);
                                }
                            }}
                            className="px-6 py-2.5 rounded-lg font-semibold bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 transition-all text-sm"
                        >
                            🔄 Генерирай план
                        </button>
                    </motion.div>
                )}

                {/* ── Plan ── */}
                {ctx.plan && (
                    <>
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="mb-8"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 font-semibold tracking-wider uppercase mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                                AI-генериран план
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">{ctx.plan.title}</h2>
                            <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">{ctx.plan.description}</p>
                        </motion.div>

                        {/* Phases */}
                        <div className="space-y-6 mb-14">
                            {ctx.plan.phases.map((phase, idx) => {
                                const palette = PHASE_PALETTE[idx % PHASE_PALETTE.length];
                                const isOpen = expandedPhase === phase.id;
                                const sc = statusConfig[phase.status] ?? statusConfig.upcoming;
                                const isUpcoming = phase.status === "upcoming";

                                return (
                                    <motion.div
                                        key={phase.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: idx * 0.08 }}
                                    >
                                        {/* Connector Line Between Phases */}
                                        {idx > 0 && (
                                            <div className="flex justify-start pl-8 mb-2">
                                                <div className="w-px h-6 bg-gradient-to-b from-gray-700 via-gray-800 to-transparent" />
                                            </div>
                                        )}

                                        <div
                                            className={`rounded-2xl border transition-all duration-300 ${isUpcoming
                                                    ? "border-gray-800/40 bg-black/20"
                                                    : `bg-[#0a0a0a] border-gray-800 hover:border-orange-500/30 shadow-2xl ${palette.glow}`
                                                } overflow-hidden relative`}
                                        >
                                            {/* Active Phase subtle top highlight */}
                                            {!isUpcoming && (
                                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
                                            )}

                                            {/* Phase Header Button */}
                                            <button
                                                onClick={() => setExpandedPhase(isOpen ? null : phase.id)}
                                                className="w-full px-6 py-5 flex items-center gap-5 text-left group focus:outline-none"
                                            >
                                                {/* Icon Box */}
                                                <div
                                                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${palette.color} flex items-center justify-center text-2xl shrink-0 shadow-lg transition-transform group-hover:scale-105 ${isUpcoming ? "opacity-30 grayscale" : "ring-1 ring-white/10"
                                                        }`}
                                                >
                                                    {phase.icon}
                                                </div>

                                                {/* Title & Meta */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[11px] text-gray-500 font-bold tracking-[0.2em] uppercase">
                                                            {phase.phase}
                                                        </span>
                                                        <span className="text-gray-700 text-[10px]">●</span>
                                                        <span className="text-xs text-gray-400 font-medium tracking-wide">
                                                            {phase.duration}
                                                        </span>
                                                    </div>
                                                    <h3
                                                        className={`font-bold text-lg tracking-tight ${isUpcoming ? "text-gray-500" : "text-gray-50"
                                                            }`}
                                                    >
                                                        {phase.title}
                                                    </h3>
                                                </div>

                                                {/* Status Badge & Chevron */}
                                                <div className="flex items-center gap-4 shrink-0">
                                                    <span
                                                        className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${sc.bg} ${sc.color} ${isUpcoming ? 'border-gray-800' : 'border-white/10'}`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${!isUpcoming && 'animate-pulse'}`} />
                                                        {sc.label}
                                                    </span>

                                                    <motion.div
                                                        animate={{ rotate: isOpen ? 180 : 0 }}
                                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                                        className={`flex items-center justify-center w-8 h-8 rounded-full bg-gray-900/50 border border-gray-800 transition-colors ${isOpen ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'text-gray-500 group-hover:text-orange-400 group-hover:border-orange-500/30'
                                                            }`}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="6 9 12 15 18 9"></polyline>
                                                        </svg>
                                                    </motion.div>
                                                </div>
                                            </button>

                                            {/* Expandable Content (Steps) */}
                                            <AnimatePresence initial={false}>
                                                {isOpen && (
                                                    <motion.div
                                                        key="content"
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                                                        className="overflow-hidden bg-[#050505]"
                                                    >
                                                        <div className="px-6 py-6 space-y-6 border-t border-gray-800/60">
                                                            {phase.steps.map((step, si) => {
                                                                const stepKey = `${phase.id}-${si}`;
                                                                const isStepExpanded = expandedSchedules[stepKey];
                                                                const isStepLoading = loadingStep === stepKey;

                                                                return (
                                                                    <motion.div
                                                                        key={si}
                                                                        initial={{ opacity: 0, x: -10 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ delay: si * 0.05 + 0.1 }}
                                                                        className="flex gap-5 group"
                                                                    >
                                                                        {/* Step Number & Connector */}
                                                                        <div className="flex flex-col items-center shrink-0 mt-0.5">
                                                                            <div
                                                                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shadow-md ring-4 ring-[#050505] relative z-10 ${isUpcoming
                                                                                        ? "bg-gray-900 text-gray-600 border border-gray-800"
                                                                                        : `bg-gradient-to-br ${palette.color} text-white`
                                                                                    }`}
                                                                            >
                                                                                {si + 1}
                                                                            </div>
                                                                            {si < phase.steps.length - 1 && (
                                                                                <div className="w-px h-full mt-2 bg-gradient-to-b from-gray-800 to-gray-800/20 rounded-full" />
                                                                            )}
                                                                        </div>

                                                                        {/* Step Content */}
                                                                        <div className="flex-1 pb-2">
                                                                            <h4 className={`text-sm font-bold mb-1.5 ${isUpcoming ? "text-gray-500" : "text-gray-200"
                                                                                }`}>
                                                                                {step.title}
                                                                            </h4>
                                                                            <p className="text-[13px] text-gray-500 leading-relaxed mb-3">
                                                                                {step.detail}
                                                                            </p>

                                                                            {/* Expand Action Button */}
                                                                            <button
                                                                                onClick={async () => {
                                                                                    if (isStepExpanded) {
                                                                                        setExpandedSchedules((prev) => {
                                                                                            const copy = { ...prev };
                                                                                            delete copy[stepKey];
                                                                                            return copy;
                                                                                        });
                                                                                        return;
                                                                                    }
                                                                                    try {
                                                                                        setLoadingStep(stepKey);
                                                                                        const res = await fetch(`${API}/context/${ctx.id}/step-details`, {
                                                                                            method: "POST",
                                                                                            headers: { 
                                                                                                "Content-Type": "application/json",
                                                                                                Authorization: `Bearer ${token}`
                                                                                            },
                                                                                            body: JSON.stringify({
                                                                                                phase_title: phase.title,
                                                                                                step_title: step.title,
                                                                                                step_detail: step.detail,
                                                                                            }),
                                                                                        });
                                                                                        if (!res.ok) throw new Error("Failed");
                                                                                        const data = await res.json();
                                                                                        setExpandedSchedules((prev) => ({
                                                                                            ...prev,
                                                                                            [stepKey]: data.detailed_schedule,
                                                                                        }));
                                                                                    } catch (e) {
                                                                                        console.error(e);
                                                                                    } finally {
                                                                                        setLoadingStep(null);
                                                                                    }
                                                                                }}
                                                                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${isStepExpanded
                                                                                        ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                                                                        : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 ring-1 ring-orange-500/20"
                                                                                    }`}
                                                                            >
                                                                                {isStepLoading ? (
                                                                                    <><span className="w-3 h-3 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" /> Зареждане...</>
                                                                                ) : isStepExpanded ? (
                                                                                    <>✕ Скрий детайлите</>
                                                                                ) : (
                                                                                    <>⬎ Пълен график</>
                                                                                )}
                                                                            </button>

                                                                            {/* Expanded Schedule Box */}
                                                                            <AnimatePresence>
                                                                                {isStepExpanded && (
                                                                                    <motion.div
                                                                                        initial={{ opacity: 0, y: -10, height: 0 }}
                                                                                        animate={{ opacity: 1, y: 0, height: "auto" }}
                                                                                        exit={{ opacity: 0, y: -10, height: 0 }}
                                                                                        transition={{ duration: 0.2 }}
                                                                                        className="mt-3 overflow-hidden"
                                                                                    >
                                                                                        <div className="p-4 rounded-r-xl rounded-bl-xl bg-[#111] border-l-2 border-orange-500 text-[13px] text-gray-300 whitespace-pre-line leading-relaxed shadow-inner">
                                                                                            {expandedSchedules[stepKey]}
                                                                                        </div>
                                                                                    </motion.div>
                                                                                )}
                                                                            </AnimatePresence>
                                                                        </div>
                                                                    </motion.div>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Tips */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="mb-14"
                        >
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                                Съвети от AI
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {ctx.plan.tips.map((tip, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-xl bg-black/30 border border-gray-800/60 hover:border-orange-500/20 transition-colors"
                                    >
                                        <span className="text-2xl mb-3 block">{tip.icon}</span>
                                        <p className="text-xs text-gray-400 leading-relaxed">{tip.text}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}

                {/* ── Media Analysis ── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="rounded-2xl border border-orange-500/20 bg-black/40 backdrop-blur-sm p-6 shadow-2xl shadow-orange-500/5"
                >
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 font-semibold tracking-wider uppercase mb-3">
                            <span>🎬</span>
                            AI анализ на изпълнението
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Сравни твоето изпълнение</h3>
                        <p className="text-sm text-gray-500">
                            Качи снимка от твоето изпълнение и референтен пример. Снимките се
                            нормализират автоматично (CLAHE, шумопотискане, изостряне) преди
                            изпращане към GPT-4o.
                        </p>
                    </div>

                    {!analysisResult ? (
                        <>
                            <div className="flex flex-col sm:flex-row gap-4 mb-5">
                                <FileDropZone
                                    label="Моето изпълнение"
                                    icon="🎤"
                                    uploaded={myFile}
                                    onUpload={setMyFile}
                                    onRemove={() => setMyFile(null)}
                                    disabled={analysisLoading}
                                />
                                <div className="flex sm:flex-col items-center justify-center gap-1 shrink-0">
                                    <div className="hidden sm:block w-px flex-1 bg-gradient-to-b from-transparent via-orange-500/20 to-transparent" />
                                    <div className="w-9 h-9 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xs font-black text-orange-400">
                                        VS
                                    </div>
                                    <div className="hidden sm:block w-px flex-1 bg-gradient-to-b from-transparent via-orange-500/20 to-transparent" />
                                </div>
                                <FileDropZone
                                    label="Референтно изпълнение"
                                    icon="⭐"
                                    uploaded={refFile}
                                    onUpload={setRefFile}
                                    onRemove={() => setRefFile(null)}
                                    disabled={analysisLoading}
                                />
                            </div>

                            {analysisError && (
                                <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    {analysisError}
                                </div>
                            )}

                            <button
                                onClick={handleAnalysis}
                                disabled={!myFile || !refFile || analysisLoading}
                                className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                            >
                                {analysisLoading ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        GPT-4o анализира...
                                    </>
                                ) : (
                                    <>
                                        <span>🔍</span> Изпрати за AI анализ
                                    </>
                                )}
                            </button>

                            {(!myFile || !refFile) && (
                                <p className="text-center text-xs text-gray-700 mt-3">
                                    Качи и двете снимки, за да активираш анализа
                                </p>
                            )}
                        </>
                    ) : (
                        /* ── Analysis result ── */
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                            {/* Overall */}
                            <div className="flex items-center gap-6 mb-6 p-5 rounded-xl bg-black/40 border border-orange-500/20">
                                <ScoreRing score={analysisResult.overall_score} />
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Обща оценка</p>
                                    <p className="text-white text-sm leading-relaxed">{analysisResult.summary}</p>
                                    {analysisResult.progress_increment > 0 && (
                                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-400 font-semibold">
                                            <span>+{analysisResult.progress_increment}%</span>
                                            <span className="text-gray-600">прогрес добавен</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Feedback items */}
                            <div className="space-y-3 mb-6">
                                {analysisResult.feedback_items.map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.07 }}
                                        className="p-4 rounded-xl bg-black/30 border border-gray-800/60"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-semibold text-gray-200">{item.category}</p>
                                            <span
                                                className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.score >= 75
                                                    ? "bg-emerald-500/15 text-emerald-400"
                                                    : item.score >= 50
                                                        ? "bg-orange-500/15 text-orange-400"
                                                        : "bg-red-500/15 text-red-400"
                                                    }`}
                                            >
                                                {item.score}/100
                                            </span>
                                        </div>
                                        {/* mini bar */}
                                        <div className="w-full h-1 bg-gray-800 rounded-full mb-3 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${item.score}%` }}
                                                transition={{ duration: 0.8, delay: i * 0.07 }}
                                                className={`h-full rounded-full ${item.score >= 75
                                                    ? "bg-emerald-400"
                                                    : item.score >= 50
                                                        ? "bg-orange-400"
                                                        : "bg-red-400"
                                                    }`}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400 mb-1">{item.feedback}</p>
                                        <p className="text-xs text-orange-400/80 font-medium">→ {item.suggestion}</p>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Next focus */}
                            <div className="mb-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                                <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest mb-1">
                                    Следващ фокус
                                </p>
                                <p className="text-sm text-gray-300">{analysisResult.next_focus}</p>
                            </div>

                            <button
                                onClick={resetAnalysis}
                                className="w-full py-3 rounded-xl font-semibold bg-gray-800 hover:bg-gray-700 transition-all text-sm"
                            >
                                🔄 Нов анализ
                            </button>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}