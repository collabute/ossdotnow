import { useMemo } from 'react';

export function useCommentIndentation(depth: number, maxDepth: number = 6) {
  return useMemo(() => {
    const clampedDepth = Math.min(depth, maxDepth);

    // Generate indentation classes based on depth
    const indentationClasses = {
      0: '',
      1: 'ml-4',
      2: 'ml-8',
      3: 'ml-12',
      4: 'ml-16',
      5: 'ml-20',
      6: 'ml-24',
    };

    const borderClasses = {
      0: '',
      1: 'border-l border-neutral-700 pl-4',
      2: 'border-l border-neutral-700 pl-4',
      3: 'border-l border-neutral-700 pl-4',
      4: 'border-l border-neutral-700 pl-4',
      5: 'border-l border-neutral-700 pl-4',
      6: 'border-l border-neutral-700 pl-4',
    };

    return {
      indentationClass: indentationClasses[clampedDepth as keyof typeof indentationClasses] || '',
      borderClass: borderClasses[clampedDepth as keyof typeof borderClasses] || '',
      canReply: depth < maxDepth,
    };
  }, [depth, maxDepth]);
}
