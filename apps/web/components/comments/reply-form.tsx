'use client';

import { Form, FormControl, FormField, FormItem, FormMessage } from '@workspace/ui/components/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Textarea } from '@workspace/ui/components/textarea';
import { Button } from '@workspace/ui/components/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { authClient } from '@workspace/auth/client';
import { useTRPC } from '@/hooks/use-trpc';
import { useForm } from 'react-hook-form';
import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod/v4';
import { motion } from 'motion/react';
import { Send, Loader2, X } from 'lucide-react';

const replySchema = z.object({
  content: z.string().min(1, 'Reply cannot be empty').max(1000, 'Reply is too long'),
});

type ReplyFormData = z.infer<typeof replySchema>;

interface ReplyFormProps {
  projectId: string;
  parentId?: string;
  placeholder?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  className?: string;
}



export default function ReplyForm({
  projectId,
  parentId,
  placeholder = 'Add your reply...',
  onSuccess,
  onCancel,
  autoFocus = false,
  className = '',
}: ReplyFormProps) {
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const form = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      content: '',
    },
  });

  const { mutate: addReply, isPending: isReplyPending } = useMutation(
    trpc.launches.addComment.mutationOptions({
      onSuccess: () => {
        const message = parentId ? 'Reply added successfully!' : 'Comment added successfully!';
        toast.success(message);
        form.reset();
        onSuccess?.();
        queryClient.invalidateQueries({
          queryKey: trpc.launches.getComments.queryKey({ projectId }),
        });
      },
      onError: (error) => {
        const errorMessage = error.message || 'Failed to add reply. Please try again.';
        toast.error(errorMessage);
      },
    }),
  );

  const onSubmitReply = useCallback((data: ReplyFormData) => {
    if (!session?.user) {
      toast.error('Please login to reply');
      return;
    }
    addReply({
      projectId,
      content: data.content,
      parentId,
    });
  }, [session?.user, addReply, projectId, parentId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void form.handleSubmit(onSubmitReply)();
    }
    if (e.key === 'Escape') {
      onCancel?.();
    }
  }, [form, onSubmitReply, onCancel]);

  const handleCancel = useCallback(() => {
    form.reset();
    onCancel?.();
  }, [form, onCancel]);

  // Focus textarea when component mounts if autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  if (!session?.user) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`overflow-hidden ${className}`}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmitReply)}
          className="space-y-3"
        >
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder={placeholder}
                    className="resize-none rounded-none border-neutral-700 bg-neutral-800/50 text-neutral-200 placeholder:text-neutral-500 text-sm focus:border-neutral-600 focus-visible:ring-0 transition-colors"
                    rows={parentId ? 3 : 4}
                    {...field}
                    ref={(e) => {
                      field.ref(e);
                      textareaRef.current = e;
                    }}
                    onKeyDown={handleKeyDown}
                    aria-label={placeholder}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="gap-2 rounded-none"
                disabled={isReplyPending}
              >
                <X className="h-3 w-3" />
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isReplyPending}
              className="gap-2 rounded-none"
            >
              {isReplyPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {parentId ? 'Reply' : 'Comment'}
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
