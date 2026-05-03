'use client';

import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/use-trpc';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

export function DebugGitHubPermissions({ repoUrl }: { repoUrl: string }) {
  const [showDebug, setShowDebug] = useState(false);
  const trpc = useTRPC();

  const { data, isLoading, refetch, error } = useQuery({
    ...trpc.projects.debugGitHubPermissions.queryOptions({ repoUrl }),
    enabled: showDebug,
  });

  if (!showDebug) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowDebug(true)} className="mt-2">
        Debug GitHub Permissions
      </Button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">GitHub Permissions Debug</h3>

      {isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm">Checking permissions...</span>
        </div>
      ) : error ? (
        <div className="text-sm text-red-500">
          Error: {error instanceof Error ? error.message : 'Failed to check permissions'}
        </div>
      ) : data ? (
        <div className="w-[428.362px]">
          <pre className="bg-muted max-h-64 overflow-auto rounded p-2 text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowDebug(false)}>
          Hide
        </Button>
      </div>
    </div>
  );
}
