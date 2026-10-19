"use client";

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User as UserIcon, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = usuario.trim();
    const trimmedPass = password.trim();

    if (!trimmedUser || !trimmedPass) {
      setErrorMessage('Por favor ingrese su usuario y contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuario: trimmedUser,
          password: trimmedPass,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(
          data.error || 'Credenciales incorrectas o cuenta inactiva. Verifique con el administrador.'
        );
        setIsLoading(false);
        return;
      }

      // Éxito: Redirigir al dashboard o ruta solicitada
      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      console.error('Error de autenticación:', err);
      setErrorMessage('Error al conectar con el servidor de autenticación. Intente de nuevo.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 overflow-hidden font-sans">
      {/* Elementos de fondo ambiental estilo Glassmorphism */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Tarjeta principal */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/90 backdrop-blur-2xl shadow-2xl text-slate-100 transition-all overflow-hidden">
        {/* Acento superior estilizado */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-rose-500 z-10" />

        {/* Cabecera con Fondo Blanco Permanente para destacar el membrete oficial */}
        <div className="bg-white border-b border-slate-200 px-6 pt-8 pb-7 text-center select-none">
          <div className="flex justify-center mb-4">
            <img
              src="/membrete.png"
              alt="Media Monitoring & Reputation BI"
              className="max-h-12 sm:max-h-14 max-w-full object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 mb-1.5">
            Portal de Monitoreo & BI
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Acceso corporativo exclusivo. Autenticación centralizada para personal autorizado.
          </p>
        </div>

        {/* Cuerpo del formulario */}
        <div className="p-7 sm:p-9">
          {/* Mensaje de error visual */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Formulario de autenticación */}
          <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo Usuario */}
          <div>
            <label
              htmlFor="usuario-input"
              className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider"
            >
              Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="usuario-input"
                name="usuario"
                type="text"
                autoComplete="username"
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="ej. analista1"
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700/80 bg-slate-950/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password-input"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
              >
                Contraseña
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password-input"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-700/80 bg-slate-950/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botón de envío */}
          <button
            type="submit"
            id="login-submit-button"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Pie de la tarjeta */}
        <div className="mt-8 pt-5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Acceso Encriptado
          </span>
          <span>Seguridad SSL</span>
        </div>
      </div>
    </div>
  </div>
  );
}
