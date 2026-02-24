"use client";
import { useState, useEffect } from "react";
export default function Particles(){
      const [particles, setParticles] = useState<any[]>([]);

useEffect(() => {
  const data = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 2,
  }));

  setParticles(data);
}, []); // runs only on mount

    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 bg-orange-500 rounded-full opacity-50"
            style={{
              left: particle.left,
              bottom: '-10px',
              animation: `rise ${particle.duration}s ease-in infinite`,
              animationDelay: `${particle.delay}s`
            }}
          />
        ))}
         <style jsx>{`
        @keyframes rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
          100% {
            transform: translateY(-100vh) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
      </div>

    );
}