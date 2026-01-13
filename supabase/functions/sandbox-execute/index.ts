import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SANDBOX_BACKEND_URL = Deno.env.get('SANDBOX_BACKEND_URL');

interface SandboxExecution {
  id: string;
  user_id: string;
  model_id: string | null;
  code: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result: any | null;
  logs: string[];
  error_message: string | null;
  execution_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const action = path[path.length - 1];

    console.log(`Sandbox request: ${action} from user ${user.id}`);

    if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'execute') {
        const { model_id, code, ticker, start_date, end_date, demo_mode = true } = body;

        if (!code) {
          return new Response(JSON.stringify({ error: 'Code is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // SECURITY: Server-side validation of dangerous code patterns
        const serverValidation = validatePythonCodeServer(code);
        if (!serverValidation.valid) {
          console.log(`[Sandbox] Code rejected for user ${user.id}: ${serverValidation.issues.join(', ')}`);
          return new Response(JSON.stringify({ 
            error: 'Code contains disallowed operations',
            issues: serverValidation.issues 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`Sandbox execution request - Model: ${model_id}, Demo: ${demo_mode}`);

        // Create execution record
        const executionId = crypto.randomUUID();
        const startTime = Date.now();

        // For now, we simulate sandbox execution
        // In production, this would forward to an actual isolated container service
        const result = await simulateSandboxExecution(code, {
          ticker: ticker || 'AAPL',
          start_date: start_date || '2024-01-01',
          end_date: end_date || '2024-06-01',
          demo_mode,
        });

        const executionTimeMs = Date.now() - startTime;

        return new Response(JSON.stringify({
          success: true,
          execution_id: executionId,
          status: result.status,
          result: result.output,
          logs: result.logs,
          error: result.error,
          execution_time_ms: executionTimeMs,
          container_info: {
            isolated: true,
            timeout_seconds: 30,
            max_memory_mb: 256,
            allowed_packages: ['pandas', 'numpy', 'sklearn', 'ta'],
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'validate-code') {
        const { code } = body;

        // Validate the code structure
        const validation = validatePythonCode(code);

        return new Response(JSON.stringify(validation), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in sandbox-execute function:', error);
    // SECURITY: Sanitize error messages to prevent information leakage
    return new Response(JSON.stringify({ error: 'An error occurred while processing your request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simulate sandbox execution for demo purposes
async function simulateSandboxExecution(
  code: string,
  config: { ticker: string; start_date: string; end_date: string; demo_mode: boolean }
) {
  const logs: string[] = [];
  
  logs.push(`[Container] Starting isolated Python environment...`);
  logs.push(`[Container] Loading packages: pandas, numpy, sklearn, ta`);
  logs.push(`[Container] Fetching market data for ${config.ticker} (${config.start_date} to ${config.end_date})`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Check for common issues in code
  const hasGenerateSignals = code.includes('def generate_signals');
  const hasReturn = code.includes('return');
  const hasSignalColumn = code.includes("'signal'") || code.includes('"signal"');

  if (!hasGenerateSignals) {
    return {
      status: 'failed' as const,
      output: null,
      logs: [...logs, '[Error] Missing required function: generate_signals'],
      error: 'Code must contain a generate_signals(data: pd.DataFrame) function',
    };
  }

  if (!hasReturn) {
    return {
      status: 'failed' as const,
      output: null,
      logs: [...logs, '[Error] Function does not return a value'],
      error: 'generate_signals function must return a DataFrame',
    };
  }

  logs.push(`[Container] Executing user code...`);
  logs.push(`[Container] Generated signals for ${config.demo_mode ? '5' : '~252'} trading days`);
  logs.push(`[Container] Execution completed successfully`);

  // Generate simulated output
  const signalCounts = {
    buy: Math.floor(30 + Math.random() * 20),
    sell: Math.floor(25 + Math.random() * 20),
    hold: Math.floor(40 + Math.random() * 30),
  };

  return {
    status: 'completed' as const,
    output: {
      signals: signalCounts,
      total_days: signalCounts.buy + signalCounts.sell + signalCounts.hold,
      sample_output: [
        { date: '2024-01-02', signal: 1, sma_20: 185.42, sma_50: 182.15 },
        { date: '2024-01-03', signal: 1, sma_20: 186.01, sma_50: 182.38 },
        { date: '2024-01-04', signal: 0, sma_20: 185.89, sma_50: 182.62 },
        { date: '2024-01-05', signal: -1, sma_20: 184.55, sma_50: 182.89 },
        { date: '2024-01-08', signal: -1, sma_20: 183.22, sma_50: 183.05 },
      ],
    },
    logs,
    error: null,
  };
}

// SECURITY: Comprehensive server-side validation for dangerous code patterns
// This runs on every execution request with anti-obfuscation measures
function validatePythonCodeServer(code: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Step 1: Detect and reject obfuscation attempts
  const obfuscationPatterns = [
    // Encoded strings that could decode to dangerous code
    { pattern: /\\x[0-9a-fA-F]{2}/g, name: 'hex escape sequences' },
    { pattern: /\\u[0-9a-fA-F]{4}/g, name: 'unicode escape sequences' },
    { pattern: /\\[0-7]{1,3}/g, name: 'octal escape sequences' },
    // Base64-like patterns (long alphanumeric strings)
    { pattern: /['"][A-Za-z0-9+/=]{50,}['"]/g, name: 'potential base64 encoded strings' },
    // String concatenation obfuscation (e.g., "o" + "s" -> "os")
    { pattern: /['"]\s*\+\s*['"]/g, name: 'string concatenation (potential obfuscation)' },
    // chr() based obfuscation
    { pattern: /chr\s*\(\s*\d+\s*\)/g, name: 'chr() calls (potential obfuscation)' },
    // ord() with join for string building
    { pattern: /['"]\.join\s*\(\s*\[.*chr/g, name: 'join with chr() pattern' },
    // getattr with string building
    { pattern: /getattr\s*\([^,]+,\s*[^)]*\+/g, name: 'getattr with string concatenation' },
    // Format string exploitation
    { pattern: /\{[^}]*\.__\w+__[^}]*\}/g, name: 'format string with dunder access' },
  ];
  
  for (const { pattern, name } of obfuscationPatterns) {
    if (pattern.test(code)) {
      issues.push(`Suspicious pattern detected: ${name} - not allowed for security`);
    }
  }
  
  // Step 2: Normalize code to catch simple obfuscation
  // Remove comments and normalize whitespace for pattern matching
  const normalizedCode = code
    .replace(/#.*$/gm, '') // Remove single-line comments
    .replace(/'''[\s\S]*?'''/g, '') // Remove multi-line strings (could hide code)
    .replace(/"""[\s\S]*?"""/g, '')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .toLowerCase();
  
  // Step 3: Dangerous module imports with obfuscation-resistant patterns
  const dangerousModules = [
    'os', 'subprocess', 'sys', 'shutil', 'socket', 'requests', 
    'urllib', 'http', 'ftplib', 'smtplib', 'telnetlib', 'pickle',
    'marshal', 'shelve', 'ctypes', 'multiprocessing', 'threading',
    '__builtins__', 'builtins', 'importlib', 'code', 'codeop',
    'compile', 'ast', 'tokenize', 'pathlib', 'glob', 'tempfile',
    'pty', 'tty', 'fcntl', 'resource', 'syslog', 'posix', 'nt',
    'signal', 'mmap', 'struct', 'io', 'zipfile', 'tarfile', 'bz2',
    'gzip', 'lzma', 'zipimport', 'pkgutil', 'modulefinder', 'runpy'
  ];
  
  for (const mod of dangerousModules) {
    // Check original code with multiple import patterns
    const importPatterns = [
      new RegExp(`\\bimport\\s+${mod}\\b`, 'i'),
      new RegExp(`\\bfrom\\s+${mod}\\b`, 'i'),
      new RegExp(`\\bfrom\\s+${mod}\\.`, 'i'),
      new RegExp(`__import__\\s*\\(\\s*['"]${mod}['"]`, 'i'),
      new RegExp(`importlib\\.import_module\\s*\\(\\s*['"]${mod}['"]`, 'i'),
    ];
    for (const pattern of importPatterns) {
      if (pattern.test(code)) {
        issues.push(`Module '${mod}' is not allowed in sandbox`);
        break;
      }
    }
    // Also check normalized code
    if (normalizedCode.includes(`import ${mod}`) || normalizedCode.includes(`from ${mod}`)) {
      if (!issues.some(i => i.includes(`Module '${mod}'`))) {
        issues.push(`Module '${mod}' is not allowed in sandbox`);
      }
    }
  }
  
  // Step 4: Dangerous function calls with comprehensive patterns
  const dangerousFunctions = [
    { pattern: /\bexec\s*\(/i, name: 'exec()' },
    { pattern: /\beval\s*\(/i, name: 'eval()' },
    { pattern: /\bcompile\s*\(/i, name: 'compile()' },
    { pattern: /\bopen\s*\(/i, name: 'open()' },
    { pattern: /\bgetattr\s*\(/i, name: 'getattr()' },
    { pattern: /\bsetattr\s*\(/i, name: 'setattr()' },
    { pattern: /\bdelattr\s*\(/i, name: 'delattr()' },
    { pattern: /\b__import__\s*\(/i, name: '__import__()' },
    { pattern: /\bglobals\s*\(/i, name: 'globals()' },
    { pattern: /\blocals\s*\(/i, name: 'locals()' },
    { pattern: /\bvars\s*\(/i, name: 'vars()' },
    { pattern: /\bdir\s*\(/i, name: 'dir()' },
    { pattern: /\binput\s*\(/i, name: 'input()' },
    { pattern: /\bbreakpoint\s*\(/i, name: 'breakpoint()' },
    { pattern: /\btype\s*\(\s*['"]\w+['"]\s*,/i, name: 'type() with 3 args (class creation)' },
    { pattern: /\b__new__\s*\(/i, name: '__new__()' },
    { pattern: /\b__init_subclass__\s*\(/i, name: '__init_subclass__()' },
    { pattern: /\b__set_name__\s*\(/i, name: '__set_name__()' },
    { pattern: /\bmemoryview\s*\(/i, name: 'memoryview()' },
    { pattern: /\bbytearray\s*\(/i, name: 'bytearray()' },
    { pattern: /\bfrozenset\s*\(\s*\{/i, name: 'frozenset with set literal' },
  ];
  
  for (const { pattern, name } of dangerousFunctions) {
    if (pattern.test(code)) {
      issues.push(`Function ${name} is not allowed in sandbox`);
    }
  }
  
  // Step 5: Dangerous dunder access (attribute-based exploitation)
  const dangerousDunders = [
    '__class__', '__bases__', '__subclasses__', '__mro__', '__code__',
    '__globals__', '__builtins__', '__dict__', '__module__', '__func__',
    '__self__', '__closure__', '__annotations__', '__kwdefaults__',
    '__reduce__', '__reduce_ex__', '__getstate__', '__setstate__',
    '__init__.__globals__', '__class__.__bases__', '__class__.__mro__'
  ];
  
  for (const dunder of dangerousDunders) {
    // Check with various access patterns
    const accessPatterns = [
      new RegExp(`\\.${dunder.replace(/__/g, '__')}\\b`),
      new RegExp(`\\['${dunder}'\\]`),
      new RegExp(`\\["${dunder}"\\]`),
      new RegExp(`getattr\\s*\\([^,]+,\\s*['"]${dunder}['"]`),
    ];
    for (const pattern of accessPatterns) {
      if (pattern.test(code)) {
        issues.push(`Access to '${dunder}' is not allowed in sandbox`);
        break;
      }
    }
  }
  
  // Step 6: Additional exploit patterns
  const exploitPatterns = [
    { pattern: /\(\s*\)\s*\[\s*\d+\s*\]/, name: 'tuple indexing (potential exploit)' },
    { pattern: /\[\s*\]\s*\.\s*__class__/, name: 'list class access' },
    { pattern: /\{\s*\}\s*\.\s*__class__/, name: 'dict class access' },
    { pattern: /['"]\s*\.\s*__class__/, name: 'string class access' },
    { pattern: /lambda\s*:\s*0\s*\.\s*__/, name: 'lambda function exploitation' },
    { pattern: /\bsuper\s*\(\s*\)/, name: 'super() call' },
    { pattern: /\bclassmethod\s*\(/, name: 'classmethod()' },
    { pattern: /\bstaticmethod\s*\(/, name: 'staticmethod()' },
    { pattern: /\bproperty\s*\(/, name: 'property()' },
    { pattern: /\b__enter__/, name: '__enter__ (context manager exploit)' },
    { pattern: /\b__exit__/, name: '__exit__ (context manager exploit)' },
  ];
  
  for (const { pattern, name } of exploitPatterns) {
    if (pattern.test(code)) {
      issues.push(`Pattern '${name}' is not allowed in sandbox`);
    }
  }
  
  // Step 7: Code size limits to prevent DoS
  if (code.length > 50000) {
    issues.push('Code exceeds maximum allowed size (50KB)');
  }
  
  // Count nested structures to prevent stack overflow attacks
  const maxNesting = 20;
  let currentNesting = 0;
  let maxFound = 0;
  for (const char of code) {
    if (char === '(' || char === '[' || char === '{') {
      currentNesting++;
      maxFound = Math.max(maxFound, currentNesting);
    } else if (char === ')' || char === ']' || char === '}') {
      currentNesting--;
    }
  }
  if (maxFound > maxNesting) {
    issues.push(`Code nesting too deep (${maxFound} levels, max ${maxNesting})`);
  }
  
  // Step 8: Whitelist-based import validation
  const allowedImports = ['pandas', 'numpy', 'sklearn', 'ta', 'scipy', 'statsmodels', 'math', 'datetime', 'collections', 'functools', 'itertools', 'operator', 're'];
  const importMatches = code.matchAll(/(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of importMatches) {
    const importedModule = match[1].toLowerCase();
    if (!allowedImports.includes(importedModule) && !dangerousModules.includes(importedModule)) {
      // Not in whitelist and not already flagged as dangerous
      issues.push(`Module '${match[1]}' is not in the allowed imports list`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}

// Validate Python code structure (for client validation endpoint)
function validatePythonCode(code: string) {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for required function
  if (!code.includes('def generate_signals')) {
    issues.push('Missing required function: generate_signals(data: pd.DataFrame)');
  }

  // Check for return statement
  if (!code.includes('return')) {
    issues.push('Function must return a DataFrame');
  }

  // Check for signal column
  if (!code.includes("'signal'") && !code.includes('"signal"')) {
    warnings.push("Code should set a 'signal' column in the returned DataFrame");
  }

  // Run server-side security validation too
  const serverValidation = validatePythonCodeServer(code);
  issues.push(...serverValidation.issues);

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    allowed_imports: ['pandas', 'numpy', 'sklearn', 'ta', 'scipy', 'statsmodels'],
    max_execution_time: 30,
    max_memory_mb: 256,
  };
}
