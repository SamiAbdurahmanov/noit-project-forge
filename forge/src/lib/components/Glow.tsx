"use client";
import { useEffect, useState } from 'react';
export default function Glow(){
      const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
     useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
    return (
         <div
        className="hidden md:block absolute w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none transition-all duration-300"
        style={{
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
      />
    );
}