'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  MailWarning,
  MonitorSmartphone,
  ShieldCheck,
  Unlink,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Icons from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { accountTypes } from '@/lib/project-options';
import type { RouterOutputs } from '@/lib/api-types';
import { useTRPC } from '@/hooks/use-trpc';

type AccountType = (typeof accountTypes)[number];
type ManageableProviderId = 'github' | 'email-password';
type AccountSecurity = RouterOutputs['user']['getAccountSecurity'];
type ConnectedAccount = AccountSecurity['accounts'][number];

const providerOrder: ManageableProviderId[] = ['github', 'email-password'];

const providerCopy: Record<
  ManageableProviderId,
  {
    label: string;
    description: string;
    disconnectWarning: string;
  }
> = {
  github: {
    label: 'GitHub',
    description: 'Required for repository ownership checks, project claims, and better autofill.',
    disconnectWarning:
      'Repository ownership checks and unclaimed project claims will stop working until GitHub is connected again.',
  },
  'email-password': {
    label: 'Email/password',
    description: 'Use verified email and password recovery as a direct sign-in method.',
    disconnectWarning: 'Password sign-in and password reset will be unavailable for this account.',
  },
};

const accountTypeCopy: Record<AccountType, string> = {
  owner: 'Submit and manage projects.',
  contributor: 'Find projects to contribute to.',
  investor: 'Discover projects seeking growth.',
};

export function Profile() {
  const trpc = useTRPC();
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<ManageableProviderId | null>(
    null,
  );
  const [providerToDisconnect, setProviderToDisconnect] =
    useState<ManageableProviderId | null>(null);
  const [accountTypeToConfirm, setAccountTypeToConfirm] = useState<
    'contributor' | 'investor' | null
  >(null);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);

  const me = useQuery(trpc.user.me.queryOptions());
  const security = useQuery(trpc.user.getAccountSecurity.queryOptions());
  const myProjects = useQuery({
    ...trpc.projects.getMyProjects.queryOptions(),
    enabled: (security.data?.user.accountType ?? me.data?.accountType) === 'owner',
  });
  const providerStatus = useQuery(trpc.system.providerStatus.queryOptions());

  const profileUser = security.data?.user ?? me.data;
  const accountsByProvider = useMemo(() => {
    return new Map(
      (security.data?.accounts ?? []).map((account: any) => [
        account.providerId as ManageableProviderId,
        account,
      ]),
    );
  }, [security.data?.accounts]);
  const connectedProviderCount = security.data?.accounts.length ?? 0;
  const ownerProjectCount = myProjects.data?.length ?? 0;
  const profileUserId = profileUser?.id;
  const profileUserName = profileUser?.name;
  const profileUserImage = profileUser?.image;

  useEffect(() => {
    if (!profileUserId) return;

    setName(profileUserName ?? '');
    setImage(profileUserImage ?? '');
  }, [profileUserId, profileUserName, profileUserImage]);

  const updateProfile = useMutation({
    ...trpc.user.updateProfile.mutationOptions(),
    onSuccess: async () => {
      toast.success('Profile saved');
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.user.getAccountSecurity.queryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not save profile');
    },
  });
  const updateAccountType = useMutation({
    ...trpc.user.updateAccountType.mutationOptions(),
    onSuccess: async () => {
      toast.success('Account type updated');
      setAccountTypeToConfirm(null);
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.user.getAccountSecurity.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.projects.getMyProjects.queryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not update account type');
    },
  });
  const disconnectProvider = useMutation({
    ...trpc.user.disconnectProvider.mutationOptions(),
    onSuccess: async (data) => {
      const disconnectedProvider = data.disconnectedProvider as ManageableProviderId;
      toast.success(`${providerCopy[disconnectedProvider].label} disconnected`);
      setProviderToDisconnect(null);
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.user.getAccountSecurity.queryKey() });
      await router.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not disconnect provider');
    },
  });
  const signOutEverywhere = useMutation({
    ...trpc.user.signOutEverywhere.mutationOptions(),
    onSuccess: async () => {
      await finishSignOut();
    },
    onError: (error) => {
      toast.error(error.message || 'Could not sign out all sessions');
    },
  });

  async function finishSignOut() {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
    } catch {
      // The server session may already be revoked by sign-out everywhere.
    }
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  async function connectProvider(providerId: 'github') {
    const isConfigured = providerStatus.data?.github.oauthConfigured ?? true;

    if (!isConfigured) {
      toast.error(`${providerCopy[providerId].label} OAuth is not configured for this environment.`);
      return;
    }

    setConnectingProvider(providerId);
    const callbackURL = getAppUrl('/profile');
    const { error } = await authClient.linkSocial({
      provider: providerId,
      callbackURL,
      errorCallbackURL: callbackURL,
    });

    if (error) {
      toast.error(error.message || `Could not connect ${providerCopy[providerId].label}`);
      setConnectingProvider(null);
    }
  }

  async function sendVerificationEmail() {
    if (!profileUser?.email) return;

    setIsSendingVerification(true);
    const { error } = await authClient.sendVerificationEmail({
      email: profileUser.email,
      callbackURL: getAppUrl('/profile'),
    });
    setIsSendingVerification(false);

    if (error) {
      toast.error(error.message || 'Could not send verification email');
      return;
    }

    toast.success('Verification email sent');
  }

  async function sendPasswordReset() {
    if (!profileUser?.email) return;

    setIsSendingPasswordReset(true);
    const { error } = await authClient.requestPasswordReset({
      email: profileUser.email,
      redirectTo: getAppUrl('/login?mode=reset-password'),
    });
    setIsSendingPasswordReset(false);

    if (error) {
      toast.error(error.message || 'Could not send password reset email');
      return;
    }

    toast.success('Password reset email sent');
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedImage = image.trim();

    if (!trimmedName) {
      toast.error('Name is required');
      return;
    }

    updateProfile.mutate({
      name: trimmedName,
      image: trimmedImage || undefined,
    });
  }

  function requestAccountTypeChange(accountType: AccountType) {
    if (
      profileUser?.accountType === 'owner' &&
      accountType !== 'owner' &&
      ownerProjectCount > 0
    ) {
      setAccountTypeToConfirm(accountType);
      return;
    }

    updateAccountType.mutate({ accountType });
  }

  if (me.isPending || security.isPending) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="mx-auto max-w-6xl border border-border p-6">
        <h1 className="text-2xl font-medium">Profile unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Refresh the page or sign in again to load account settings.
        </p>
      </div>
    );
  }

  const currentAccountType = profileUser.accountType as AccountType | null;
  const emailPasswordAccount = accountsByProvider.get('email-password');
  const isEmailVerified = Boolean(profileUser.emailVerified);
  const isProfileDirty =
    name.trim() !== (profileUser.name ?? '') || image.trim() !== (profileUser.image ?? '');

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-8">
      <section className="border border-border p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-16 w-16 border border-border">
              {profileUser.image ? <AvatarImage src={profileUser.image} alt={profileUser.name} /> : null}
              <AvatarFallback className="text-lg">{getInitials(profileUser.name, profileUser.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-muted-foreground text-sm">Account settings</p>
              <h1 className="truncate text-3xl font-medium">{profileUser.name}</h1>
              <p className="text-muted-foreground mt-1 truncate text-sm">{profileUser.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-none capitalize">
              {currentAccountType ?? 'No account type'}
            </Badge>
            <Badge variant="outline" className="rounded-none capitalize">
              {profileUser.role}
            </Badge>
            <Badge variant={isEmailVerified ? 'secondary' : 'outline'} className="rounded-none">
              {isEmailVerified ? 'Verified email' : 'Unverified email'}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <form className="border border-border p-5" onSubmit={saveProfile}>
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5" />
            <h2 className="text-xl font-medium">Profile</h2>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Better Auth lets this app update your display name and avatar URL. Email changes stay
            locked to connected providers for now.
          </p>
          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={updateProfile.isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" value={profileUser.email} disabled readOnly />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-image">Image URL</Label>
              <Input
                id="profile-image"
                value={image}
                placeholder="https://..."
                onChange={(event) => setImage(event.target.value)}
                disabled={updateProfile.isPending}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="mt-5 rounded-none"
            disabled={updateProfile.isPending || !isProfileDirty}
          >
            {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save profile
          </Button>
        </form>

        <section className="border border-border p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-xl font-medium">Account type</h2>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Your account type controls dashboard workflows. Admin role permissions stay separate.
          </p>
          <div className="mt-5 grid gap-3">
            {accountTypes.map((accountType) => (
              <button
                key={accountType}
                type="button"
                disabled={updateAccountType.isPending || currentAccountType === accountType}
                onClick={() => requestAccountTypeChange(accountType)}
                className="flex min-w-0 items-center justify-between gap-4 border border-border p-4 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block font-medium capitalize">{accountType}</span>
                  <span className="text-muted-foreground mt-1 block text-sm">
                    {accountTypeCopy[accountType]}
                  </span>
                </span>
                {currentAccountType === accountType ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                ) : null}
              </button>
            ))}
          </div>
        </section>
      </section>

      <section className="border border-border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-medium">Connected accounts</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Keep at least one sign-in method connected. GitHub is required for repository
              ownership and claims.
            </p>
          </div>
          {!accountsByProvider.has('github') ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit shrink-0 rounded-none"
              disabled={connectingProvider === 'github'}
              onClick={() => connectProvider('github')}
            >
              {connectingProvider === 'github' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.github className="h-4 w-4 fill-current" />
              )}
              Connect GitHub
            </Button>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3">
          {providerOrder.map((providerId) => (
            <ProviderRow
              key={providerId}
              providerId={providerId}
              account={accountsByProvider.get(providerId)}
              connectedProviderCount={connectedProviderCount}
              isConnecting={connectingProvider === providerId}
              isDisconnecting={
                disconnectProvider.isPending && providerToDisconnect === providerId
              }
              isOAuthConfigured={
                providerId === 'github'
                  ? (providerStatus.data?.github.oauthConfigured ?? true)
                  : true
              }
              onConnect={
                providerId === 'email-password'
                  ? undefined
                  : () => connectProvider(providerId)
              }
              onDisconnect={() => setProviderToDisconnect(providerId)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1fr]">
        <section className="border border-border p-5">
          <div className="flex items-center gap-2">
            {isEmailVerified ? (
              <MailCheck className="h-5 w-5" />
            ) : (
              <MailWarning className="h-5 w-5" />
            )}
            <h2 className="text-xl font-medium">Email and password</h2>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Verification and password recovery are sent to {profileUser.email}.
          </p>
          <div className="mt-5 space-y-3">
            <Alert className="rounded-none bg-transparent">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {isEmailVerified ? 'Email verified' : 'Email verification required'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {isEmailVerified
                      ? 'This email is verified for account notifications and password recovery.'
                      : 'Verify this email before relying on email/password sign-in.'}
                  </p>
                </div>
                {!isEmailVerified ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit shrink-0 rounded-none"
                    disabled={isSendingVerification}
                    onClick={sendVerificationEmail}
                  >
                    {isSendingVerification ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Resend email
                  </Button>
                ) : null}
              </div>
            </Alert>
            {emailPasswordAccount ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                disabled={isSendingPasswordReset}
                onClick={sendPasswordReset}
              >
                {isSendingPasswordReset ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send password reset email
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">
                Email/password is not connected yet. Use sign up with email on the login page if
                you want direct password access.
              </p>
            )}
          </div>
        </section>

        <section className="border border-border p-5">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5" />
            <h2 className="text-xl font-medium">Sessions</h2>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Active sessions for this account. Sign out everywhere revokes every session.
          </p>
          <div className="mt-5 space-y-3">
            {(security.data?.sessions ?? []).map((session: any) => (
              <div
                key={session.id}
                className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{session.isCurrent ? 'Current session' : 'Session'}</p>
                    {session.isCurrent ? (
                      <Badge variant="secondary" className="rounded-none">
                        Current
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-2 break-words text-sm">
                    {session.userAgent || 'Unknown device'}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    IP {session.ipAddress || 'unknown'} · Updated {formatDate(session.updatedAt)} ·
                    Expires {formatDate(session.expiresAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={isSigningOut}
              onClick={finishSignOut}
            >
              {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign out
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={signOutEverywhere.isPending || isSigningOut}
              onClick={() => signOutEverywhere.mutate()}
            >
              {signOutEverywhere.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign out everywhere
            </Button>
          </div>
        </section>
      </section>

      <Dialog
        open={Boolean(providerToDisconnect)}
        onOpenChange={(open) => {
          if (!open && !disconnectProvider.isPending) {
            setProviderToDisconnect(null);
          }
        }}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>
              Disconnect {providerToDisconnect ? providerCopy[providerToDisconnect].label : 'provider'}?
            </DialogTitle>
            <DialogDescription>
              {providerToDisconnect
                ? providerCopy[providerToDisconnect].disconnectWarning
                : null}{' '}
              You must keep at least one sign-in method connected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={disconnectProvider.isPending}
              onClick={() => setProviderToDisconnect(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-none"
              disabled={!providerToDisconnect || disconnectProvider.isPending}
              onClick={() => {
                if (providerToDisconnect) {
                  disconnectProvider.mutate({ providerId: providerToDisconnect });
                }
              }}
            >
              {disconnectProvider.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(accountTypeToConfirm)}
        onOpenChange={(open) => {
          if (!open && !updateAccountType.isPending) {
            setAccountTypeToConfirm(null);
          }
        }}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Switch away from owner?</DialogTitle>
            <DialogDescription>
              You have {ownerProjectCount} owner project
              {ownerProjectCount === 1 ? '' : 's'}. Switching to {accountTypeToConfirm} hides
              project management until you switch back, but owned project records stay intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={updateAccountType.isPending}
              onClick={() => setAccountTypeToConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={updateAccountType.isPending || !accountTypeToConfirm}
              onClick={() => {
                if (accountTypeToConfirm) {
                  updateAccountType.mutate({
                    accountType: accountTypeToConfirm,
                    confirmOwnerProjectVisibility: true,
                  });
                }
              }}
            >
              {updateAccountType.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProviderRow({
  providerId,
  account,
  connectedProviderCount,
  isConnecting,
  isDisconnecting,
  isOAuthConfigured,
  onConnect,
  onDisconnect,
}: {
  providerId: ManageableProviderId;
  account: ConnectedAccount | undefined;
  connectedProviderCount: number;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isOAuthConfigured: boolean;
  onConnect?: () => void;
  onDisconnect: () => void;
}) {
  const connected = Boolean(account);
  const canDisconnect = connected && connectedProviderCount > 1;
  const copy = providerCopy[providerId];

  return (
    <div className="flex flex-col gap-4 border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <ProviderIcon providerId={providerId} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{copy.label}</p>
            <Badge variant={connected ? 'secondary' : 'outline'} className="rounded-none">
              {connected ? 'Connected' : 'Not connected'}
            </Badge>
            {!isOAuthConfigured ? (
              <Badge variant="outline" className="rounded-none">
                Not configured
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm leading-6">{copy.description}</p>
          {account ? (
            <p className="text-muted-foreground mt-1 break-words text-xs">
              Connected {formatDate(account.createdAt)}
              {account.scope ? ` · Scope ${account.scope}` : ''}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {connected ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={!canDisconnect || isDisconnecting}
            onClick={onDisconnect}
            title={!canDisconnect ? 'Connect another sign-in method first.' : undefined}
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4" />
            )}
            Disconnect
          </Button>
        ) : onConnect ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={isConnecting || !isOAuthConfigured}
            onClick={onConnect}
          >
            {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ProviderButtonIcon providerId={providerId} />}
            Connect {copy.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ProviderIcon({ providerId }: { providerId: ManageableProviderId }) {
  if (providerId === 'github') {
    return <Icons.github className="mt-0.5 h-5 w-5 shrink-0 fill-current" />;
  }

  return <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />;
}

function ProviderButtonIcon({ providerId }: { providerId: ManageableProviderId }) {
  if (providerId === 'github') {
    return <Icons.github className="h-4 w-4 fill-current" />;
  }

  return <KeyRound className="h-4 w-4" />;
}

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || 'User';
  const parts = source.split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'U';
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return 'Unknown';

  return new Date(value).toLocaleString();
}

function getAppUrl(path: string) {
  if (typeof window === 'undefined') return path;

  return new URL(path, window.location.origin).toString();
}
