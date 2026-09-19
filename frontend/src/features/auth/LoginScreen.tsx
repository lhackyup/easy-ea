import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import {
  Shield,
  Layers,
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  Globe,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, authError, clearAuthError } = useAuth();
  const { t, interpolate, language, setLanguage } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OIDC Configuration State
  const [oidcConfig, setOidcConfig] = useState<{
    enabled: boolean;
    provider_name: string;
    login_url: string;
    allow_local_login?: boolean;
    allow_idp_login?: boolean;
  } | null>(null);
  const [oidcLoading, setOidcLoading] = useState(false);

  useEffect(() => {
    const fetchOidc = async () => {
      try {
        const cfg = await api.getOidcConfig();
        setOidcConfig(cfg);
      } catch (err) {
        console.warn('OIDC config not available:', err);
      }
    };
    fetchOidc();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setSubmitting(true);
    setError(null);
    clearAuthError();
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || t.auth.loginError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSsoLogin = () => {
    setOidcLoading(true);
    clearAuthError();
    // Redirect browser to backend OIDC login endpoint
    window.location.href = oidcConfig?.login_url || '/api/auth/oidc/login';
  };

  const fillSysAdmin = () => {
    setUsername('sys_admin');
    setPassword('AdminEasyEA2026!');
    setError(null);
    clearAuthError();
  };

  const displayError = error || authError;

  const allowLocal = oidcConfig ? (oidcConfig.allow_local_login !== false) : true;
  const allowIdp = oidcConfig ? (oidcConfig.allow_idp_login !== false && oidcConfig.enabled) : false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Language toggle top right */}
      <div className="absolute top-6 right-6 z-10 flex items-center space-x-2 bg-white/80 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <button
          onClick={() => setLanguage('en')}
          className={`text-xs font-bold transition px-2 py-0.5 rounded-full ${
            language === 'en' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('it')}
          className={`text-xs font-bold transition px-2 py-0.5 rounded-full ${
            language === 'it' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          IT
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Logo & Heading */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-rose-600 to-rose-500 rounded-2xl shadow-lg shadow-rose-500/20 mb-3">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
            <span>Easy</span><span className="text-rose-600">EA</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
            {t.auth.loginSubtitle}
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-white py-8 px-6 shadow-xl shadow-slate-200/60 sm:rounded-2xl border border-slate-200/80 sm:px-10 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">{t.auth.loginTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {allowIdp && allowLocal
                ? t.auth.loginSubtitleBoth
                : allowIdp
                ? t.auth.loginSubtitleIdpOnly
                : t.auth.loginSubtitleLocalOnly}
            </p>
          </div>

          {displayError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {/* OAuth2 / OpenID Connect SSO Primary Section */}
          {allowIdp && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSsoLogin}
                disabled={oidcLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 hover:from-indigo-100 hover:to-sky-100 text-indigo-900 font-bold text-xs shadow-xs hover:shadow transition group disabled:opacity-60 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>
                  {oidcLoading
                    ? t.auth.ssoRedirecting
                    : interpolate(t.auth.loginWithSso, { provider: oidcConfig?.provider_name || 'Keycloak' })}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 transition" />
              </button>

              {allowLocal && (
                <div className="relative flex items-center justify-center my-4">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] text-slate-400 font-medium tracking-wide uppercase shrink-0">
                    {t.auth.ssoDivider}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Local Username/Password Form */}
          {allowLocal && (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.auth.usernameOrEmail}
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t.auth.usernamePlaceholder}
                      className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.auth.password}
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.auth.passwordPlaceholder}
                      className="block w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !username.trim() || !password}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 transition cursor-pointer"
                >
                  {submitting ? t.auth.loggingIn : t.auth.loginButton}
                </button>
              </form>

              {/* Quick-fill Sys Admin Credentials Box */}
              <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-600" />
                    {t.auth.demoCredentialsTitle}
                  </span>
                  <button
                    type="button"
                    onClick={fillSysAdmin}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    {t.auth.useSysAdminQuickFill}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-600">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                    <span className="text-[9px] block text-slate-400 font-sans font-medium">{t.auth.demoUserLabel}</span>
                    <span className="font-bold text-slate-800">sys_admin</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                    <span className="text-[9px] block text-slate-400 font-sans font-medium">{t.auth.demoPassLabel}</span>
                    <span className="font-bold text-slate-800">AdminEasyEA2026!</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
