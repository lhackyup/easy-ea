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
  const { login, completeMfaLogin, authError, clearAuthError } = useAuth();
  const { t, interpolate, language, setLanguage } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MFA / 2FA Challenge State
  const [mfaChallenge, setMfaChallenge] = useState<any | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  // OIDC Configuration State
  const [oidcConfig, setOidcConfig] = useState<{
    enabled: boolean;
    provider_name: string;
    login_url: string;
    allow_local_login?: boolean;
    allow_idp_login?: boolean;
    demo_mode?: boolean;
    show_demo_banner?: boolean;
    demo_banner_message?: string;
    demo_username?: string;
    demo_password?: string;
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
      const res = await login(username.trim(), password);
      if (res?.mfa_required) {
        setMfaChallenge(res);
        setTotpCode('');
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || t.auth.loginError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || !totpCode.trim()) return;

    setMfaSubmitting(true);
    setError(null);
    clearAuthError();
    try {
      const data = await api.loginMfa({
        mfa_token: mfaChallenge.mfa_token,
        totp_code: totpCode.trim()
      });
      completeMfaLogin(data);
    } catch (err: any) {
      setError(err.message || 'Codice TOTP non valido');
    } finally {
      setMfaSubmitting(false);
    }
  };

  const cancelMfa = () => {
    setMfaChallenge(null);
    setTotpCode('');
    setError(null);
  };

  const handleSsoLogin = () => {
    setOidcLoading(true);
    clearAuthError();
    // Redirect browser to backend OIDC login endpoint
    window.location.href = oidcConfig?.login_url || '/api/auth/oidc/login';
  };

  const fillDemo = () => {
    setUsername(oidcConfig?.demo_username || 'demo');
    setPassword(oidcConfig?.demo_password || 'EasyEA2026!');
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

        {/* Dynamic Card: MFA Step vs Initial Login */}
        {mfaChallenge ? (
          <div className="mt-8 bg-white py-8 px-6 shadow-xl shadow-slate-200/60 sm:rounded-2xl border border-slate-200/80 sm:px-10 space-y-6">
            <div className="border-b border-slate-100 pb-4 text-center">
              <div className="inline-flex items-center justify-center p-2.5 bg-rose-50 border border-rose-200 rounded-xl mb-2 text-rose-600">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {mfaChallenge.mfa_setup_required ? t.auth.mfaSetupTitle : t.auth.mfaTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {mfaChallenge.mfa_setup_required
                  ? t.auth.mfaSetupSubtitle
                  : interpolate(t.auth.mfaSubtitle, { username: mfaChallenge.user?.username || username })}
              </p>
            </div>

            {displayError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{displayError}</span>
              </div>
            )}

            {/* If setup required, render QR code and secret */}
            {mfaChallenge.mfa_setup_required && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-xs max-w-[220px] mx-auto">
                  <img
                    src={
                      mfaChallenge.qr_code_data_url ||
                      (mfaChallenge.qr_code_svg?.startsWith('data:')
                        ? mfaChallenge.qr_code_svg
                        : `data:image/svg+xml;utf8,${encodeURIComponent(mfaChallenge.qr_code_svg || '')}`)
                    }
                    alt="EasyEA 2FA QR Code"
                    className="w-48 h-48 object-contain mx-auto"
                  />
                </div>
                <div className="text-center">
                  <span className="text-[11px] text-slate-500 block mb-1 font-medium">{t.auth.mfaSecretLabel}</span>
                  <code className="text-xs font-mono font-bold bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 select-all tracking-wider inline-block">
                    {mfaChallenge.secret}
                  </code>
                </div>
              </div>
            )}

            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 text-center mb-1.5">
                  {t.auth.mfaInputLabel}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={t.auth.mfaInputPlaceholder}
                  className="block w-full py-2.5 text-center font-mono font-bold text-2xl tracking-[0.4em] border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 placeholder:text-slate-300 transition"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={mfaSubmitting || totpCode.length < 6}
                  className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {mfaSubmitting ? t.auth.mfaVerifying : t.auth.mfaVerifyBtn}
                </button>

                <button
                  type="button"
                  onClick={cancelMfa}
                  className="w-full flex justify-center items-center py-2 px-4 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                >
                  {t.auth.mfaBackToLogin}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Standard Login Card */
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

            {/* Demo Credentials Banner */}
            {oidcConfig?.show_demo_banner !== false && (
              <div className="p-4 bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 border border-cyan-200 rounded-2xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-cyan-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                      👁️
                    </span>
                    <span className="text-xs font-extrabold text-cyan-950 uppercase tracking-wide">
                      {t.auth.demoBannerTitle}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan-100/90 text-cyan-800 rounded-md border border-cyan-200">
                    {t.auth.demoCredentialsBadge}
                  </span>
                </div>

                <p className="text-xs text-cyan-900 leading-relaxed font-medium">
                  {oidcConfig?.demo_banner_message || t.auth.demoBannerDesc}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-cyan-100">
                  <div className="flex items-center space-x-2 text-[11px] font-mono">
                    <span className="bg-white/95 px-2 py-0.5 rounded-md border border-cyan-200 text-cyan-900 shadow-3xs">
                      user: <strong className="text-cyan-950 font-bold">{oidcConfig?.demo_username || 'demo'}</strong>
                    </span>
                    <span className="bg-white/95 px-2 py-0.5 rounded-md border border-cyan-200 text-cyan-900 shadow-3xs">
                      pwd: <strong className="text-cyan-950 font-bold">{oidcConfig?.demo_password || 'EasyEA2026!'}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={fillDemo}
                    className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyan-800 bg-white hover:bg-cyan-100/70 active:bg-cyan-200/50 px-3 py-1 rounded-xl border border-cyan-300 shadow-2xs transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                    <span>{t.auth.demoFillBtn}</span>
                  </button>
                </div>
              </div>
            )}

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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
