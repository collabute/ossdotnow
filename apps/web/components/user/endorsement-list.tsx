'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { Building2, Briefcase, Calendar, Folder } from 'lucide-react';
import { Card, CardContent } from '@workspace/ui/components/card';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { Button } from '@workspace/ui/components/button';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useTRPC } from '@/hooks/use-trpc';
import Link from 'next/link';

interface EndorsementListProps {
  userId: string;
}

export function EndorsementList({ userId }: EndorsementListProps) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.endorsements.getEndorsements.queryOptions({
      userId,
      limit: 20,
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="rounded-none border-neutral-800 bg-neutral-900">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data?.endorsements.length) {
    return (
      <div className="p-6 text-center text-neutral-400">
        <p className="text-neutral-400">No endorsements yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.endorsements.map((endorsement) => (
        <Card key={endorsement.id} className="rounded-none border-neutral-800 bg-neutral-900/50">
          <CardContent className="px-6">
            <div className="flex gap-4">
              <Link href={`/profile/${endorsement.endorser.id}`}>
                <Avatar className="h-12 w-12">
                  <AvatarImage src={endorsement.endorser.image} />
                  <AvatarFallback>{endorsement.endorser.name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <Link
                      href={`/profile/${endorsement.endorser.id}`}
                      className="font-medium text-white hover:underline"
                    >
                      {endorsement.endorser.name}
                    </Link>
                    <p className="text-sm text-neutral-400">
                      @{endorsement.endorser.username ?? ''}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {formatDistanceToNow(new Date(endorsement.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                {endorsement.type === 'project' &&
                  (endorsement.project || endorsement.projectName) && (
                    <div className="mt-2">
                      {endorsement.project ? (
                        <Link
                          href={`/projects/${endorsement.project.id}`}
                          className="inline-flex items-center gap-2 rounded-sm bg-neutral-800 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-700"
                        >
                          <Folder className="h-3 w-3" />
                          {endorsement.project.name}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-sm bg-neutral-800 px-3 py-1 text-sm text-neutral-300">
                          <Folder className="h-3 w-3" />
                          {endorsement.projectName}
                        </span>
                      )}
                    </div>
                  )}

                {endorsement.type === 'work' && endorsement.workDetails && (
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-400">
                    {endorsement.workDetails.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {endorsement.workDetails.company}
                      </span>
                    )}
                    {endorsement.workDetails.role && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {endorsement.workDetails.role}
                      </span>
                    )}
                    {(endorsement.workDetails.startDate || endorsement.workDetails.endDate) && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {endorsement.workDetails.startDate} -{' '}
                        {endorsement.workDetails.endDate || 'Present'}
                      </span>
                    )}
                  </div>
                )}

                <p className="mt-3 whitespace-pre-wrap text-neutral-300">{endorsement.content}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {Number(data.total) > data.endorsements.length && (
        <div className="text-center">
          <Button variant="outline" className="rounded-none">
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
