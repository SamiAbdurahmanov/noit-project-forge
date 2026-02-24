import Link from "next/link";

export default function Unregistered() {
    return (
        <div className="flex-1 flex items-center justify-center px-4 py-20 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute top-20 left-10 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
                <div className="absolute top-40 right-10 w-72 h-72 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
            </div>

            <div className="relative z-10 text-center max-w-md">
                {/* Icon */}
                <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 mb-6">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>

                <div className="mb-8 space-y-4">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                        Достъп отказан
                    </h1>
                    <p className="text-gray-300 text-lg leading-relaxed">
                        Трябва да се впишете, за да използвате тази функция.
                    </p>
                </div>

                <div className="space-y-3 pt-6">
                    <Link
                        href="/auth"
                        className="inline-block w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-orange-500/50 transform hover:scale-105"
                    >
                        Вход
                    </Link>
                  
                </div>
            </div>
        </div>
    );
}