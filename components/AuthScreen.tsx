import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Gamepad2, Rocket, ArrowRight, Loader2, Chrome } from 'lucide-react';
import { registerUser, loginUser, loginWithGoogle, loginWithApple } from '../lib/auth-service';
import { cn } from '../lib/utils';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        await registerUser(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Bir xəta baş verdi');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (type: 'google' | 'apple') => {
    setSocialLoading(type);
    setError(null);
    try {
      if (type === 'google') {
        await loginWithGoogle();
      } else {
        await loginWithApple();
      }
    } catch (err: any) {
      setError(err.message || 'Giriş uğursuz oldu');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="inline-block p-4 rounded-2xl bg-indigo-600 mb-6 shadow-lg shadow-indigo-100"
          >
            <Gamepad2 className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900">
            dgame
          </h1>
          <p className="text-slate-500 font-medium">Uğurlar, oyunçu!</p>
        </div>

        <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1 relative group">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Email Ünvanı</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="email"
                    placeholder="dasdemirov2017@gmail.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 py-4 pl-12 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all text-slate-800 placeholder:text-slate-300 font-medium"
                  />
                </div>
              </div>
              <div className="space-y-1 relative group">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 ml-1">Şifrə</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 py-4 pl-12 pr-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all text-slate-800 placeholder:text-slate-300 font-medium"
                  />
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-rose-500 text-sm bg-rose-50 p-3 rounded-xl border border-rose-100 text-center font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              disabled={loading}
              className={cn(
                "w-full bg-indigo-600 hover:bg-slate-900 text-white font-bold py-5 rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2",
                loading && "opacity-70 cursor-not-allowed"
              )}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Daxil ol' : 'Qeydiyyatdan keç'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex flex-col gap-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">və ya</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => handleSocialLogin('google')}
                disabled={!!socialLoading}
                className="flex items-center justify-center gap-2 py-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs text-slate-600 disabled:opacity-50"
              >
                {socialLoading === 'google' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Chrome className="w-4 h-4 text-indigo-600" />
                    Google
                  </>
                )}
              </button>
              <button
                onClick={() => handleSocialLogin('apple')}
                disabled={!!socialLoading}
                className="flex items-center justify-center gap-2 py-3 bg-slate-900 border border-slate-900 rounded-xl hover:bg-slate-800 transition-all font-bold text-xs text-white disabled:opacity-50"
              >
                {socialLoading === 'apple' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Apple</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-8 text-center border-t border-slate-50 pt-8">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-slate-400 hover:text-indigo-600 transition-colors text-xs font-bold uppercase tracking-wider"
            >
              {isLogin ? "Hesabınız yoxdur? Sign Up" : "Artıq hesabınız var? Log In"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
