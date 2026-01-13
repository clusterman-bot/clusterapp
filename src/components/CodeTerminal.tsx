import { cn } from '@/lib/utils';

interface CodeTerminalProps {
  code: string;
  language?: string;
  className?: string;
  maxHeight?: string;
}

export function CodeTerminal({ 
  code, 
  language = 'python', 
  className,
  maxHeight = '400px'
}: CodeTerminalProps) {
  const lines = code.split('\n');
  const lineNumberWidth = String(lines.length).length;

  return (
    <div className={cn(
      "rounded-lg border bg-zinc-950 text-zinc-100 overflow-hidden font-mono text-sm",
      className
    )}>
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-zinc-500 ml-2">{language}</span>
      </div>
      
      {/* Code Content */}
      <div 
        className="overflow-auto p-4"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="hover:bg-zinc-900/50">
                <td 
                  className="pr-4 text-right text-zinc-600 select-none align-top"
                  style={{ width: `${lineNumberWidth + 2}ch` }}
                >
                  {index + 1}
                </td>
                <td className="whitespace-pre text-zinc-100">
                  <HighlightedLine line={line} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple syntax highlighting for Python
function HighlightedLine({ line }: { line: string }) {
  // Keywords
  const keywords = ['def', 'return', 'import', 'from', 'if', 'elif', 'else', 'for', 'while', 'class', 'try', 'except', 'with', 'as', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'lambda'];
  
  // Simple tokenization
  const parts: { text: string; type: 'keyword' | 'string' | 'comment' | 'number' | 'function' | 'default' }[] = [];
  
  let remaining = line;
  let currentIndex = 0;
  
  // Check for comments first
  const commentIndex = remaining.indexOf('#');
  if (commentIndex !== -1) {
    const beforeComment = remaining.slice(0, commentIndex);
    const comment = remaining.slice(commentIndex);
    remaining = beforeComment;
    parts.push({ text: comment, type: 'comment' });
  }
  
  // Check for strings
  const stringMatch = remaining.match(/(["'])(?:(?=(\\?))\2.)*?\1|"""[\s\S]*?"""|'''[\s\S]*?'''/);
  
  // Tokenize the remaining
  const tokens = remaining.split(/(\s+|[()[\]{},.:=<>+\-*/%])/);
  
  tokens.forEach((token, i) => {
    if (!token) return;
    
    if (keywords.includes(token)) {
      parts.unshift({ text: token, type: 'keyword' });
    } else if (/^["']/.test(token) || /^("""|''')/.test(token)) {
      parts.unshift({ text: token, type: 'string' });
    } else if (/^\d+\.?\d*$/.test(token)) {
      parts.unshift({ text: token, type: 'number' });
    } else if (i < tokens.length - 1 && tokens[i + 1] === '(') {
      parts.unshift({ text: token, type: 'function' });
    } else {
      parts.unshift({ text: token, type: 'default' });
    }
  });
  
  // Reverse to get correct order and add comment at end
  const orderedParts = parts.reverse();

  return (
    <>
      {orderedParts.map((part, i) => {
        const colorClass = {
          keyword: 'text-purple-400',
          string: 'text-green-400',
          comment: 'text-zinc-500 italic',
          number: 'text-amber-400',
          function: 'text-blue-400',
          default: 'text-zinc-100',
        }[part.type];
        
        return (
          <span key={i} className={colorClass}>
            {part.text}
          </span>
        );
      })}
    </>
  );
}
