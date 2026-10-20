import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Lock,
  User,
  ArrowRight,
  Moon,
  Sun,
  AlertCircle,
  KeyRound
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, error, isLoading, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [usuario, setUsuario] = useState('admin@mediamonitor.com');
  const [password, setPassword] = useState('admin123');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(usuario, password);
  };

  const handleSelectPreset = (userEmail: string, pass: string) => {
    setUsuario(userEmail);
    setPassword(pass);
    clearError();
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-80 h-80 bg-rose-500/10 dark:bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
        <button
          onClick={toggleTheme}
          id="btn-theme-toggle-login"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all cursor-pointer shadow-xs"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-xl relative z-10"
      >
        {/* Main Card */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/90 backdrop-blur-2xl shadow-xl dark:shadow-2xl relative overflow-hidden">
          {/* Top ambient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-rose-500 z-10" />

          {/* Encabezado con Fondo Blanco Permanente para destacar el membrete */}
          <div className="bg-white border-b border-slate-200/80 px-6 pt-8 pb-7 sm:px-10 sm:pt-9 sm:pb-8 text-center relative select-none">
            <div className="flex justify-center mb-4">
              <img
                src="/membrete.png"
                alt="Arg.Os Media Monitoring"
                className="max-h-12 sm:max-h-14 max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <p className="text-xs uppercase tracking-widest font-bold text-cyan-600 mb-1">
              Plataforma de Business Intelligence & Reputación
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Control de Acceso Cerrado
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Autenticación centralizada y exclusiva solo usuarios autorizados
            </p>
          </div>

          {/* Card Body with Form and Controls */}
          <div className="p-6 sm:p-10">
            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Error de autenticación</p>
                  <p className="text-xs text-rose-600 dark:text-rose-300/90 mt-0.5">{error}</p>
                </div>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Usuario / Correo Registrado
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    id="input-login-usuario"
                    required
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="usuario@mediamonitor.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    id="input-login-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-login-submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar a la Plataforma BI</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Access Presets */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Usuarios de Prueba
                </span>
                <span className="text-[11px] text-cyan-700 dark:text-cyan-400/80 bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/40 px-2 py-0.5 rounded-full font-medium">
                  1-Click Demo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  id="btn-preset-admin"
                  onClick={() => handleSelectPreset('admin@mediamonitor.com', 'admin123')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    usuario === 'admin@mediamonitor.com'
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-950 dark:text-cyan-200 ring-1 ring-cyan-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold truncate">Admin General</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">admin123</div>
                  <div className="mt-1 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-semibold w-fit">
                    admin
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-preset-analista"
                  onClick={() => handleSelectPreset('analista@mediamonitor.com', 'analista123')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    usuario === 'analista@mediamonitor.com'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold truncate">Claudia Vega</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">analista123</div>
                  <div className="mt-1 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold w-fit">
                    analista
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-preset-director"
                  onClick={() => handleSelectPreset('director@corporativo.com', 'director123')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    usuario === 'director@corporativo.com'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 ring-1 ring-purple-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold truncate">Alejandro Garza</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">director123</div>
                  <div className="mt-1 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/15 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold w-fit">
                    lector
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
