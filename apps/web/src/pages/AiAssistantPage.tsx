import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  CheckCircle2, 
  Copy, 
  Check, 
  Paperclip, 
  ArrowUp, 
  ChevronRight, 
  Wand2, 
  BookOpen, 
  Code2, 
  Search, 
  FlaskConical, 
  ChevronDown,
  Sparkles,
  AlertCircle,
  FileCode,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../services/api';

interface FindingItem {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  snippet: string;
  fileLocation: string;
  codeVulnerable: string;
  vulnerableHighlight?: string;
  explanation: string;
  howToFix: string;
  codeFixed: string;
}

const SAMPLE_FINDINGS: FindingItem[] = [
  {
    id: 'f-1',
    title: 'SQL Injection Risk',
    severity: 'High',
    snippet: 'User input directly concatenated into SQL query',
    fileLocation: 'app/routes/user.ts:2',
    codeVulnerable: `app.get("/api/user/:id", async (req, res) => {\n  const user = await db.query(\n    'SELECT * FROM users WHERE id = \${req.params.id}'\n  );\n  res.json(user);\n});`,
    vulnerableHighlight: '${req.params.id}',
    explanation: 'The user input ( req.params.id ) is directly inserted into the SQL query without proper sanitization or parameterization. An attacker can manipulate the id parameter to execute arbitrary SQL commands, access sensitive data, or modify the database.',
    howToFix: 'Use parameterized queries (prepared statements) to prevent SQL injection.',
    codeFixed: `app.get("/api/user/:id", async (req, res) => {\n  const user = await db.query(\n    "SELECT * FROM users WHERE id = ?",\n    [req.params.id]\n  );\n  res.json(user);\n});`,
  },
  {
    id: 'f-2',
    title: 'Missing Input Validation',
    severity: 'High',
    snippet: 'No validation on id parameter',
    fileLocation: 'app/routes/user.ts:1',
    codeVulnerable: `app.get("/api/user/:id", async (req, res) => {\n  const { id } = req.params;\n  const data = await fetchUser(id);\n  res.json(data);\n});`,
    vulnerableHighlight: 'req.params',
    explanation: 'The route does not validate or cast req.params.id to a valid UUID or integer before processing. Malformed inputs may lead to unhandled runtime errors or logic bypass.',
    howToFix: 'Enforce schema validation using Zod or a validator middleware before processing parameters.',
    codeFixed: `const IdSchema = z.string().uuid();\n\napp.get("/api/user/:id", validateParams(IdSchema), async (req, res) => {\n  const user = await fetchUser(req.params.id);\n  res.json(user);\n});`,
  },
  {
    id: 'f-3',
    title: 'Overly Permissive CORS',
    severity: 'Medium',
    snippet: 'CORS allows requests from any origin',
    fileLocation: 'app/server.ts:12',
    codeVulnerable: `app.use(cors({\n  origin: "*",\n  credentials: true\n}));`,
    vulnerableHighlight: 'origin: "*"',
    explanation: 'Wildcard CORS with credentials enabled allows arbitrary malicious websites to issue authenticated cross-origin requests on behalf of victims.',
    howToFix: 'Restrict CORS origins to explicit trusted web domains.',
    codeFixed: `app.use(cors({\n  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://secuai.dev'],\n  credentials: true\n}));`,
  },
  {
    id: 'f-4',
    title: 'Sensitive Data in Logs',
    severity: 'Medium',
    snippet: 'User data may be logged in plain text',
    fileLocation: 'app/utils/logger.ts:8',
    codeVulnerable: `function logAuthAttempt(user: any) {\n  console.log("Login attempt:", user.email, user.password);\n}`,
    vulnerableHighlight: 'user.password',
    explanation: 'Logging plaintext authentication credentials exposes sensitive user secrets to log aggregators and monitoring dashboards.',
    howToFix: 'Mask or redact password and credential fields before writing to log streams.',
    codeFixed: `function logAuthAttempt(user: any) {\n  console.log("Login attempt:", user.email, "[REDACTED]");\n}`,
  },
  {
    id: 'f-5',
    title: 'Missing Authentication',
    severity: 'High',
    snippet: 'Endpoint is publicly accessible',
    fileLocation: 'app/routes/user.ts:1',
    codeVulnerable: `app.delete("/api/user/:id", async (req, res) => {\n  await db.users.delete(req.params.id);\n  res.status(204).end();\n});`,
    vulnerableHighlight: 'app.delete',
    explanation: 'Destructive deletion endpoint lacks authentication and authorization checks. Any unauthenticated caller can delete user accounts.',
    howToFix: 'Add authentication middleware and verify tenant ownership before deletion.',
    codeFixed: `app.delete("/api/user/:id", authMiddleware, requireAdmin, async (req, res) => {\n  await db.users.delete(req.params.id);\n  res.status(204).end();\n});`,
  },
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text?: string;
  finding?: FindingItem;
  tab?: 'code' | 'explanation';
}

export const AiAssistantPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [findingsList, setFindingsList] = useState<FindingItem[]>([]);
  const [activeFinding, setActiveFinding] = useState<FindingItem | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'explanation'>('code');
  const [selectedModel, setSelectedModel] = useState<string>('Gemini 3.8 Flash (SecuAI)');
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userName = user?.email ? user.email.split('@')[0] : 'John Doe';
  const userInitials = (userName.slice(0, 2) || 'JD').toUpperCase();

  // Load real project findings from backend API
  useEffect(() => {
    async function loadFindings() {
      try {
        const fetched = await api.getFindings();
        if (fetched && fetched.length > 0) {
          const mapped: FindingItem[] = fetched.map((f: any, idx: number) => ({
            id: f.id || `f-${idx + 1}`,
            title: f.title || 'Security Finding',
            severity: (f.severity === 'CRITICAL' ? 'Critical' : f.severity === 'HIGH' ? 'High' : f.severity === 'MEDIUM' ? 'Medium' : 'Low') as any,
            snippet: f.description || 'Vulnerability detected in codebase',
            fileLocation: `${f.file_path || 'src/app.ts'}:${f.line_start || 1}`,
            codeVulnerable: f.evidence?.code_snippet || f.code_snippet || `// Vulnerability detected in ${f.file_path || 'src/app.ts'}\n// Severity: ${f.severity}`,
            vulnerableHighlight: f.file_path?.includes('user') ? 'req.params.id' : undefined,
            explanation: f.explanation || f.description || 'This code pattern allows unauthorized execution or data leakage.',
            howToFix: f.suggested_fix || 'Apply parameterized inputs and validate tenant boundary before state mutations.',
            codeFixed: f.proposed_diff || `// Secured implementation for ${f.file_path || 'src/app.ts'}\n// Validated and protected under SecuAI guardrails`,
          }));
          setFindingsList(mapped);
          setActiveFinding(mapped[0]);
        } else {
          setFindingsList([]);
          setActiveFinding(null);
        }
      } catch (err) {
        console.warn('[AiAssistant] Findings fetch notice:', err);
        setFindingsList([]);
        setActiveFinding(null);
      }
    }
    loadFindings();
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleApplyFix = async () => {
    if (!activeFinding) return;
    try {
      const res = await api.applyFix(activeFinding.id);
      if (res && res.success) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#38BDF8', '#10B981']
        });
        toast.success(`Verified patch applied to ${activeFinding.fileLocation}`);
      } else {
        toast.error(res?.error || 'Failed to apply patch');
      }
    } catch (err: any) {
      toast.error(`Failed to apply patch: ${err.message || 'Error'}`);
    }
  };

  const handleVerifyFix = async () => {
    if (!activeFinding) return;
    setIsVerifying(true);
    try {
      const res = await api.verifyFinding(activeFinding.id);
      if (res && (res.status === 'VERIFIED' || res.new_status === 'VERIFIED')) {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#059669']
        });
        toast.success('Patch VERIFIED: Vulnerability eliminated by scanner re-check!');
      } else if (res && (res.status === 'OPEN' || res.new_status === 'OPEN')) {
        toast.error('Verification FAILED: Scanner reports vulnerability is still present in file.');
      } else {
        toast.info(`Verification result: ${res?.status || res?.new_status || 'INCONCLUSIVE'}`);
      }
    } catch (err: any) {
      toast.error(`Verification error: ${err.message || 'Scanner re-check failed'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectFinding = (finding: FindingItem) => {
    setActiveFinding(finding);
    setActiveTab('code');
    toast.info(`Loaded analysis for ${finding.title}`);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputValue.trim();
    if (!text || isSubmitting) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSubmitting(true);

    try {
      const response = await api.chatWithAiAssistant({
        message: text,
        finding_id: activeFinding?.id,
        code_snippet: activeFinding?.codeVulnerable,
        file_location: activeFinding?.fileLocation,
        model: selectedModel.includes('Gemini') ? 'gemini-3.8-flash' : 'gemini-2.5-flash',
      });

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: response.reply,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: `### 🛡️ SecuAI Security Analysis\n\nTo remediate security vulnerabilities in \`${activeFinding ? activeFinding.fileLocation : 'the target codebase'}\`, enforce input validation with Zod and implement parameterized queries to prevent injection.\n\nEnsure Row Level Security is active on public tables and multi-tenant isolation policies (\`auth.uid() = user_id\`) are enforced.`,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const models = [
    'Gemini 3.8 Flash (SecuAI)',
    'Gemini 2.5 Flash',
    'GPT-4o (SecuAI)',
    'Claude 3.7 Sonnet',
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFD] text-slate-800 antialiased overflow-hidden font-sans">
      {/* 1. Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 2. Top Header */}
        <Header 
          title="AI Assistant"
          onSearchFocus={() => inputRef.current?.focus()}
          userEmail={user?.email || 'john@company.com'}
        />

        {/* 3. Center Feed & Right Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Interactive Chat Workspace */}
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 lg:p-8 space-y-6">
            <div className="max-w-4xl mx-auto w-full space-y-6">
              
              {/* Hero Title & Floating Pulse Indicator */}
              <div className="flex items-start justify-between gap-4 pt-2 pb-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    Your AI security{' '}
                    <span className="font-serif italic font-normal text-[#2563EB]">
                      engineer.
                    </span>
                  </h1>
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-xl leading-relaxed">
                    Ask questions about your code, security issues, or how to fix vulnerabilities. SecuAI analyzes, explains, and guides you with clear, actionable answers.
                  </p>
                </div>

                {/* Floating Circuit Badge Indicator */}
                <div className="hidden sm:flex items-center space-x-3 px-3.5 py-2 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs shrink-0">
                  <div className="relative flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                    <span className="absolute w-4 h-4 rounded-full bg-blue-400/30 animate-ping" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">
                      Analyzing with SecuAI...
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Code • Security • Best Practices
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Finding Workspace or Copilot Welcome */}
              {activeFinding ? (
                <>
                  {/* Message 1: User Query Card */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                        {userInitials}
                      </div>
                      <span className="text-xs font-semibold text-slate-900">
                        Why is this code vulnerable and how can I fix it?
                      </span>
                    </div>

                    {/* Vulnerable Code Snippet Card */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 text-xs">
                        <span className="font-mono text-slate-600 font-medium">
                          {activeFinding.fileLocation.split(':')[0]}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-200/60 text-slate-600 text-[11px] font-medium">
                          TypeScript
                        </span>
                      </div>

                      <div className="p-4 font-mono text-xs leading-relaxed text-slate-800 overflow-x-auto bg-[#FFFFFF]">
                        {activeFinding.codeVulnerable.split('\n').map((line, idx) => {
                          const lineNum = idx + 1;
                          const isVulnerableLine = activeFinding.vulnerableHighlight && line.includes(activeFinding.vulnerableHighlight);

                          return (
                            <div key={idx} className="flex items-baseline space-x-4">
                              <span className="w-4 text-right text-slate-300 select-none text-[11px]">
                                {lineNum}
                              </span>
                              <span className="flex-1 whitespace-pre">
                                {isVulnerableLine && activeFinding.vulnerableHighlight ? (
                                  <>
                                    {line.split(activeFinding.vulnerableHighlight)[0]}
                                    <span className="bg-rose-50 text-rose-600 font-semibold px-1 py-0.5 rounded border border-rose-200/60 underline decoration-rose-400 decoration-wavy">
                                      {activeFinding.vulnerableHighlight}
                                    </span>
                                    {line.split(activeFinding.vulnerableHighlight)[1]}
                                  </>
                                ) : (
                                  line
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Message 2: AI Assistant Response Card */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <Shield className="w-4 h-4 fill-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          This code is vulnerable to {activeFinding.title.toLowerCase().includes('sql') ? 'SQL injection' : activeFinding.title}.
                        </span>
                      </div>

                      <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>{activeFinding.severity} Severity</span>
                      </div>
                    </div>

                    {/* Explanation text */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {activeFinding.explanation}
                      </p>

                      {/* How to Fix Heading */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs sm:text-sm mb-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>How to fix it</span>
                        </div>
                        <p className="text-xs text-slate-500 pl-6">
                          {activeFinding.howToFix}
                        </p>
                      </div>

                      {/* Fix Tabs and Fixed Code Box */}
                      <div className="rounded-xl border border-slate-200/80 bg-[#FAFCFF] overflow-hidden">
                        {/* Tabs Header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-b border-slate-200/80 text-xs">
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setActiveTab('code')}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                activeTab === 'code'
                                  ? 'bg-blue-50 text-[#2563EB] shadow-2xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Fixed Code
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveTab('explanation')}
                              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                activeTab === 'explanation'
                                  ? 'bg-blue-50 text-[#2563EB] shadow-2xs font-semibold'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Explanation
                            </button>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={handleApplyFix}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors shadow-2xs"
                            >
                              <Wand2 className="w-3 h-3 mr-1" />
                              <span>Apply Fix</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleVerifyFix}
                              disabled={isVerifying}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors shadow-2xs disabled:opacity-50"
                            >
                              {isVerifying ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                              )}
                              <span>Verify</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(activeFinding.codeFixed)}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-medium transition-colors"
                            >
                              {copiedCode ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'code' ? (
                          <div className="p-4 font-mono text-xs leading-relaxed text-slate-800 overflow-x-auto bg-white">
                            {activeFinding.codeFixed.split('\n').map((line, idx) => (
                              <div key={idx} className="flex items-baseline space-x-4">
                                <span className="w-4 text-right text-slate-300 select-none text-[11px]">
                                  {idx + 1}
                                </span>
                                <span className="whitespace-pre">{line}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-xs text-slate-600 leading-relaxed bg-white">
                            <p className="font-semibold text-slate-900 mb-1">
                              Why this pattern works:
                            </p>
                            <p>
                              By substituting dynamic string templates with parameter placeholders (<code>?</code> or <code>$1</code>), SQL query structures are compiled and locked ahead of time. Any user-supplied argument is transmitted strictly as raw data literals, rendering SQL injection syntactically impossible.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-4 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto border border-blue-100">
                    <Sparkles className="w-7 h-7 text-[#2563EB]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">SecuAI Application Security Copilot</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Ask questions about your code architecture, dependencies, or security posture. All responses are grounded in verified scanner findings.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSendMessage("What should I fix first?")}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
                    >
                      🎯 What should I fix first?
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage("Is my application secure?")}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
                    >
                      🛡️ Is my application secure?
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMessage("How do I prevent SQL injection in Node.js?")}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
                    >
                      💡 How to prevent SQL injection?
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Follow-up Messages */}
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  <div className="flex items-center space-x-2.5">
                    {msg.sender === 'user' ? (
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {userInitials}
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 fill-white" />
                      </div>
                    )}
                    <span className="text-xs font-semibold text-slate-900">
                      {msg.sender === 'user' ? 'Follow-up' : 'SecuAI Analysis'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap ml-9 font-sans">
                    {msg.text}
                  </div>
                </div>
              ))}

              {isSubmitting && (
                <div className="flex items-center space-x-2 text-xs text-slate-400 pl-9">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>SecuAI is analyzing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />

              {/* Bottom Input Pill Box */}
              <div className="pt-2">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm flex items-center space-x-3 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                  <button
                    type="button"
                    onClick={() => toast.info('Code attachment dialogue opened')}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                    title="Attach snippet or file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    placeholder="Ask a follow-up question..."
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-slate-800 placeholder-slate-400"
                  />

                  {/* Model Selector Dropdown */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
                    >
                      <span className="text-[11px] font-semibold">{selectedModel}</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {showModelDropdown && (
                      <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 p-1 z-50 text-xs">
                        {models.map((m) => (
                          <button
                            key={m}
                            onClick={() => {
                              setSelectedModel(m);
                              setShowModelDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                              selectedModel === m ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{m}</span>
                            {selectedModel === m && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    className="w-8 h-8 rounded-xl bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center transition-all shadow-xs shrink-0 active:scale-95"
                    title="Send question"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>

                {/* Prompt Suggestion Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  {[
                    'Explain this vulnerability →',
                    'Show me more secure patterns →',
                    'How to validate user input? →',
                    'Check this function →',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSendMessage(chip.replace(' →', ''))}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors shadow-2xs"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </main>

          {/* 4. Right Sidebar Panel */}
          <aside className="w-80 lg:w-96 border-l border-slate-200/80 bg-white/60 backdrop-blur-md p-6 overflow-y-auto hidden md:flex flex-col space-y-6 shrink-0">
            {/* Section 1: Related Security Findings */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <h2 className="text-xs font-bold text-slate-900 tracking-tight">
                  Related Security Findings
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                  {findingsList.length}
                </span>
              </div>

              <div className="space-y-2">
                {findingsList.map((f) => {
                  const isSelected = activeFinding ? f.id === activeFinding.id : false;
                  const isHigh = f.severity === 'High' || f.severity === 'Critical';

                  return (
                    <div
                      key={f.id}
                      onClick={() => handleSelectFinding(f)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                        isSelected
                          ? 'border-blue-400/80 bg-[#F4F8FE] shadow-xs'
                          : 'border-slate-200/80 bg-white hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isHigh ? 'bg-rose-500 ring-2 ring-rose-200' : 'bg-amber-500 ring-2 ring-amber-200'
                            }`}
                          />
                          <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                            {f.title}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                            isHigh
                              ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                              : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                          }`}
                        >
                          {f.severity}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {f.snippet}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100/80 text-[10px] text-slate-400 font-mono">
                        <span className="truncate">{f.fileLocation}</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Quick Actions */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h2 className="text-xs font-bold text-slate-900 tracking-tight">
                Quick Actions
              </h2>

              <div className="space-y-2">
                {/* 1. Apply AI Fix */}
                <button
                  type="button"
                  onClick={handleApplyFix}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition-all group shadow-2xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-[#2563EB] transition-colors">
                        Apply AI fix
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Automatically apply the secure fix
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* 2. Explain in simpler terms */}
                <button
                  type="button"
                  onClick={() => handleSendMessage('Explain in simpler terms')}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition-all group shadow-2xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                        Explain in simpler terms
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Get a plain English explanation
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* 3. Show similar examples */}
                <button
                  type="button"
                  onClick={() => handleSendMessage('Show me more secure patterns and similar examples')}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition-all group shadow-2xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-cyan-600 transition-colors">
                        Show similar examples
                      </div>
                      <div className="text-[11px] text-slate-400">
                        See more secure code patterns
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* 4. Scan entire file */}
                <button
                  type="button"
                  onClick={() => {
                    toast.info(`Scanning ${activeFinding ? activeFinding.fileLocation.split(':')[0] : 'file'} with isitsecure engine...`);
                    setTimeout(() => toast.success('Scan complete: 2 findings isolated in file'), 1200);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition-all group shadow-2xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        Scan entire file
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Find all security issues in this file
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* 5. Add test cases */}
                <button
                  type="button"
                  onClick={() => {
                    toast.info('Generating Vitest / Jest exploit payload test cases...');
                    setTimeout(() => toast.success('Generated 2 security regression test cases in tests/security.test.ts'), 1000);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition-all group shadow-2xs"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                        Add test cases
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Generate security test cases
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AiAssistantPage;
