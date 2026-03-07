"use client";
import { useEffect, useState } from 'react';
import { Flame, Hammer, Sparkles, ArrowRight } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/src/lib/components/LoadingScreen';
import { getToken } from '@/src/lib/authHelper';
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export default function ForgeLanding() {
  const [isHovering, setIsHovering] = useState(false);
  const { user, isLoading } = useUser();
  const router = useRouter();


  const [checkingContexts, setCheckingContexts] = useState(false);
  const token = getToken ();
  useEffect(() => {
   
    if (isLoading) return;

   
    if (!user) {
    
      return;
    }

   
    setCheckingContexts(true);

    async function checkContexts() {
      try {
        const res = await fetch(`${API}/context/my-contexts`, {
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (!res.ok) {
          return;
        }

        const data = await res.json();

        if (data.length > 0) {
         
          router.push("/context/myContexts");
         
        } 
      } catch (err) {
        console.error("Could not reach backend:", err);
        
      }
      finally{
        setCheckingContexts(false);
      }
    }

    checkContexts();
  }, [user, isLoading]); 

  
  if (isLoading || checkingContexts) return <LoadingScreen />;


  return (
    <div className="min-h-screen overflow-x-hidden">
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-32">
        <div className="text-center space-y-6 sm:space-y-8">
          <div className="inline-block">
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 sm:px-4 py-2 backdrop-blur-sm text-xs sm:text-sm">
              <Sparkles className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <span className="text-orange-300">
                Създай перфектния си работен процес
              </span>
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold leading-tight">
            <span className="bg-gradient-to-br from-white via-orange-200 to-orange-400 bg-clip-text text-transparent">
              Оформи идеите си
            </span>
            <br />
            <span className="text-orange-500">В реалност</span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed px-2">
            Forge превръща хобито ти в шедьовър. Създавай, усъвършенствай и довеждай
            занаята си до съвършенство с инструменти, създадени за творци, които изискват
            най-доброто.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4 px-2">
            <Link
              href="/context/new"
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="group bg-gradient-to-br from-orange-600 to-orange-500 px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-base sm:text-lg hover:from-orange-500 hover:to-orange-400 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/50 flex items-center justify-center gap-2 sm:gap-3"
            >
              Започни да ковеш
              <ArrowRight className={`w-5 h-5 transition-transform ${isHovering ? 'translate-x-1' : ''}`} />
            </Link>
            
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-16 sm:mt-32 px-2">
          {[
            {
              icon: Hammer,
              title: 'Мощни инструменти',
              desc: 'Всичко необходимо, за да вдъхнеш живот на творческата си визия — на едно място.'
            },
            {
              icon: Flame,
              title: 'Създадено за скорост',
              desc: 'Светкавично бърза производителност, която следва творческия ти ритъм.'
            },
            {
              icon: Sparkles,
              title: 'Интелигентна помощ',
              desc: 'AI-базирани предложения, които ти помагат да работиш по-умно, не по-трудно.'
            }
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="group bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-orange-500/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 hover:border-orange-500/50 transition-all hover:scale-105 hover:shadow-xl hover:shadow-orange-500/20"
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-500/30 transition-colors">
                  <Icon className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-gray-400">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}