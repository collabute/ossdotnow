'use client';

import { Button } from '@workspace/ui/components/button';
import { authClient } from '@workspace/auth/client';
import { toast } from 'sonner';
import { Reply, Plus, Minus, Heart } from 'lucide-react';

interface CommentActionsProps {
  canReply: boolean;
  hasReplies: boolean;
  totalReplyCount: number;
  isCollapsed: boolean;
  onReplyClick: () => void;
  onToggleCollapse: () => void;
  commentUserName?: string | null;
  likeCount?: number;
  isLiked?: boolean;
  onLikeClick?: () => void;
  isLiking?: boolean;
}

export default function CommentActions({
  canReply,
  hasReplies,
  totalReplyCount,
  isCollapsed,
  onReplyClick,
  onToggleCollapse,
  commentUserName,
  likeCount = 0,
  isLiked = false,
  onLikeClick,
  isLiking = false,
}: CommentActionsProps) {
  const { data: session } = authClient.useSession();

  const handleReplyClick = () => {
    if (!session?.user) {
      toast.error('Please login to reply');
      return;
    }
    onReplyClick();
  };

  const handleLikeClick = () => {
    if (!session?.user) {
      toast.error('Please login to like comments');
      return;
    }
    onLikeClick?.();
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
      {/* Like Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLikeClick}
        disabled={isLiking}
        className={`h-auto p-0 border-0 outline-none focus:outline-none bg-transparent hover:bg-transparent active:bg-transparent shadow-none focus:ring-0 transition-colors ${isLiked
          ? 'text-red-500 hover:text-red-400'
          : 'text-neutral-400 hover:text-white'
          } ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={`${isLiked ? 'Unlike' : 'Like'} this comment`}
      >
        <Heart className={`h-3 w-3 mr-1 ${isLiked ? 'fill-current' : ''}`} />
        {likeCount > 0 && (
          <span className="text-xs">{likeCount}</span>
        )}
      </Button>

      {canReply && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReplyClick}
          className="h-auto p-0 text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-0"
          aria-label={`Reply to ${commentUserName || 'this comment'}`}
        >
          <Reply className="h-3 w-3 mr-1" />
          Reply
        </Button>
      )}

      {hasReplies && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="h-auto p-0 text-neutral-400 hover:text-white transition-colors focus:outline-none focus:ring-0"
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${totalReplyCount} replies`}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <Plus className="h-3 w-3 mr-1" />
          ) : (
            <Minus className="h-3 w-3 mr-1" />
          )}
          <span className="hidden sm:inline">
            {totalReplyCount} {totalReplyCount === 1 ? 'reply' : 'replies'}
          </span>
          <span className="sm:hidden">
            {totalReplyCount}
          </span>
        </Button>
      )}
    </div>
  );
}

