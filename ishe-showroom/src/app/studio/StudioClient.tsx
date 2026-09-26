'use client';
import dynamic from 'next/dynamic';
const Studio = dynamic(() => import('@/scene/Studio'), { ssr: false });
export default function StudioClient() { return <Studio />; }
