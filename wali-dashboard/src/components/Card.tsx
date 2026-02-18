import { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  style?: CSSProperties;
}

export default function Card({ children, className = '', hover = true, style }: CardProps) {
  return (
    <div
      className={`
        bg-[#161b22] border border-[#30363d] rounded-xl p-5
        ${hover ? 'card-hover' : ''}
        ${className}
      `}
      style={style}
    >
      {children}
    </div>
  );
}
