'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/', label: '总览', icon: '📊' },
  { href: '/tasks', label: '任务看板', icon: '📋' },
  { href: '/verify', label: '验收报告', icon: '📄' },
  { href: '/models', label: '模型监控', icon: '🧠' },
  { href: '/skills', label: 'Skills', icon: '🧩' },
  { href: '/crons', label: 'Cron任务', icon: '⏰' },
  { href: '/subscriptions', label: '订阅服务', icon: '💳' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-[#21262d] border border-[#30363d] rounded-lg p-2 text-xl"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 bg-[#161b22] border-r border-[#30363d]
          flex flex-col transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:relative
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[#30363d] shrink-0">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white whitespace-nowrap">
              <span className="text-2xl">🤖</span>
              <span>瓦力控制台</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="text-2xl mx-auto">🤖</Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:block text-[#8b949e] hover:text-white text-sm ml-2"
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-[#21262d] text-white border border-[#30363d]'
                    : 'text-[#8b949e] hover:text-white hover:bg-[#21262d]'}
                  ${collapsed ? 'justify-center' : ''}
                `}
              >
                <span className="text-lg">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#30363d] text-xs text-[#6e7681] shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 status-dot-pulse"></span>
              <span>系统运行中</span>
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <span className="w-2 h-2 rounded-full bg-green-500 status-dot-pulse"></span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
