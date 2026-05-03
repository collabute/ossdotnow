'use client';

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { type ComponentProps, type FormEvent, useReducer } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Icons from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/lib/auth-client';
import { providers, type ProviderId } from '@/lib/constants';
import { cn } from '@/lib/utils';

export type AuthMode =
  | 'sign-in'
  | 'sign-up'
  | 'forgot-password'
  | 'reset-password'
  | 'verification-sent';

type SentEmailKind = 'verification' | 'password-reset';
type SubmitAction = ProviderId | 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password' | 'resend-verification';

interface AuthState {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  submittedEmail: string;
  sentEmailKind: SentEmailKind;
  resetToken?: string;
  error?: string;
  info?: string;
  submitting: SubmitAction | null;
}

type AuthAction =
  | { type: 'field'; field: 'name' | 'email' | 'password' | 'confirmPassword'; value: string }
  | { type: 'mode'; mode: AuthMode; resetToken?: string }
  | { type: 'start'; action: SubmitAction }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }
  | { type: 'sent'; email: string; kind: SentEmailKind }
  | { type: 'done' };

interface LoginFormProps extends ComponentProps<'div'> {
  initialMode?: AuthMode;
  resetToken?: string;
  routeError?: string;
  redirectUrl?: string;
}

function routeErrorMessage(error?: string) {
  if (!error) return undefined;

  if (error.toLowerCase().includes('invalid')) {
    return 'This auth link is invalid or expired. Request a new link and try again.';
  }

  return 'Authentication could not be completed. Try again.';
}

function getInitialState(initialMode: AuthMode, resetToken?: string, routeError?: string): AuthState {
  return {
    mode: initialMode,
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    submittedEmail: '',
    sentEmailKind: 'verification',
    resetToken,
    error: routeErrorMessage(routeError),
    submitting: null,
  };
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'field':
      return {
        ...state,
        [action.field]: action.value,
        error: undefined,
        info: undefined,
      };
    case 'mode':
      return {
        ...state,
        mode: action.mode,
        password: '',
        confirmPassword: '',
        resetToken: action.resetToken,
        error: undefined,
        info: undefined,
        submitting: null,
      };
    case 'start':
      return { ...state, submitting: action.action, error: undefined, info: undefined };
    case 'error':
      return { ...state, error: action.message, submitting: null };
    case 'info':
      return { ...state, info: action.message, submitting: null };
    case 'sent':
      return {
        ...state,
        mode: 'verification-sent',
        submittedEmail: action.email,
        sentEmailKind: action.kind,
        password: '',
        confirmPassword: '',
        error: undefined,
        info: undefined,
        submitting: null,
      };
    case 'done':
      return { ...state, submitting: null };
    default:
      return state;
  }
}

function getAppUrl(path: string) {
  if (typeof window === 'undefined') {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: string; code?: string; status?: number };
    return maybeError.message || maybeError.code || fallback;
  }

  return fallback;
}

function isEmailVerificationError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { code?: string; status?: number; message?: string };
  const message = `${maybeError.code ?? ''} ${maybeError.message ?? ''}`.toLowerCase();

  return maybeError.status === 403 || message.includes('verify') || message.includes('not_verified');
}

function validateEmail(email: string) {
  if (!email.trim()) return 'Enter your email address.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.';
  return undefined;
}

function validatePassword(password: string) {
  if (!password) return 'Enter your password.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return undefined;
}

export function LoginForm({
  className,
  redirectUrl = '/dashboard',
  initialMode = 'sign-in',
  resetToken,
  routeError,
  ...props
}: LoginFormProps) {
  const navigate = useNavigate({ from: '/login' });
  const [state, dispatch] = useReducer(
    authReducer,
    getInitialState(initialMode, resetToken, routeError),
  );
  const isSubmitting = state.submitting !== null;

  const setMode = (mode: AuthMode, nextResetToken?: string) => {
    dispatch({ type: 'mode', mode, resetToken: nextResetToken });
    void navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        mode: mode === 'sign-in' ? undefined : mode,
        token: nextResetToken,
        error: undefined,
      }),
    });
  };

  const authCallbackUrl = () => getAppUrl(redirectUrl);
  const resetCallbackUrl = () => getAppUrl('/login?mode=reset-password');

  const redirectAfterAuth = (url?: string | null) => {
    window.location.href = url || authCallbackUrl();
  };

  const signInWithProvider = async (providerId: ProviderId) => {
    const provider = providers.find((candidate) => candidate.providerId === providerId);
    const toastId = toast.loading(`Redirecting to ${provider?.name ?? providerId}...`);
    dispatch({ type: 'start', action: providerId });

    const { error } = await authClient.signIn.social({
      provider: providerId,
      callbackURL: authCallbackUrl(),
      errorCallbackURL: getAppUrl('/login'),
    });

    toast.dismiss(toastId);

    if (error) {
      dispatch({
        type: 'error',
        message: getAuthErrorMessage(error, `Could not continue with ${provider?.name ?? providerId}.`),
      });
      return;
    }

    dispatch({ type: 'done' });
  };

  const submitEmailSignIn = async () => {
    const emailError = validateEmail(state.email);
    const passwordError = validatePassword(state.password);

    if (emailError || passwordError) {
      dispatch({ type: 'error', message: emailError ?? passwordError ?? 'Check your details.' });
      return;
    }

    dispatch({ type: 'start', action: 'sign-in' });

    const { data, error } = await authClient.signIn.email({
      email: state.email,
      password: state.password,
      callbackURL: authCallbackUrl(),
      rememberMe: true,
    });

    if (error) {
      if (isEmailVerificationError(error)) {
        dispatch({ type: 'sent', email: state.email, kind: 'verification' });
        toast.message('Verification email sent');
        return;
      }

      dispatch({ type: 'error', message: getAuthErrorMessage(error, 'Could not sign in.') });
      return;
    }

    toast.success('Signed in');
    redirectAfterAuth(data?.url);
  };

  const submitEmailSignUp = async () => {
    const emailError = validateEmail(state.email);
    const passwordError = validatePassword(state.password);

    if (!state.name.trim()) {
      dispatch({ type: 'error', message: 'Enter your name.' });
      return;
    }

    if (emailError || passwordError) {
      dispatch({ type: 'error', message: emailError ?? passwordError ?? 'Check your details.' });
      return;
    }

    dispatch({ type: 'start', action: 'sign-up' });

    const { data, error } = await authClient.signUp.email({
      name: state.name,
      email: state.email,
      password: state.password,
      callbackURL: authCallbackUrl(),
    });

    if (error) {
      dispatch({ type: 'error', message: getAuthErrorMessage(error, 'Could not create account.') });
      return;
    }

    if (data?.token) {
      toast.success('Account created');
      redirectAfterAuth(authCallbackUrl());
      return;
    }

    dispatch({ type: 'sent', email: state.email, kind: 'verification' });
  };

  const submitForgotPassword = async () => {
    const emailError = validateEmail(state.email);

    if (emailError) {
      dispatch({ type: 'error', message: emailError });
      return;
    }

    dispatch({ type: 'start', action: 'forgot-password' });

    const { error } = await authClient.requestPasswordReset({
      email: state.email,
      redirectTo: resetCallbackUrl(),
    });

    if (error) {
      dispatch({ type: 'error', message: getAuthErrorMessage(error, 'Could not send reset email.') });
      return;
    }

    dispatch({ type: 'sent', email: state.email, kind: 'password-reset' });
  };

  const submitResetPassword = async () => {
    const passwordError = validatePassword(state.password);

    if (!state.resetToken) {
      dispatch({ type: 'error', message: 'This reset link is missing a token. Request a new link.' });
      return;
    }

    if (passwordError) {
      dispatch({ type: 'error', message: passwordError });
      return;
    }

    if (state.password !== state.confirmPassword) {
      dispatch({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    dispatch({ type: 'start', action: 'reset-password' });

    const { error } = await authClient.resetPassword({
      newPassword: state.password,
      token: state.resetToken,
    });

    if (error) {
      dispatch({ type: 'error', message: getAuthErrorMessage(error, 'Could not reset password.') });
      return;
    }

    setMode('sign-in');
    dispatch({ type: 'info', message: 'Password reset. Sign in with your new password.' });
  };

  const resendVerificationEmail = async () => {
    if (!state.submittedEmail) {
      dispatch({ type: 'error', message: 'Enter your email address and try again.' });
      return;
    }

    dispatch({ type: 'start', action: 'resend-verification' });

    const { error } = await authClient.sendVerificationEmail({
      email: state.submittedEmail,
      callbackURL: authCallbackUrl(),
    });

    if (error) {
      dispatch({
        type: 'error',
        message: getAuthErrorMessage(error, 'Could not resend verification email.'),
      });
      return;
    }

    dispatch({ type: 'info', message: 'Verification email sent again.' });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (state.mode === 'sign-in') void submitEmailSignIn();
    if (state.mode === 'sign-up') void submitEmailSignUp();
    if (state.mode === 'forgot-password') void submitForgotPassword();
    if (state.mode === 'reset-password') void submitResetPassword();
  };

  const activeSocialProvider = state.submitting === 'github' ? state.submitting : null;

  return (
    <div
      className={cn('z-10 flex w-full max-w-sm flex-col items-center gap-5', className)}
      {...props}
    >
      <div className="flex w-full flex-col gap-2">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const isActiveProvider = activeSocialProvider === provider.providerId;

          return (
            <Button
              key={provider.providerId}
              type="button"
              className="border-border h-10 rounded-none border text-base transition-all"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => signInWithProvider(provider.providerId)}
            >
              {isActiveProvider ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className={cn('h-4 w-4', provider.providerId === 'github' && 'fill-white')} />
              )}
              Continue with {provider.name}
            </Button>
          );
        })}
      </div>

      <div className="flex w-full items-center gap-3 text-xs uppercase text-[#71717a]">
        <span className="bg-border h-px flex-1" />
        <span>Email</span>
        <span className="bg-border h-px flex-1" />
      </div>

      {(state.mode === 'sign-in' || state.mode === 'sign-up') && (
        <Tabs
          value={state.mode}
          onValueChange={(value) => setMode(value as AuthMode)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-none">
            <TabsTrigger value="sign-in" className="rounded-none">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="sign-up" className="rounded-none">
              Create account
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {state.mode !== 'sign-in' && state.mode !== 'sign-up' && (
        <Button
          type="button"
          variant="ghost"
          className="self-start rounded-none px-0 text-[#a1a1aa]"
          disabled={isSubmitting}
          onClick={() => setMode('sign-in')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Button>
      )}

      {state.error && (
        <Alert variant="destructive" className="rounded-none">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Auth failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.info && (
        <Alert className="rounded-none">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{state.info}</AlertDescription>
        </Alert>
      )}

      {state.mode === 'verification-sent' ? (
        <div className="border-border w-full space-y-4 border p-4 text-left">
          <CheckCircle2 className="h-5 w-5" />
          <div className="space-y-2">
            <h2 className="text-lg font-medium">
              {state.sentEmailKind === 'verification' ? 'Check your email' : 'Reset link sent'}
            </h2>
            <p className="text-muted-foreground text-sm leading-6">
              {state.sentEmailKind === 'verification'
                ? `We sent a verification link to ${state.submittedEmail || 'your email'}. Verify it to continue.`
                : `We sent a password reset link to ${state.submittedEmail || 'your email'}.`}
            </p>
          </div>
          {state.sentEmailKind === 'verification' && (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-none"
              disabled={isSubmitting}
              onClick={resendVerificationEmail}
            >
              {state.submitting === 'resend-verification' && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Resend verification
            </Button>
          )}
        </div>
      ) : (
        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          {state.mode === 'sign-up' && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={state.name}
                disabled={isSubmitting}
                autoComplete="name"
                onChange={(event) =>
                  dispatch({ type: 'field', field: 'name', value: event.target.value })
                }
              />
            </div>
          )}

          {(state.mode === 'sign-in' ||
            state.mode === 'sign-up' ||
            state.mode === 'forgot-password') && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={state.email}
                disabled={isSubmitting}
                autoComplete="email"
                onChange={(event) =>
                  dispatch({ type: 'field', field: 'email', value: event.target.value })
                }
              />
            </div>
          )}

          {(state.mode === 'sign-in' || state.mode === 'sign-up' || state.mode === 'reset-password') && (
            <div className="space-y-2">
              <Label htmlFor="password">
                {state.mode === 'reset-password' ? 'New password' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                value={state.password}
                disabled={isSubmitting}
                autoComplete={state.mode === 'sign-in' ? 'current-password' : 'new-password'}
                onChange={(event) =>
                  dispatch({ type: 'field', field: 'password', value: event.target.value })
                }
              />
            </div>
          )}

          {state.mode === 'reset-password' && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={state.confirmPassword}
                disabled={isSubmitting}
                autoComplete="new-password"
                onChange={(event) =>
                  dispatch({
                    type: 'field',
                    field: 'confirmPassword',
                    value: event.target.value,
                  })
                }
              />
            </div>
          )}

          <Button type="submit" className="w-full rounded-none" disabled={isSubmitting}>
            {isSubmitting && !activeSocialProvider && <Loader2 className="h-4 w-4 animate-spin" />}
            {state.mode === 'sign-in' && 'Sign in'}
            {state.mode === 'sign-up' && 'Create account'}
            {state.mode === 'forgot-password' && 'Send reset link'}
            {state.mode === 'reset-password' && 'Reset password'}
          </Button>

          {state.mode === 'sign-in' && (
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-none text-[#a1a1aa]"
              disabled={isSubmitting}
              onClick={() => setMode('forgot-password')}
            >
              Forgot password?
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
