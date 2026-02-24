"use client";

import { useUser } from "@/context/UserContext";
import LoadingScreen from "@/src/lib/components/LoadingScreen";
import Unregistered from "@/src/lib/components/Unregistered";
import { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Link from "next/link";
import { withAuth } from "@/src/withAuth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AnalyticsPage() {
    
    const { user, isLoading } = useUser();
    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<any>(null);
    const [selectedContext, setSelectedContext] = useState<number | null>(null);
    const [contextData, setContextData] = useState<any>(null);

    useEffect(() => {
        if (!user) return;
        const fetchOverview = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API}/analytics/overview`, { credentials: "include" });
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                setOverview(data);
                if (data.contexts && data.contexts.length > 0) {
                    setSelectedContext(data.contexts[0].id);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchOverview();
    }, [user]);

    useEffect(() => {
        if (!selectedContext) return;
        const fetchContext = async () => {
            try {
                const res = await fetch(`${API}/analytics/context/${selectedContext}`, { credentials: "include" });
                if (!res.ok) throw new Error("Failed");
                const data = await res.json();
                setContextData(data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchContext();
    }, [selectedContext]);
 if (!user) return <Unregistered />;
    if (isLoading || loading) return <LoadingScreen />;
   
    if (!overview || !overview.contexts || overview.contexts.length === 0) {
        return <div className="min-h-screen flex items-center justify-center text-white">Няма данни за анализиране</div>;
    }

    const selectedHobby = overview.contexts.find((c: any) => c.id === selectedContext)?.hobby;

    
    let progressChartData: Array<{ day: number; actual: number | null; expected: number | null }> = [];
    if (contextData) {
        const snapshots = contextData.snapshots || [];
        const trajectory = contextData.expected_trajectory || [];

        
        const firstDate = snapshots.length > 0 
            ? new Date(snapshots[0].date).getTime() 
            : Date.now();

        const snapsWithDay = snapshots.map((s: any) => ({
            ...s,
            day: Math.max(0, Math.floor((new Date(s.date).getTime() - firstDate) / (1000 * 60 * 60 * 24)))
        }));

    
        const allDays = new Set([
            ...snapsWithDay.map((s: any) => s.day),
            ...trajectory.map((t: any) => t.day)
        ]);

        progressChartData = Array.from(allDays)
            .sort((a, b) => a - b)
            .map((day) => {
                const snap = snapsWithDay.find((s: any) => s.day === day);
                const exp = trajectory.find((t: any) => t.day === day);
                return {
                    day,
                    actual: snap ? snap.progress : null,
                    expected: exp ? exp.expected_progress : null,
                };
            });
    }

   
    const velocityChartData = overview.contexts.map((c: any) => ({
        hobby: c.hobby,
        velocity: c.velocity,
    }));

    return (
        <div className="min-h-screen  text-white px-4 py-10">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-4xl font-bold bg-linear-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent mb-2">
                        Аналитика на прогреса
                    </h1>
                    <p className="text-gray-400">Проследявай развитието си във времето</p>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <div className="p-6 rounded-2xl bg-black/40 border border-orange-500/20">
                        <p className="text-sm text-gray-500 mb-2">Общо хобита</p>
                        <p className="text-3xl font-bold text-orange-400">{overview.overall.total_hobbies}</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-black/40 border border-green-500/20">
                        <p className="text-sm text-gray-500 mb-2">Среден прогрес</p>
                        <p className="text-3xl font-bold text-green-400">{overview.overall.average_progress}%</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-black/40 border border-blue-500/20">
                        <p className="text-sm text-gray-500 mb-2">Най-добро подобрение</p>
                        <p className="text-xl font-bold text-blue-400">{overview.overall.most_improved || "—"}</p>
                    </div>
                </div>

                {/* Hobby Selector */}
                <div className="mb-8">
                    <label className="block text-sm font-semibold text-orange-400 mb-3">Избери хоби за детайлна аналитика</label>
                    <select
                        value={selectedContext || ""}
                        onChange={(e) => setSelectedContext(parseInt(e.target.value))}
                        className="w-full md:w-64 px-4 py-3 rounded-lg bg-gray-800/50 border border-orange-500/20 text-white outline-none"
                    >
                        {overview.contexts.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.hobby}</option>
                        ))}
                    </select>
                </div>

                {/* Per-Hobby Analytics */}
                {contextData && (
                    <div className="space-y-8">
                        {/* Progress Line Chart */}
                        <div className="p-6 rounded-2xl bg-black/40 border border-orange-500/20">
                            <h3 className="text-xl font-bold mb-4 text-white">{selectedHobby} — Прогрес във времето</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={progressChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="day" stroke="#999" label={{ value: "Дни", position: "insideBottom", offset: -5 }} />
                                    <YAxis stroke="#999" label={{ value: "Прогрес (%)", angle: -90, position: "insideLeft" }} />
                                    <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #f97316" }} />
                                    <Legend />
                                    {/* connectNulls is CRITICAL here so the lines don't break between actual snapshot days */}
                                    <Line type="monotone" dataKey="actual" stroke="#f97316" strokeWidth={2} name="Реален" connectNulls={true} />
                                    <Line type="monotone" dataKey="expected" stroke="#888" strokeDasharray="5 5" name="Очакван" connectNulls={true} />
                                </LineChart>
                            </ResponsiveContainer>
                            <div className="mt-4 grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Дни активност</p>
                                    <p className="text-2xl font-bold text-orange-400">{contextData.performance_summary.days_active}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Среден дневен напредък</p>
                                    <p className="text-2xl font-bold text-green-400">{contextData.performance_summary.average_daily_gain}%</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Статус</p>
                                    <p className={`text-lg font-bold ${contextData.performance_summary.ahead_of_schedule ? "text-green-400" : "text-orange-400"}`}>
                                        {contextData.performance_summary.ahead_of_schedule ? "Напред" : "По график"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Velocity Bar Chart */}
                <div className="p-6 rounded-2xl bg-black/40 border border-orange-500/20 mt-8">
                    <h3 className="text-xl font-bold mb-4 text-white">Скорост на напредък (всички хобита)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={velocityChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="hobby" stroke="#999" />
                            <YAxis stroke="#999" label={{ value: "% на ден", angle: -90, position: "insideLeft" }} />
                            <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #f97316" }} />
                            <Bar dataKey="velocity" name="Скорост на напредък" fill="#f97316" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Context List */}
                <div className="mt-12">
                    <h3 className="text-xl font-bold mb-4">Всички контексти</h3>
                    <div className="grid gap-4">
                        {overview.contexts.map((c: any) => (
                            <Link key={c.id} href={`/context/${c.id}`}>
                                <div className="p-4 rounded-lg bg-black/40 border border-orange-500/20 hover:border-orange-500/50 transition-all cursor-pointer">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-white">{c.hobby}</h4>
                                            <p className="text-sm text-gray-400">Прогрес: {c.progress}% | Скорост: {c.velocity}%/ден | Тенденция: {c.trend}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                            c.trend === "ускорява" ? "bg-green-500/20 text-green-400" :
                                            c.trend === "забавя" ? "bg-red-500/20 text-red-400" :
                                            "bg-gray-500/20 text-gray-400"
                                        }`}>
                                            {c.trend}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}