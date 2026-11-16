import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Phoenix' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // ?freeze (video stage): fixed clock + seeded Math.random from the very first script, so every render is identical
  const FREEZE = "(function(){try{if(!/[?&]freeze/.test(location.search))return;var F=Date.UTC(2026,10,12,13,7,42),D=Date;Date=class extends D{constructor(...a){a.length?super(...a):super(F)}static now(){return F}};var s=123456789;Math.random=function(){s=(s*1664525+1013904223)%4294967296;return s/4294967296}}catch(e){}})()";
  return <html lang="en"><head><script dangerouslySetInnerHTML={{ __html: FREEZE }} /></head><body>{children}</body></html>;
}
