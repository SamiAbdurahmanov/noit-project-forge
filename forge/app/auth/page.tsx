"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GuestOnly from "@/src/lib/components/GuestOnly";
import { setToken } from "@/src/lib/authHelper";


const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AuthPage() {
    const [activeButton, setActiveButton] = useState<"signup" | "signin">("signup");
    const [formRegisterData, setFormRegisterData] = useState({ email: "", password: "", confirmPassword: "" });
    const [formLoginData, setFormLoginData] = useState({ email: "", password: "" });
    const [registerErrors, setRegisterErrors] = useState({ email: "", password: "", confirmPassword: "" });
    const [loginErrors, setLoginErrors] = useState({ email: "", password: "" });
    
    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const getPasswordStrength = (password: string) => {
        let strength = 0;
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*]/.test(password),
            longLength: password.length >= 12
        };

        Object.values(checks).forEach(check => check && strength++);
        return { strength, checks };
    };

    const getStrengthLabel = (strength: number) => {
        if (strength <= 1) return { label: "Слаба", color: "bg-red-500" };
        if (strength <= 2) return { label: "Средна", color: "bg-orange-500" };
        if (strength <= 3) return { label: "Добра", color: "bg-yellow-500" };
        if (strength <= 4) return { label: "Силна", color: "bg-lime-500" };
        return { label: "Много силна", color: "bg-green-500" };
    };

    const handleInputRegisterChange = (field: string, value: string) => {
        setFormRegisterData(prev => ({ ...prev, [field]: value }));

        let newError = "";
        if (field === "email" && value && !validateEmail(value)) {
            newError = "Невалиден формат на имейл";
        } else if (field === "confirmPassword" && formRegisterData.password && value !== formRegisterData.password) {
            newError = "Паролите не съвпадат";
        } else if (field === "password" && formRegisterData.confirmPassword && value !== formRegisterData.confirmPassword) {
            setRegisterErrors(prev => ({ 
                ...prev, 
                confirmPassword: value !== formRegisterData.confirmPassword ? "Паролите не съвпадат" : "" 
            }));
        }

        setRegisterErrors(prev => ({ ...prev, [field]: newError }));
    };

    const handleInputLoginChange = (field: string, value: string) => {
        setFormLoginData(prev => ({ ...prev, [field]: value }));

        let newError = "";
        if (field === "email" && value && !validateEmail(value)) {
            newError = "Невалиден формат на имейл";
        }

        setLoginErrors(prev => ({ ...prev, [field]: newError }));
    };

    const validateSignUpForm = (): boolean => {
        const newErrors = { email: "", password: "", confirmPassword: "" };
        let hasError = false;

        if (!formRegisterData.email) {
            newErrors.email = "Имейлът е задължителен";
            hasError = true;
        } else if (!validateEmail(formRegisterData.email)) {
            newErrors.email = "Невалиден формат на имейл";
            hasError = true;
        }

        if (!formRegisterData.password) {
            newErrors.password = "Паролата е задължителна";
            hasError = true;
        } else if (passwordStrength.strength < 3) {
            newErrors.password = "Паролата е твърде слаба";
            hasError = true;
        }

        if (!formRegisterData.confirmPassword) {
            newErrors.confirmPassword = "Потвърдете паролата си";
            hasError = true;
        } else if (formRegisterData.password !== formRegisterData.confirmPassword) {
            newErrors.confirmPassword = "Паролите не съвпадат";
            hasError = true;
        }

        setRegisterErrors(newErrors);
        return !hasError;
    };

    const validateSignInForm = (): boolean => {
        const newErrors = { email: "", password: "" };
        let hasError = false;

        if (!formLoginData.email) {
            newErrors.email = "Имейлът е задължителен";
            hasError = true;
        } else if (!validateEmail(formLoginData.email)) {
            newErrors.email = "Невалиден формат на имейл";
            hasError = true;
        }

        if (!formLoginData.password) {
            newErrors.password = "Паролата е задължителна";
            hasError = true;
        }

        setLoginErrors(newErrors);
        return !hasError;
    };

    const handleSignUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateSignUpForm()) return;

        try {
            const res = await fetch(`${API}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: formRegisterData.email,
                    password: formRegisterData.password,
                }),
            });

            const data = await res.json();
            setToken(data.access_token);
            if (res.ok) {
                window.location.href = "/";
            } else {
                setRegisterErrors(prev => ({
                    ...prev,
                    email: data.message || "Имейлът вече е регистриран",
                }));
            }
        } catch (error) {
            setRegisterErrors(prev => ({
                ...prev,
                email: "Мрежова грешка. Опитайте отново.",
            }));
        }
    };

    const handleSignInSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateSignInForm()) return;

        try {
            const res = await fetch(`${API}/auth/login`, {
                method: "POST",
                body: JSON.stringify({ 
                    email: formLoginData.email, 
                    password: formLoginData.password 
                }),
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            setToken(data.access_token);
            if (res.ok) {
                window.location.href = "/";
            } else {
                const data = await res.json();
                setLoginErrors(prev => ({
                    ...prev,
                    email: data.message || "Невалиден имейл или парола",
                }));
            }
        } catch (error) {
            setLoginErrors(prev => ({
                ...prev,
                email: "Мрежова грешка. Опитайте отново.",
            }));
        }
    };

    useEffect(() => {
        setRegisterErrors({ email: "", password: "", confirmPassword: "" });
        setLoginErrors({ email: "", password: "" });
    }, [activeButton]);

    const passwordStrength = getPasswordStrength(formRegisterData.password);
    const strengthLabel = getStrengthLabel(passwordStrength.strength);

    return (
        <GuestOnly>
            <div className="flex items-center justify-center min-h-[80vh] px-4 mt-10 mb-20">
                <div className="flex w-full max-w-4xl gap-8">
                    <AnimatePresence mode="wait">
                        {activeButton === "signup" && (
                            <div className="hidden [@media(min-width:630px)]:flex flex-col justify-center flex-1 text-left">
                                <motion.div 
                                    key="signup" 
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                                    exit={{ opacity: 0, y: -20, scale: 0.95 }} 
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                >
                                    <h1 className="text-4xl font-bold bg-linear-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent mb-4">
                                        Добре дошли в Forge
                                    </h1>
                                    <p className="text-gray-300 text-lg mb-6">
                                        Преобразувайте своите креативни идеи в реалност. Присъединете се към нашата общност от иноватори и творци.
                                    </p>
                                    <ul className="space-y-3 text-gray-400">
                                        <li className="flex items-center gap-2">✨ <span>Мощни инструменти за творчество</span></li>
                                        <li className="flex items-center gap-2">🚀 <span>Сътрудничество с други</span></li>
                                        <li className="flex items-center gap-2">💡 <span>Претворете идеите си в живот</span></li>
                                    </ul>
                                </motion.div>
                            </div>
                        )}

                        {activeButton === "signin" && (
                            <div className="hidden [@media(min-width:630px)]:flex flex-col justify-center flex-1 text-left">
                                <motion.div 
                                    key="signin" 
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                                    exit={{ opacity: 0, y: -20, scale: 0.95 }} 
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                >
                                    <h1 className="text-4xl font-bold bg-linear-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent mb-4">
                                        Добре дошли отново
                                    </h1>
                                    <p className="text-gray-300 text-lg mb-6">
                                        Продължете пътуването на творчество и иновация. Влезте, за да получите достъп до своите проекти и инструменти.
                                    </p>
                                    <ul className="space-y-3 text-gray-400">
                                        <li className="flex items-center gap-2">✨ <span>Мощни инструменти за творчество</span></li>
                                        <li className="flex items-center gap-2">🚀 <span>Сътрудничество с други</span></li>
                                        <li className="flex items-center gap-2">💡 <span>Претворете идеите си в живот</span></li>
                                    </ul>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    <motion.div
                        layout
                        className="min-h-[500px] w-full [@media(min-width:630px)_and_(max-width:767px)]:max-w-md 
                           md:max-w-md lg:max-w-md p-8 rounded-2xl bg-black/30 backdrop-blur-2xl 
                           border border-orange-500/20 shadow-xl transition-all duration-300 
                           hover:border-orange-500/40 hover:shadow-orange-500/20 overflow-hidden"
                    >
                        <h2 className="text-3xl font-bold text-center mb-2 bg-linear-to-br from-orange-300 to-orange-500 bg-clip-text text-transparent">
                            {activeButton === "signup" ? "Създайте вашия акаунт" : "Добре дошли отново"}
                        </h2>
                        <p className="text-center text-gray-400 mb-8 text-sm">
                            {activeButton === "signup" ? "Присъединете се към Forge и започнете вашето творческо пътешествие." : "Влезте, за да продължите да ковачите своите идеи."}
                        </p>

                        <div className="flex justify-center space-x-4 mb-10">
                            <button 
                                onClick={() => setActiveButton("signup")} 
                                className={`px-4 py-2 rounded-lg text-sm sm:text-base transition-all duration-300 ${
                                    activeButton === "signup" 
                                        ? "bg-linear-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/30" 
                                        : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
                                }`}
                            >
                                Регистрация
                            </button>
                            <button 
                                onClick={() => setActiveButton("signin")} 
                                className={`px-4 py-2 rounded-lg text-sm sm:text-base transition-all duration-300 ${
                                    activeButton === "signin" 
                                        ? "bg-linear-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/30" 
                                        : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50"
                                }`}
                            >
                                Вход
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            {activeButton === "signup" && (
                                <motion.div 
                                    key="signup" 
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                                    exit={{ opacity: 0, y: -20, scale: 0.95 }} 
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                >
                                    <form className="space-y-4" onSubmit={handleSignUpSubmit}>
                                        <InputWithError 
                                            placeholder="Имейл" 
                                            type="email" 
                                            value={formRegisterData.email} 
                                            onChange={(e) => handleInputRegisterChange("email", e.target.value)} 
                                            error={registerErrors.email} 
                                        />
                                        <div>
                                            <InputWithError 
                                                placeholder="Парола" 
                                                type="password" 
                                                value={formRegisterData.password} 
                                                onChange={(e) => handleInputRegisterChange("password", e.target.value)} 
                                                error={registerErrors.password} 
                                            />
                                            {formRegisterData.password && (
                                                <PasswordStrengthIndicator 
                                                    strength={passwordStrength.strength} 
                                                    label={strengthLabel.label} 
                                                    color={strengthLabel.color} 
                                                    checks={passwordStrength.checks} 
                                                />
                                            )}
                                        </div>
                                        <InputWithError 
                                            placeholder="Потвърдете паролата" 
                                            type="password" 
                                            value={formRegisterData.confirmPassword} 
                                            onChange={(e) => handleInputRegisterChange("confirmPassword", e.target.value)} 
                                            error={registerErrors.confirmPassword} 
                                        />
                                        <Button label="Създайте акаунт" />
                                    </form>
                                </motion.div>
                            )}
                            {activeButton === "signin" && (
                                <motion.div 
                                    key="signin" 
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                                    exit={{ opacity: 0, y: -20, scale: 0.95 }} 
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                >
                                    <form className="space-y-4" onSubmit={handleSignInSubmit}>
                                        <InputWithError 
                                            placeholder="Имейл" 
                                            type="email" 
                                            value={formLoginData.email} 
                                            onChange={(e) => handleInputLoginChange("email", e.target.value)} 
                                            error={loginErrors.email} 
                                        />
                                        <InputWithError 
                                            placeholder="Парола" 
                                            type="password" 
                                            value={formLoginData.password} 
                                            onChange={(e) => handleInputLoginChange("password", e.target.value)} 
                                            error={loginErrors.password} 
                                        />
                                        <Button label="Влез" />
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </GuestOnly>
    );
}

function InputWithError({ 
    placeholder, 
    type = "text", 
    value, 
    onChange, 
    error 
}: { 
    placeholder: string; 
    type?: string; 
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
    error: string 
}) {
    return (
        <div>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className={`w-full px-4 py-3 rounded-lg bg-gray-900/40 border transition-all outline-none focus:ring-2 ${
                    error 
                        ? "border-red-500 focus:border-red-400 focus:ring-red-500/40" 
                        : "border-orange-500/20 focus:border-orange-400 focus:ring-orange-500/40"
                }`}
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
    );
}

function PasswordStrengthIndicator({ 
    strength, 
    label, 
    color, 
    checks 
}: { 
    strength: number; 
    label: string; 
    color: string; 
    checks: Record<string, boolean> 
}) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="mt-3 space-y-2"
        >
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Сила на паролата</span>
                <span className={`text-xs font-semibold ${color.replace("bg-", "text-")}`}>{label}</span>
            </div>
            <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(strength / 5) * 100}%` }}
                    transition={{ duration: 0.3 }}
                    className={`h-full ${color}`}
                />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <StrengthCheck label="8+ знака" met={checks.length} />
                <StrengthCheck label="Главна буква" met={checks.uppercase} />
                <StrengthCheck label="Числа" met={checks.number} />
                <StrengthCheck label="Специален знак" met={checks.special} />
            </div>
        </motion.div>
    );
}

function StrengthCheck({ label, met }: { label: string; met: boolean }) {
    return (
        <div className={`flex items-center gap-1 ${met ? "text-green-400" : "text-gray-500"}`}>
            <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                met ? "bg-green-500/20 border-green-500" : "border-gray-600"
            }`}>
                {met && <span className="text-green-400">✓</span>}
            </span>
            <span>{label}</span>
        </div>
    );
}

function Button({ label }: { label: string }) {
    return (
        <button
            type="submit"
            className="w-full py-3 rounded-lg font-semibold bg-linear-to-br from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-orange-500/20"
        >
            {label}
        </button>
    );
}
