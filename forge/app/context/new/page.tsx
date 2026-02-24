"use client";

import { useUser } from "@/context/UserContext";
import { ErrorScreen } from "@/src/lib/components/ErrorScreen";
import LoadingScreen from "@/src/lib/components/LoadingScreen";
import Unregistered from "@/src/lib/components/Unregistered";
import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { withAuth } from "@/src/withAuth";

type SubmitError = {
    type: "validation" | "network" | "server";
    message: string;
};

type Classification = {
    Hobby: string | null;
    Level: string | null;
    Goals: string[] | null;
};

export default function ForgeNewContextPage() {
    const { user, isLoading } = useUser();
    withAuth(ForgeNewContextPage);
    const router = useRouter();

    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<SubmitError | null>(null);

    // Instruction gate
    const [showInstructions, setShowInstructions] = useState(true);
    const [instructionsAccepted, setInstructionsAccepted] = useState(false);

    // Classification approval flow
    const [showClassification, setShowClassification] = useState(false);
    const [originalPrompt, setOriginalPrompt] = useState("");
    const [classification, setClassification] = useState<Classification>({
        Hobby: null,
        Level: null,
        Goals: null,
    });

    const [buttonDisabled, setButtonDisabled] = useState(false);
    if (isLoading) {
        return <LoadingScreen />;
    }
    if (!user) {
        return <Unregistered />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!instructionsAccepted) {
            setError({
                type: "validation",
                message: "Моля, прочетете и приемете инструкциите преди да продължите.",
            });
            return;
        }

        if (input.trim().length < 10) {
            setError({
                type: "validation",
                message:
                    "Описанието е твърде кратко. Моля, добавете цел, ниво и контекст.",
            });
            return;
        }

        setLoading(true);

        try {
            const res = await fetch("http://localhost:8000/context/create", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ user_input: input }),
            });

            if (!res.ok) {
                let message =
                    "Възникна грешка при създаване на контекста. Моля, опитайте отново.";

                try {
                    const data = await res.json();
                    if (data?.detail) message = data.detail;
                } catch {
                    // ignore JSON parse errors
                }

                setError({
                    type: "server",
                    message,
                });
                return;
            }

            const data = await res.json();
            console.log("Classification received:", data);

            // Store original prompt and classification
            setOriginalPrompt(data.original_prompt);
            setClassification(data.classification);

            // Show classification approval modal
            setShowClassification(true);
        } catch (err) {
            setError({
                type: "network",
                message:
                    "Неуспешна връзка със сървъра. Проверете интернет връзката си и опитайте отново.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmClassification = async () => {
        setError(null);
        setLoading(true);
        setButtonDisabled(true);
        try {
            const res = await fetch("http://localhost:8000/context/confirm", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({

                    original_prompt: originalPrompt,
                    hobby: classification.Hobby,
                    level: classification.Level,
                    goals: classification.Goals,
                }),
            });

            if (!res.ok) {
                let message = "Грешка при запазване. Моля, опитайте отново.";

                try {
                    const data = await res.json();
                    if (data?.detail) message = data.detail;
                } catch {
                    // ignore
                }

                setError({
                    type: "server",
                    message,
                });
                return;
            }

            const data = await res.json();
            console.log("Context saved:", data);

            // Success! Redirect to contexts page or show success message
            router.push("/context/myContexts"); // Adjust route as needed
        } catch (err) {
            setError({
                type: "network",
                message: "Неуспешна връзка със сървъра.",
            });
        } finally {
            setLoading(false);
            setButtonDisabled(false);
        }
    };

    const handleRejectClassification = () => {
        setShowClassification(false);
        // Keep the input so user can modify it
        // setInput(""); // Removed - user can now edit their original prompt
    };

    return (
        <>
            {loading && <LoadingScreen />}

            {error && (
                <ErrorScreen
                    errorMessage={error.message}
                    onClose={() => setError(null)}
                />
            )}

            {/* ================= INSTRUCTION MODAL ================= */}
            {showInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="max-w-lg w-full mx-4 p-6 rounded-2xl bg-gray-900 border border-orange-500/30 shadow-2xl"
                    >
                        <h3 className="text-2xl font-bold mb-4 bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent">
                            Как да опишете контекста правилно
                        </h3>

                        <div className="text-sm text-gray-300 space-y-4">
                            <p>
                                За да може AI моделът да класифицира правилно вашия контекст,
                                описанието трябва да бъде{" "}
                                <span className="text-orange-400 font-semibold">
                                    ясно, конкретно и пълно
                                </span>
                                .
                            </p>

                            <div>
                                <p className="font-semibold text-orange-400 mb-1">
                                    Задължително включете:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-gray-400">
                                    <li>Основна тема или област</li>
                                    <li>Цел (учене, практика, анализ и др.)</li>
                                    <li>Ниво на познания</li>
                                    <li>Контекст на използване</li>
                                </ul>
                            </div>

                            <div>
                                <p className="font-semibold text-orange-400 mb-1">
                                    ✔ Добър пример:
                                </p>
                                <p className="bg-black/40 p-3 rounded-lg text-gray-300">
                                    „Искам да науча пиано като начинаещ, с фокус върху класическа
                                    музика и ежедневни упражнения у дома."
                                </p>
                            </div>

                            <div>
                                <p className="font-semibold text-orange-400 mb-1">
                                    ✖ Лош пример:
                                </p>
                                <p className="bg-black/40 p-3 rounded-lg text-gray-500">
                                    „Пиано"
                                </p>
                            </div>

                            <p className="text-gray-400">
                                Колкото по-добре е описан контекстът, толкова по-точна и полезна
                                ще бъде AI обработката.
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                setInstructionsAccepted(true);
                                setShowInstructions(false);
                            }}
                            className="mt-6 w-full py-3 rounded-lg font-semibold
              bg-gradient-to-br from-orange-600 to-orange-500
              hover:from-orange-500 hover:to-orange-400 transition-all"
                        >
                            Разбрах и продължавам
                        </button>
                    </motion.div>
                </div>
            )}
            {/* ================= END INSTRUCTION MODAL ================= */}

            {/* ================= CLASSIFICATION APPROVAL MODAL ================= */}
            {showClassification && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="max-w-2xl w-full mx-4 my-8 p-6 rounded-2xl bg-gray-900 border border-orange-500/30 shadow-2xl"
                    >
                        <h3 className="text-2xl font-bold mb-4 bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent">
                            Потвърдете класификацията
                        </h3>

                        <div className="text-sm text-gray-300 space-y-4">
                            <div>
                                <p className="font-semibold text-orange-400 mb-2">
                                    Вашият оригинален текст:
                                </p>
                                <p className="bg-black/40 p-3 rounded-lg text-gray-300">
                                    {originalPrompt}
                                </p>
                            </div>

                            <div className="border-t border-gray-700 pt-4">
                                <p className="text-gray-400 mb-4">
                                    AI моделът извлече следната информация от вашето описание:
                                </p>

                                {/* Hobby - Read Only */}
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-orange-400 mb-2">
                                        Хоби
                                    </label>
                                    <div className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-orange-500/10 text-gray-200">
                                        {classification.Hobby || "—"}
                                    </div>
                                </div>

                                {/* Level - Read Only */}
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-orange-400 mb-2">
                                        Ниво
                                    </label>
                                    <div className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-orange-500/10 text-gray-200">
                                        {classification.Level || "—"}
                                    </div>
                                </div>

                                {/* Goals - Read Only */}
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-orange-400 mb-2">
                                        Цели
                                    </label>
                                    <div className="w-full px-4 py-2 rounded-lg bg-gray-800/50 border border-orange-500/10 text-gray-200">
                                        {classification.Goals && classification.Goals.length > 0
                                            ? classification.Goals.join(", ")
                                            : "—"}
                                    </div>
                                </div>

                                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                    <p className="text-xs text-orange-300">
                                        💡 Ако класификацията не е правилна, моля натиснете
                                        "Отхвърли" и опишете контекста по-детайлно.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleRejectClassification}
                                className="flex-1 py-3 rounded-lg font-semibold
                  bg-gray-700 hover:bg-gray-600 transition-all"
                            >
                                ✖ Отхвърли и промени описанието
                            </button>

                            <button
                                onClick={handleConfirmClassification}
                                disabled={buttonDisabled}
                                className={`flex-1 py-3 rounded-lg font-semibold transition-all
    ${buttonDisabled
                                        ? "bg-orange-300 text-orange-100 cursor-not-allowed shadow-none"
                                        : "bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 shadow-lg shadow-orange-500/20"
                                    }
  `}
                            >
                                {buttonDisabled ? "Зареждане..." : "✓ Потвърди и запази"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
            {/* ================= END CLASSIFICATION MODAL ================= */}

            <div className="flex justify-center h-full px-4 mt-10 mb-20 text-white overflow-hidden">
                <div className="flex w-full max-w-5xl gap-10 items-center mt-20">
                    {/* LEFT SIDE */}
                    <div className="hidden md:flex flex-col flex-1 justify-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <h1 className="text-4xl font-bold bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent mb-4">
                                Създайте своя контекст
                            </h1>
                            <p className="text-gray-300 text-lg mb-6 max-w-md">
                                Създавайте интелигентни контексти, които захранват вашите
                                творения.
                            </p>
                            <ul className="space-y-3 text-gray-400">
                                <li>🔥 Генериране с контекст</li>
                                <li>🧠 Преизползваеми знания</li>
                                <li>⚡ Моментално усилване</li>
                            </ul>
                        </motion.div>
                    </div>

                    {/* RIGHT SIDE */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                        className="w-full md:max-w-md p-8 rounded-2xl bg-black/30 backdrop-blur-2xl
            border border-orange-500/20 shadow-xl transition-all"
                    >
                        <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent">
                            Нов контекст
                        </h2>

                        <p className="text-center text-gray-400 mb-8 text-sm">
                            Опишете контекста възможно най-точно
                        </p>

                        <form onSubmit={handleSubmit}>
                            <div className="mb-6">
                                <textarea
                                    disabled={!instructionsAccepted}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    rows={4}
                                    placeholder="Опишете цел, ниво и контекст..."
                                    className={`w-full px-4 py-3 rounded-lg bg-gray-900/40 border outline-none transition-all resize-none
                  ${instructionsAccepted
                                            ? "border-orange-500/20 focus:ring-2 focus:ring-orange-500/40"
                                            : "border-gray-700 opacity-50 cursor-not-allowed"
                                        }`}
                                />
                                {error?.type === "validation" && (
                                    <p className="mt-2 text-sm text-red-400">{error.message}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={!instructionsAccepted || input.trim().length === 0}
                                className={`w-full py-3 rounded-lg font-semibold transition-all
                ${instructionsAccepted
                                        ? "bg-gradient-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 shadow-lg shadow-orange-500/20"
                                        : "bg-gray-700 opacity-50 cursor-not-allowed"
                                    }`}
                            >
                                Анализирайте контекста
                            </button>
                        </form>

                        <p className="text-xs text-center text-gray-500 mt-6">
                            Контекстите могат да бъдат редактирани и преизползвани по-късно
                        </p>
                    </motion.div>
                </div>
            </div>
        </>
    );
}