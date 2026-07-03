import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  FileText, 
  Sparkles, 
  Users2, 
  History, 
  Share2, 
  ShieldCheck, 
  ArrowRight,
  Sun,
  Moon,
  Github,
  Laptop
} from 'lucide-react';

export default function LandingPage() {
  const { isSignedIn, isDemoMode, signIn } = useAppAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleStart = () => {
    if (isSignedIn) {
      navigate('/dashboard');
    } else if (isDemoMode) {
      signIn();
      navigate('/dashboard');
    } else {
      // Clerk handles login. If Clerk is loaded, we can trigger Clerk's sign-in flow.
      // In this setup, we'll let the user click a Sign In button which Clerk renders.
      // But since we want a unified experience, if they click Get Started we can redirect.
      // Actually, we'll render Clerk's SignInButton or redirect to dashboard which ProtectedRoute handles by showing clerk if configured.
      // Since ProtectedRoute redirects to '/' if not signed in, let's make sure they can sign in from here.
      // In a Clerk app, we can use SignInButton, but if we don't have it explicitly imported, we can just redirect to /dashboard and let Clerk handle it!
      // Wait, yes! Redirecting to /dashboard automatically forces Clerk's SignUp/SignIn screen if they are not logged in.
      // This is super clean!
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300 relative overflow-hidden">
      {/* Background decoration grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

      {/* Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>

      {/* Navbar */}
      <header className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-blue-600 via-indigo-500 to-indigo-600 bg-clip-text text-transparent">
            DocStudio
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <button
            onClick={handleStart}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isSignedIn ? 'Go to Workspace' : isDemoMode ? 'Launch Demo' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-28 relative z-10 flex flex-col items-center text-center">
        {/* Floating badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-wide uppercase mb-6 animate-fade-in shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-time Rich Text Collaboration</span>
        </div>

        <h1 className="font-display font-bold text-4xl sm:text-6xl tracking-tight max-w-4xl leading-[1.1] mb-6">
          Collaborate on documents with{' '}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
            zero friction, in real-time.
          </span>
        </h1>

        <p className="text-slate-600 dark:text-slate-400 text-lg sm:text-xl max-w-2xl leading-relaxed mb-10">
          A lightning-fast, production-ready document studio. Create, edit, star, restore versions, and share documents with advanced permissions.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <button
            onClick={handleStart}
            className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30 transition-all text-base flex items-center justify-center gap-2 cursor-pointer group"
          >
            {isSignedIn ? 'Enter Workspace' : isDemoMode ? 'Try Instant Demo (No Login)' : 'Get Started Free'}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {isDemoMode && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              ⚡ Running in Demo Mode. MongoDB & Clerk keys can be set up in environment files.
            </span>
          )}
        </div>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl text-left mt-8">
          <div className="p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm transition-all hover:translate-y-[-2px] hover:border-slate-300 dark:hover:border-slate-700">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-5 shadow-sm">
              <Users2 className="w-6 h-6" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">Live Collaborators</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Edit documents together with real-time text sync, cursor location flags, active avatar indicators, and full-presence sync.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm transition-all hover:translate-y-[-2px] hover:border-slate-300 dark:hover:border-slate-700">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-5 shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">Version Backups</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Never lose your modifications. View complete snapshot histories, compare past content changes, and revert to previous versions.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm transition-all hover:translate-y-[-2px] hover:border-slate-300 dark:hover:border-slate-700">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-violet-600 dark:text-violet-400 mb-5 shadow-sm">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">Granular Sharing</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Protect your data by setting links to Public or Private, and assign distinct roles like Owner, Editor, Commenter, and Viewer.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/50 dark:border-slate-800/50 relative z-10 py-8 bg-slate-100/50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <span>Built by portfolio creator. Production-ready architecture.</span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="#" 
              className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
