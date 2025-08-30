'use client';

import { Collapsible, CollapsibleContent } from '@workspace/ui/components/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar';
import { useCommentIndentation } from '@/hooks/use-comment-indentation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useCallback } from 'react';
import CommentActions from './comment-actions';
import { formatDistanceToNow } from 'date-fns';
import { useTRPC } from '@/hooks/use-trpc';
import ReplyForm from './reply-form';

export interface CommentWithReplies {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  replies?: CommentWithReplies[];
  likeCount?: number;
  isLiked?: boolean;
}

interface CommentItemProps {
  comment: CommentWithReplies;
  projectId: string;
  depth?: number;
  maxDepth?: number;
}

interface CommentThreadProps {
  projectId: string;
  comments: CommentWithReplies[];
  commentsLoading: boolean;
}

const MAX_DEPTH = 7;

interface CommentContainerProps {
  depth: number;
  isLast: boolean;
  hasReplies: boolean;
  children: React.ReactNode;
}

function CommentContainer({ depth, isLast, children }: CommentContainerProps) {
  if (depth === 0) {
    return <div>{children}</div>;
  }

  const INDENT_SIZE = 24;
  // const LINE_COLOR = '#e5e7eb';

  return (
    <div className="relative" style={{ marginLeft: `${INDENT_SIZE}px` }}>
      {/* Thread lines with proper vertical connections */}
      <div
        className="pointer-events-none absolute"
        style={{ left: `-${INDENT_SIZE / 2}px`, top: 0, bottom: 0 }}
      >
        {/* Vertical line */}
        <div
          className={`absolute top-0 left-0 w-0.5 ${isLast ? 'h-[24px]' : 'h-full'} bg-gray-50 opacity-10`}
        />
        {/* Horizontal connector - straight line without curve */}
        <div
          className="absolute top-[22px] h-0 border-b-2 border-gray-50 opacity-10"
          style={{
            left: '2px', // Start 2px to the right of the vertical line
            width: `${INDENT_SIZE / 2 + 2}px`, // Reduced width to compensate
          }}
        />
      </div>
      {children}
    </div>
  );
}

function CommentItem({ comment, projectId, depth = 0, maxDepth = MAX_DEPTH }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutate: toggleLike, isPending: isLiking } = useMutation(
    trpc.launches.toggleCommentLike.mutationOptions({
      onSuccess: (data) => {
        console.log('Like toggle successful:', data);
        queryClient.invalidateQueries({
          queryKey: trpc.launches.getComments.queryKey({ projectId }),
        });
      },
      onError: (error) => {
        console.error('Like toggle failed:', error);
      },
    }),
  );

  const hasReplies = Boolean(comment.replies && comment.replies.length > 0);
  const { canReply } = useCommentIndentation(depth, maxDepth);

  // Calculate total nested reply count recursively
  const totalReplyCount = useMemo(() => {
    const countReplies = (replies: CommentWithReplies[]): number => {
      return replies.reduce((count, reply) => {
        return count + 1 + (reply.replies ? countReplies(reply.replies) : 0);
      }, 0);
    };
    return comment.replies ? countReplies(comment.replies) : 0;
  }, [comment.replies]);

  const handleReplyClick = useCallback(() => {
    setShowReplyForm(!showReplyForm);
  }, [showReplyForm]);

  const handleReplySuccess = useCallback(() => {
    setShowReplyForm(false);
  }, []);

  const handleReplyCancel = useCallback(() => {
    setShowReplyForm(false);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  const handleLikeClick = useCallback(async () => {
    console.log('Like button clicked for comment:', comment.id);
    try {
      toggleLike({ commentId: comment.id });
      console.log('Toggle like mutation called');
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  }, [comment.id, toggleLike]);

  return (
    <motion.div
      className={`relative ${
        depth === 0
          ? 'rounded-none border border-neutral-800 bg-neutral-800/30 transition-colors hover:bg-neutral-800/40'
          : 'transition-colors duration-200 hover:bg-neutral-800/10'
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`relative flex gap-3 ${depth === 0 ? 'p-3 sm:p-4' : 'px-3 py-2 sm:px-4 sm:py-3'}`}
      >
        <Avatar className="mt-1 h-6 w-6 flex-shrink-0 sm:h-7 sm:w-7">
          <AvatarImage src={comment.user.image || ''} alt={comment.user.name || 'User avatar'} />
          <AvatarFallback className="text-xs">{comment.user.name?.[0] || 'U'}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          {/* Comment Header */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-white">
              {comment.user.name || 'Anonymous'}
            </p>
            <span className="text-xs text-neutral-500">•</span>
            <p className="flex-shrink-0 text-xs text-neutral-400">
              {formatDistanceToNow(new Date(comment.createdAt))} ago
            </p>
          </div>

          {/* Comment Content */}
          <div className={`${depth === 0 ? 'mb-3' : 'mb-2'}`}>
            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-neutral-300">
              {comment.content}
            </p>
          </div>

          {/* Comment Actions */}
          <CommentActions
            canReply={canReply}
            hasReplies={hasReplies}
            totalReplyCount={totalReplyCount}
            isCollapsed={isCollapsed}
            onReplyClick={handleReplyClick}
            onToggleCollapse={handleToggleCollapse}
            commentUserName={comment.user.name}
            likeCount={comment.likeCount || 0}
            isLiked={comment.isLiked || false}
            onLikeClick={handleLikeClick}
            isLiking={isLiking}
          />

          {/* Reply Form */}
          <AnimatePresence>
            {showReplyForm && (
              <div className="mt-3">
                <ReplyForm
                  projectId={projectId}
                  parentId={comment.id}
                  placeholder={`Reply to ${comment.user.name || 'this comment'}...`}
                  onSuccess={handleReplySuccess}
                  onCancel={handleReplyCancel}
                  autoFocus={true}
                  className="w-full"
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nested Replies */}
      {hasReplies && (
        <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 1, height: 'auto' }}
              animate={{
                opacity: isCollapsed ? 0 : 1,
                height: isCollapsed ? 0 : 'auto',
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              {comment.replies?.map((reply, index) => (
                <CommentContainer
                  key={reply.id}
                  depth={depth + 1}
                  isLast={index === comment.replies!.length - 1}
                  hasReplies={Boolean(reply.replies && reply.replies.length > 0)}
                >
                  <CommentItem
                    comment={reply}
                    projectId={projectId}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                  />
                </CommentContainer>
              ))}
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </motion.div>
  );
}

export default function CommentThread({
  projectId,
  comments,
  commentsLoading,
}: CommentThreadProps) {
  // Transform flat comments into nested structure
  const nestedComments = useMemo(() => {
    const commentMap = new Map<string, CommentWithReplies>();
    const rootComments: CommentWithReplies[] = [];

    // First pass: create comment objects
    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build the tree structure
    comments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id)!;

      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    // Sort replies by creation date (oldest first for better threading)
    const sortReplies = (comments: CommentWithReplies[]) => {
      comments.forEach((comment) => {
        if (comment.replies) {
          comment.replies.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          sortReplies(comment.replies);
        }
      });
    };

    // Sort root comments by creation date (newest first)
    rootComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    sortReplies(rootComments);

    return rootComments;
  }, [comments]);

  if (commentsLoading) {
    return (
      <div
        className="flex items-center justify-center py-8"
        role="status"
        aria-label="Loading comments"
      >
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        <span className="ml-2 text-neutral-400">Loading comments...</span>
      </div>
    );
  }

  if (!nestedComments || nestedComments.length === 0) {
    return (
      <div className="py-8 text-center">
        <MessageCircle className="mx-auto mb-3 h-8 w-8 text-neutral-600" />
        <p className="text-sm text-neutral-400">No comments yet.</p>
        <p className="mt-1 text-xs text-neutral-500">Be the first to comment!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" role="list" aria-label="Comments">
      <AnimatePresence>
        {nestedComments.map((comment) => (
          <motion.div
            key={comment.id}
            role="listitem"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CommentItem comment={comment} projectId={projectId} depth={0} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
