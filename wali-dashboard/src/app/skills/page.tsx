'use client';

import Card from '@/components/Card';
import StatusDot from '@/components/StatusDot';
import { defaultSkills } from '@/data/skills';

export default function SkillsPage() {
  const customSkills = defaultSkills.filter(s => s.type === 'custom');
  const builtinSkills = defaultSkills.filter(s => s.type === 'builtin');
  const activeCount = defaultSkills.filter(s => s.status === 'active').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🧩 Skills 管理</h1>
          <p className="text-sm text-[#8b949e] mt-1">
            共 {defaultSkills.length} 个 Skill · {customSkills.length} 自定义 · {builtinSkills.length} 内置 · {activeCount} 活跃
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-xs self-start">
          <span className="w-2 h-2 rounded-full bg-yellow-400" />
          <span className="text-yellow-400 font-medium">🟡 静态数据</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">总 Skills</div>
          <div className="text-3xl font-bold text-white mt-2">{defaultSkills.length}</div>
          <div className="text-xs text-[#6e7681] mt-1">{activeCount} 个活跃</div>
        </Card>
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">自定义 Skills</div>
          <div className="text-3xl font-bold text-purple-400 mt-2">{customSkills.length}</div>
          <div className="text-xs text-[#6e7681] mt-1">workspace/skills/ 目录</div>
        </Card>
        <Card>
          <div className="text-xs text-[#8b949e] uppercase tracking-wider">内置 Skills</div>
          <div className="text-3xl font-bold text-blue-400 mt-2">{builtinSkills.length}</div>
          <div className="text-xs text-[#6e7681] mt-1">OpenClaw 自带</div>
        </Card>
      </div>

      {/* Custom Skills */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          🔧 自定义 Skills
          <span className="text-xs text-[#6e7681] font-normal bg-[#21262d] px-2 py-0.5 rounded-full">
            {customSkills.length}
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customSkills.map(skill => (
            <Card key={skill.id} className="border-l-4 border-l-purple-500">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-purple-500/10 border-purple-500/30 text-purple-400">
                      自定义
                    </span>
                  </div>
                </div>
                <StatusDot status={skill.status === 'active' ? 'active' : 'disabled'} size="md" />
              </div>
              <p className="text-xs text-[#8b949e] mb-3 leading-relaxed">{skill.description}</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6e7681]">状态</span>
                  <span className={skill.status === 'active' ? 'text-green-400' : 'text-gray-400'}>
                    {skill.status === 'active' ? '🟢 活跃' : '⚪ 禁用'}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-[#6e7681]">路径</span>
                  <div className="text-[#8b949e] mt-0.5 font-mono text-[10px] bg-[#0d1117] rounded px-2 py-1 overflow-x-auto">
                    {skill.path}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Built-in Skills */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          📦 内置 Skills
          <span className="text-xs text-[#6e7681] font-normal bg-[#21262d] px-2 py-0.5 rounded-full">
            {builtinSkills.length}
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtinSkills.map(skill => (
            <Card key={skill.id} className="border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-500/10 border-blue-500/30 text-blue-400">
                      内置
                    </span>
                  </div>
                </div>
                <StatusDot status={skill.status === 'active' ? 'active' : 'disabled'} size="md" />
              </div>
              <p className="text-xs text-[#8b949e] mb-3 leading-relaxed">{skill.description}</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6e7681]">状态</span>
                  <span className={skill.status === 'active' ? 'text-green-400' : 'text-gray-400'}>
                    {skill.status === 'active' ? '🟢 活跃' : '⚪ 禁用'}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-[#6e7681]">路径</span>
                  <div className="text-[#8b949e] mt-0.5 font-mono text-[10px] bg-[#0d1117] rounded px-2 py-1 overflow-x-auto">
                    {skill.path}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
