interface ModelTagProps {
  model: string;
}

const modelColors: Record<string, { bg: string; text: string; border: string }> = {
  'Opus': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Claude': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'MiniMax': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'CoCo': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'GLM-5': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  'GLM-4': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'GPT': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Gemini': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Sub-Agent': { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  '待定': { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' },
  '手动': { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' },
};

function getModelStyle(model: string) {
  for (const key of Object.keys(modelColors)) {
    if (model.includes(key)) return modelColors[key];
  }
  return modelColors['手动'];
}

export default function ModelTag({ model }: ModelTagProps) {
  const style = getModelStyle(model);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
    >
      {model}
    </span>
  );
}
