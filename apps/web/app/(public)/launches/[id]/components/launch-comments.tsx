'use client';

import { MessageCircle } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@workspace/auth/client';
import Link from '@workspace/ui/components/link';
import CommentThread from '@/components/comments/comment-thread';
import ReplyForm from '@/components/comments/reply-form';




interface LaunchCommentsProps {
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  comments: any[];
  commentsLoading: boolean;
}

export default function LaunchComments({
  projectId,
  comments,
  commentsLoading,
}: LaunchCommentsProps) {
  const { data: session } = authClient.useSession();

  return (
    <div className="border border-neutral-800 bg-neutral-900/50 p-6">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-white">
        <MessageCircle className="h-5 w-5" />
        Comments ({comments?.length || 0})
      </h2>

      {/* Comments Thread */}
      <div className="mb-8">
        <CommentThread
          projectId={projectId}
          comments={comments || []}
          commentsLoading={commentsLoading}
        />
      </div>

      {/* Comment Form */}
      {session?.user && (
        <ReplyForm
          projectId={projectId}
          placeholder="Add your comment..."
          className="w-full"
        />
      )}

      {!session?.user && (
        <div className="mt-6 rounded-none border border-neutral-800 bg-neutral-800/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-neutral-300">Login to join the conversation.</p>
            <Button asChild>
              <Link href={`/login?redirect=/launches/${projectId}`} className="rounded-none">
                Login
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
