import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Project } from '@/lib/api-types';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';

const SPLIT_DISTANCE = 10;
const OVERLAP = 10;
const SIZE = 16;

export default function ProjectTicks({ project }: { project: Project }) {
  const ticks = [
    { label: 'Verified', color: '#10B981', isActive: !!project.ownerId },
    { label: 'Hiring', color: '#3B82F6', isActive: !!project.isHiring },
  ];

  const activeTicks = ticks.filter((tick) => tick.isActive);

  return (
    <div className="group/ticks relative inline-flex">
      <div
        className="relative"
        style={{
          width: `${activeTicks.length * OVERLAP + SIZE - OVERLAP}px`,
          height: `${SIZE + 2}px`,
        }}
      >
        {activeTicks.map((tick, index) => {
          return tick.isActive ? (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'absolute rounded-full bg-white p-[1px] shadow-sm transition-all duration-300 ease-in-out',
                    'group-hover/ticks:[transform:translateX(var(--split-distance))]',
                  )}
                  style={
                    {
                      left: `${index * OVERLAP}px`,
                      zIndex: activeTicks.length - index,
                      '--split-distance': `${index * SPLIT_DISTANCE}px`,
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="group/tick relative flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor: tick.color,
                      width: `${SIZE}px`,
                      height: `${SIZE}px`,
                    }}
                  >
                    <CheckIcon className="text-white" size={SIZE * 0.6} />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{tick.label}</p>
              </TooltipContent>
            </Tooltip>
          ) : null;
        })}
      </div>
    </div>
  );
}
