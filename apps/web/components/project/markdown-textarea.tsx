'use client';

import { Button } from '@workspace/ui/components/button';
import { MarkdownContent } from './markdown-content';
import { Eye, Edit, Split } from 'lucide-react';
import { cn } from '@workspace/ui/lib/utils';
import { useState } from 'react';
import * as React from 'react';

interface MarkdownTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground flex min-h-16 w-full rounded-md bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export function MarkdownTextarea({
  value = '',
  onChange,
  placeholder = 'Write your markdown here...',
  className,
  ...props
}: MarkdownTextareaProps) {
  const [content, setContent] = useState(value);
  const [mode, setMode] = useState<'write' | 'preview' | 'split'>('write');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setContent(newValue);
    onChange?.(newValue);
  };

  React.useEffect(() => {
    setContent(value);
  }, [value]);

  return (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      <div className="bg-muted/30 flex items-center justify-between border-b">
        <div className="flex items-center">
          <Button
            variant={mode === 'write' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setMode('write')}
          >
            <Edit className="mr-1 h-4 w-4" />
            Write
          </Button>
          <Button
            variant={mode === 'preview' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setMode('preview')}
          >
            <Eye className="mr-1 h-4 w-4" />
            Preview
          </Button>
          <Button
            variant={mode === 'split' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setMode('split')}
          >
            <Split className="mr-1 h-4 w-4" />
            Split
          </Button>
        </div>
      </div>

      <div className="h-[200px]">
        {mode === 'write' && (
          <Textarea
            value={content}
            onChange={handleChange}
            placeholder={placeholder}
            className="h-full resize-none overflow-y-auto rounded-none border-0 p-2"
            {...props}
          />
        )}

        {mode === 'preview' && (
          <div
            className="h-full overflow-y-auto border-0 p-2"
            role="region"
            aria-label="Markdown preview"
          >
            <MarkdownContent content={content} />
          </div>
        )}

        {mode === 'split' && (
          <div className="grid h-full min-w-0 grid-cols-2">
            <div className="min-w-0 border-r">
              <Textarea
                value={content}
                onChange={handleChange}
                placeholder={placeholder}
                className="h-full resize-none overflow-y-auto rounded-none border-0 p-2"
                {...props}
              />
            </div>
            <div className="h-full min-w-0 overflow-y-auto p-2 break-words">
              <MarkdownContent content={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
