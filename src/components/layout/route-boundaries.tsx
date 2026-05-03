import type { ErrorComponentProps } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import Link from '@/components/ui/link';
import { cn } from '@/lib/utils';

type RouteBoundaryAction = {
  label: string;
  to: string;
  variant?: 'default' | 'outline';
};

type RouteBoundaryProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: RouteBoundaryAction[];
  className?: string;
};

const defaultActions: RouteBoundaryAction[] = [
  { label: 'Browse projects', to: '/projects' },
  { label: 'Go home', to: '/', variant: 'outline' },
];

export function RouteBoundaryState({
  eyebrow,
  title,
  description,
  actions = defaultActions,
  className,
}: RouteBoundaryProps) {
  return (
    <main
      className={cn(
        'bg-background text-foreground grid min-h-dvh place-items-center px-6 py-20',
        className,
      )}
    >
      <section className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        {eyebrow ? <p className="text-muted-foreground text-sm font-medium">{eyebrow}</p> : null}
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-pretty text-base leading-7">
          {description}
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          {actions.map((action) => (
            <Button key={`${action.to}-${action.label}`} asChild variant={action.variant}>
              <Link href={action.to}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}

export function RouteNotFoundState({
  title = 'Page not found',
  description = 'This page does not exist, or you do not have access to it.',
  actions,
}: Partial<Pick<RouteBoundaryProps, 'title' | 'description' | 'actions'>>) {
  return (
    <RouteBoundaryState
      eyebrow="404"
      title={title}
      description={description}
      actions={actions}
    />
  );
}

export function RouteErrorState({
  error,
  reset,
  title = 'Something went wrong',
  description,
}: ErrorComponentProps & {
  title?: string;
  description?: string;
}) {
  const message =
    description ??
    (error instanceof Error && error.message
      ? error.message
      : 'The app could not load this section. Try again or go back to project discovery.');

  return (
    <main className="bg-background text-foreground grid min-h-dvh place-items-center px-6 py-20">
      <section className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <AlertCircle className="text-muted-foreground h-8 w-8" />
        <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-pretty text-base leading-7">
          {message}
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/projects">Browse projects</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export function RoutePendingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-64 w-full items-center justify-center px-6 py-16">
      <div className="border-border h-8 w-8 animate-spin rounded-full border-2 border-t-foreground" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
