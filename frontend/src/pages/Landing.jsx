import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { 
  Tv, Sparkles, Shield, Zap, ArrowRight, MessageSquare, Play, Video, 
  Share2, Users, Mic, MicOff, Volume2, PenTool, MousePointer, Circle, 
  Square, Check, Search 
} from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <div className="relative w-full overflow-hidden py-12 md:py-20">
      {/* Background Neon Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 blur-[120px] pointer-events-none -z-10" />
      <div className="absolute -top-40 right-10 w-[300px] h-[300px] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[100px] pointer-events-none -z-10" />

      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center px-4 space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>New: 1GB Video Transcoding &amp; HLS Streaming</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none text-slate-900 dark:text-white font-display">
          Watch Movies Together <br />
          <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
            In Perfect Sync
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Create your private watch lounge, upload large video files up to 1GB, and stream high-quality HLS video in absolute synchronization with friends. Complete with real-time chat and notifications.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          {user ? (
            <Link
              to="/lobby"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer text-base"
            >
              <span>Go to Lounge Lobby</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <>
              <Link
                to="/signup"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer text-base"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
              >
                <span>Sign In to Account</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Interactive UI Mockup */}
      <div className="mt-16 md:mt-24 max-w-6xl mx-auto px-4">
        <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-950/40 p-3 sm:p-5 shadow-2xl backdrop-blur-md overflow-hidden group">
          
          {/* Mock Window bar */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden flex flex-col relative shadow-xl">
            
            {/* Top Window Header */}
            <div className="h-11 border-b border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-900/60 px-4 flex items-center justify-between text-[11px] text-slate-500 font-sans">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-4 py-1 rounded-lg text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                <Zap className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span>watch2gether.app/room/interactive-collab-7</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-500 font-bold font-sans">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-[10px] tracking-wider">LIVE CO-OP</span>
              </div>
            </div>

            {/* Split Grid Body */}
            <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[450px] bg-white dark:bg-slate-950 font-sans">
              
              {/* Left Panel: Voice Lounge & Audio */}
              <div className="border-r border-slate-200 dark:border-slate-900 p-4 flex flex-col justify-between bg-slate-50/50 dark:bg-slate-900/10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-900">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-indigo-500" />
                      Voice Channel
                    </span>
                    <span className="text-[9px] text-emerald-500 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/20 px-1.5 py-0.5 rounded font-bold font-mono">
                      Active
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* User 1 (Active Speaking) */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                      <div className="flex items-center gap-2.5 min-w-0 z-10">
                        <div className="relative">
                          <img
                            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=48&h=48&q=80"
                            alt="Alice Voice"
                            className="w-7 h-7 rounded-lg object-cover ring-2 ring-emerald-500 animate-pulse"
                          />
                          <span className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-500 text-white rounded-full text-[6px]">
                            <Volume2 className="w-2 h-2" />
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">Sarah (Host)</span>
                          <span className="text-[8px] text-emerald-500 font-semibold uppercase block">Speaking</span>
                        </div>
                      </div>
                      <div className="flex items-end gap-0.5 h-3 z-10 pr-1">
                        <span className="w-0.5 bg-emerald-500 rounded-full animate-bounce h-2" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-0.5 bg-emerald-500 rounded-full animate-bounce h-3" style={{ animationDelay: '0.3s' }}></span>
                        <span className="w-0.5 bg-emerald-500 rounded-full animate-bounce h-1.5" style={{ animationDelay: '0.5s' }}></span>
                      </div>
                    </div>

                    {/* User 2 (Muted) */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-transparent">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=48&h=48&q=80"
                          alt="Bob Voice"
                          className="w-7 h-7 rounded-lg object-cover opacity-70"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block truncate">Marcus</span>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block">Muted</span>
                        </div>
                      </div>
                      <MicOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 mr-1" />
                    </div>

                    {/* User 3 (Active Connection) */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-transparent">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=48&h=48&q=80"
                          alt="Charlie Voice"
                          className="w-7 h-7 rounded-lg object-cover opacity-70"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block truncate">Alex</span>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block">Connected</span>
                        </div>
                      </div>
                      <Mic className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 mr-1" />
                    </div>
                  </div>
                </div>

                {/* Voice Control Buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-900 flex items-center justify-between gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 text-[10px] font-bold transition-all border border-rose-500/20">
                    Disconnect
                  </button>
                  <button className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400">
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Center Panel: Shared Whiteboard Canvas */}
              <div className="border-r border-slate-200 dark:border-slate-900 p-4 flex flex-col justify-between relative bg-slate-50/20 dark:bg-slate-950 overflow-hidden">
                {/* Visual Grid canvas background */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none"></div>

                {/* Canvas Top toolbar */}
                <div className="z-10 flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-900">
                  <div className="flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Room Whiteboard</span>
                  </div>
                  
                  {/* Toolkit */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-lg shadow-sm">
                    <button className="p-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      <PenTool className="w-3 h-3" />
                    </button>
                    <button className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                      <MousePointer className="w-3 h-3" />
                    </button>
                    <button className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                      <Circle className="w-3 h-3" />
                    </button>
                    <button className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
                      <Square className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Sketching Canvas Area */}
                <div className="flex-1 relative min-h-[260px] flex items-center justify-center p-4">
                  
                  {/* Vector flowchart sketch */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-sm" xmlns="http://www.w3.org/2000/svg">
                    {/* Handdrawn styled arrows and shapes */}
                    <path d="M 50 130 C 80 130, 90 90, 140 90" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="4" />
                    <path d="M 50 130 C 80 130, 90 170, 140 170" fill="none" stroke="#f43f5e" strokeWidth="2.5" />
                    
                    {/* Arrowheads */}
                    <path d="M 133 86 L 141 90 L 133 94" fill="none" stroke="#6366f1" strokeWidth="2" />
                    <path d="M 133 166 L 141 170 L 133 174" fill="none" stroke="#f43f5e" strokeWidth="2" />
                  </svg>

                  {/* Flowchart Elements */}
                  <div className="absolute left-4 top-[105px] bg-indigo-500 text-white font-bold text-[9px] px-3 py-2 rounded-xl border-2 border-indigo-400 shadow-md">
                    Watch Lounge
                  </div>

                  <div className="absolute left-[135px] top-[65px] bg-emerald-500 text-slate-950 font-bold text-[9px] px-3 py-2 rounded-xl border-2 border-emerald-400 shadow-md">
                    HLS Transcoder
                  </div>

                  <div className="absolute left-[135px] top-[145px] bg-rose-500 text-white font-bold text-[9px] px-3 py-2 rounded-xl border-2 border-rose-400 shadow-md">
                    Sync Engine
                  </div>

                  {/* Creative handwritten notes */}
                  <div className="absolute right-6 top-6 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] font-semibold px-3 py-2 rounded-lg rotate-3 shadow-md max-w-[130px] leading-relaxed">
                    ✏️ Sarah: Let&apos;s map local `.ts` segments to WebSockets for instant sync!
                  </div>

                  {/* Dynamic Cursors */}
                  {/* Cursor 1 */}
                  <div className="absolute left-[90px] top-[140px] flex items-center gap-1 pointer-events-none animate-pulse">
                    <MousePointer className="w-4 h-4 text-rose-500 fill-rose-500 rotate-[270deg]" />
                    <span className="bg-rose-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">Sarah</span>
                  </div>

                  {/* Cursor 2 */}
                  <div className="absolute left-[200px] top-[100px] flex items-center gap-1 pointer-events-none">
                    <MousePointer className="w-4 h-4 text-emerald-400 fill-emerald-400 rotate-[270deg]" />
                    <span className="bg-emerald-400 text-slate-900 text-[8px] font-bold px-1.5 py-0.5 rounded shadow">Marcus</span>
                  </div>
                </div>

                {/* Canvas Footer notification */}
                <div className="z-10 flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Sarah is sketching on the whiteboard...</span>
                </div>
              </div>

              {/* Right Panel: Friends & Rooms (Lobby activity) */}
              <div className="p-4 flex flex-col justify-between bg-slate-50/20 dark:bg-slate-900/5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-900">
                    <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      Active Friends
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">3 online</span>
                  </div>

                  {/* Mock search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <div className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-[10px] text-slate-400 text-left">
                      Search buddies...
                    </div>
                  </div>

                  {/* Friends List */}
                  <div className="space-y-2.5">
                    {/* Friend 1 (Online - Lobby) */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=48&h=48&q=80"
                            alt="Alice avatar"
                            className="w-6.5 h-6.5 rounded-lg object-cover"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-950 bg-emerald-500"></span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block truncate">Alice</span>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block truncate">In Lobby</span>
                        </div>
                      </div>
                      <button className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[8px] font-bold rounded-md transition-all">
                        Invite
                      </button>
                    </div>

                    {/* Friend 2 (Online - In Room) */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=48&h=48&q=80"
                            alt="Bob avatar"
                            className="w-6.5 h-6.5 rounded-lg object-cover"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-950 bg-emerald-500"></span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block truncate">Danny</span>
                          <span className="text-[8px] text-indigo-500 dark:text-indigo-400 font-bold block truncate">Watching Movie</span>
                        </div>
                      </div>
                      <button className="px-2 py-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-bold rounded-md transition-all border border-slate-200 dark:border-slate-800">
                        Join
                      </button>
                    </div>

                    {/* Friend 3 (Offline) */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl opacity-60">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=48&h=48&q=80"
                            alt="Charlie avatar"
                            className="w-6.5 h-6.5 rounded-lg object-cover grayscale"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-950 bg-slate-400 dark:bg-slate-600"></span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block truncate">Chloe</span>
                          <span className="text-[8px] text-slate-400 dark:text-slate-500 block truncate">Offline</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connection helper */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-900 text-left">
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight block">
                    Invite friends to lounge for voice &amp; live sync streams.
                  </span>
                </div>
              </div>

            </div>

          </div>

          {/* Absolute floating card with feature details */}
          <div className="absolute bottom-8 left-8 right-8 bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-emerald-500/20 px-6 py-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
            <div className="text-left">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white font-display">Watch2Gether Cinematic Lounge</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Stream high-bitrate video formats with lag-free syncing.</p>
            </div>
            <Link
              to={user ? "/lobby" : "/signup"}
              className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{user ? "Enter Lobby" : "Launch Lounge"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </div>

      {/* Features Grid */}
      <div className="mt-24 md:mt-32 max-w-5xl mx-auto px-4">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-display">
            Built for Cinephiles &amp; Watch Parties
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xl mx-auto">
            Enjoy premium streaming utilities engineered to make remote theater sessions feel side-by-side.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {/* Card 1 */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 w-fit mb-4">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg font-display">Up to 1GB Local Uploads</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              Upload your own movies, episodes, or clips directly from your computer. Supports MP4, MKV, and major media formats.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 w-fit mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg font-display">Fast HLS Transcoding</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              Our backend automatically slices videos into HTTP Live Streaming (HLS) segments, enabling fast playback, seeking, and low latency streaming.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 w-fit mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg font-display">Absolute Playback Sync</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              Powered by robust WebSockets. Whenever the room host plays, pauses, or jumps forward, everyone's player adjusts within milliseconds.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 w-fit mb-4">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg font-display">Crystal Voice Lounge</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              Connect your microphone and chat with friends in real-time. High-fidelity voice streaming ensures zero lag or overlay echoes.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 w-fit mb-4">
              <PenTool className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg font-display">Interactive Whiteboard</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              Brainstorm, draw flowcharts, sketch wireframes, and jot down colorful notes together on a shared canvas directly next to your stream.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-500/10 w-fit mb-4">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg font-display">Active Friends List</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 leading-relaxed">
              Track online/offline buddies, coordinate active room joins, accept friend requests, and send direct invitations with one click.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
