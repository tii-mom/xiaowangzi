import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: '小王子- SoulMate',
  description: '疗愈、陪伴、成长；小王子是具有记忆、情绪和成长能力的Bot。',
  keywords: '小王子, SoulMate, 心理陪伴, 心理疗愈, 微信机器人, 情绪陪伴, 记忆机器人, 成长型Bot',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh-CN" className="scroll-smooth" suppressHydrationWarning>
      <body className="antialiased bg-[#020617] text-slate-100 selection:bg-[#fcd34d]/20 selection:text-[#fcd34d] min-h-screen overflow-x-hidden font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
