import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: '瓦力控制台 - 搞钱看板',
  description: 'AI Agent 运营监控仪表盘',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-auto md:ml-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 md:pt-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
