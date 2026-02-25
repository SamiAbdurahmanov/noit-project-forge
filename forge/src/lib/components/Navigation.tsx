"use client";
import { useState } from "react";
import Link from "next/link";
import { Flame, Sparkles, Menu, X, ArrowRight } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export default function Navigation() {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useUser();
    const router = useRouter();
    const handleLogout = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch(`${API}/auth/logout`, {
            method: "POST",
            credentials: "include",
        });
        router.push("/");
        window.location.reload();
    };
    return (
        <>
            {/* NAVBAR */}
            <nav className="relative z-20 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
                {/* Logo */}
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="relative">
                        <Flame className="w-8 h-8 text-orange-500 group-hover:text-orange-400 transition-colors" />
                        <Sparkles className="w-4 h-4 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <Link className="text-2xl font-bold bg-gradient-to-br from-orange-400 to-yellow-300 bg-clip-text text-transparent" href="/">
                        Forge
                    </Link>
                </div>

                {/* Desktop Menu */}
                <div className="hidden md:flex gap-6 items-center">

                    {!user && <Link href='/auth' className="bg-gradient-to-br from-orange-600 to-orange-500 px-6 py-2 rounded-lg hover:from-orange-500 hover:to-orange-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-orange-500/50">
                        Вход
                    </Link>}
                    {user && ( <div className="hidden md:flex gap-6 items-center">
                        
                    <Link className="hover:text-orange-400 transition-colors" href="/analytics">Анализ</Link>
                        <button onClick={handleLogout} className="bg-gradient-to-br from-red-600 to-red-500 px-6 py-2 rounded-lg hover:from-red-500 hover:to-red-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-500/50">
                            Изход
                        </button>
                        

                    </div>
                    )}
                </div>

                {/* Mobile Toggle Button */}
                <button
                    className="md:hidden"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? (
                        <X className="w-7 h-7 text-white" />
                    ) : (
                        <Menu className="w-7 h-7 text-white" />
                    )}
                </button>
            </nav>

            {/* MOBILE MENU */}
            <div
                className={`
                    md:hidden w-full 
                    bg-slate-950
                    border-t border-white/10
                    overflow-hidden transition-all duration-300 ease-out
                    ${isOpen ? "max-h-96 opacity-100 py-6" : "max-h-0 opacity-0 py-0"}
                `}
            >
                <div className="flex flex-col gap-5 px-6 text-lg font-medium">



                    {!user && <Link href="/auth" className="mt-2 bg-gradient-to-br from-orange-600 to-orange-500 px-6 py-3 rounded-lg  hover:from-orange-500 hover:to-orange-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-orange-500/40">
                        Вход
                    </Link>}
                    {user && <div className="flex flex-col gap-5 px-6 text-lg font-medium"> 
                        <Link className=" flex items-center justify-between" href="/analytics">Анализ</Link>
                        <button onClick={handleLogout} className="mt-2 bg-gradient-to-br from-red-600 to-red-500 px-6 py-3 rounded-lg  hover:from-red-500 hover:to-red-400 transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-500/40">
                        Изход
                    </button> </div>}
                </div>
            </div>
        </>
    );
}
