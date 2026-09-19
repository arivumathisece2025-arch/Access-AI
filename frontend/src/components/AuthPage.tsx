import { useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Eye, EyeOff, Lock, LogIn, Mail, Sparkles, User } from 'lucide-react';
import { guest, login, register, type AuthResponse } from '../lib/auth';

interface AuthPageProps {
  onAuth: (response: AuthResponse) => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return fallback;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const strengthTexts = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = mode === 'login'
        ? await login(email, password)
        : await register(email, name, password);
      onAuth(response);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'Authentication failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError('');
    setGuestLoading(true);
    try {
      onAuth(await guest());
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, 'Failed to enter demo mode.'));
      setGuestLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth-container">
        <div className="auth-bg" aria-hidden="true" />
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="auth-header">
            <p className="auth-eyebrow"><Sparkles size={14} aria-hidden="true" /> ACCESSIBILITY, REIMAGINED</p>
            <h1>Access AI</h1>
            <p>See, speak, sign — accessibility without limits.</p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>Sign In</button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(''); }}>Create Account</button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.form
              key={mode}
              onSubmit={handleSubmit}
              className="auth-form"
              initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
              transition={{ duration: 0.3 }}
            >
              {mode === 'signup' && (
                <div className="input-group">
                  <User size={18} className="input-icon" aria-hidden="true" />
                  <label htmlFor="auth-name">Full name</label>
                  <input id="auth-name" type="text" placeholder="Full Name" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
                </div>
              )}
              <div className="input-group">
                <Mail size={18} className="input-icon" aria-hidden="true" />
                <label htmlFor="auth-email">Email address</label>
                <input id="auth-email" type="email" placeholder="Email Address" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </div>
              <div className="input-group">
                <Lock size={18} className="input-icon" aria-hidden="true" />
                <label htmlFor="auth-password">Password</label>
                <input id="auth-password" type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>

              {mode === 'signup' && password.length > 0 && (
                <div className="strength-meter" aria-live="polite">
                  <div className="strength-bars" aria-label={`Password strength: ${strengthTexts[strength]}`}>
                    {[0, 1, 2, 3].map((index) => <div key={index} className={`strength-bar ${index < strength ? `strength-${strength}` : 'strength-empty'}`} />)}
                  </div>
                  <span className="strength-text">{strengthTexts[strength]}</span>
                </div>
              )}

              {error && <div className="auth-error" role="alert">{error}</div>}
              <button type="submit" className="btn-auth-primary" disabled={loading || guestLoading}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                {!loading && <LogIn size={18} aria-hidden="true" />}
              </button>
            </motion.form>
          </AnimatePresence>

          <div className="auth-divider" aria-hidden="true"><span>OR</span></div>
          <button type="button" className="btn-auth-guest" onClick={() => void handleGuest()} disabled={guestLoading || loading}>
            <Sparkles size={18} aria-hidden="true" />
            {guestLoading ? 'Entering Demo...' : 'Enter Demo Mode (No Account)'}
          </button>
          <p className="auth-footer-text">One tap in. No account required for your demo.</p>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
