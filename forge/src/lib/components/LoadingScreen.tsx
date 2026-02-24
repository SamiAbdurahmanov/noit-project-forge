"use client";

import { Loader2 } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-orange-900/20 to-gray-900 text-white z-50">
      <Loader2 className="animate-spin w-12 h-12 text-orange-500 mb-4" />
      <p className="text-lg font-semibold">Зареждане...</p>
    </div>
  );
}
