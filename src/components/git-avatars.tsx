'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Link from '@/components/ui/link';

export default function GitAvatars() {
  return (
    <div className="bg-background group mt-8 flex items-center rounded-4xl border p-2 shadow-sm">
      <div className="flex justify-center">
        {projects.map((project, index) => (
          <Tooltip key={project.name}>
            <div
              className={`flex h-9 w-9 items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                index === 0 ? 'ml-0' : '-ml-2.5'
              } group-hover:ml-0.5`}
            >
              <TooltipTrigger className="h-9 w-9 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105">
                <Link
                  href={project.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  event={`${project.name}_clicked`}
                >
                  <img className="ring-background rounded-full ring-1" src={project.avatar} />
                </Link>
              </TooltipTrigger>
            </div>
            <TooltipContent>
              <p>{project.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <span className="whitespace-nowrap text-muted-foreground pointer-events-none px-3 text-xs opacity-100 transition-opacity duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:opacity-70 md:text-sm">
        Join these awesome oss projects
      </span>
    </div>
  );
}

const projects = [
  {
    name: 'better-t-stack',
    url: 'https://github.com/AmanVarshney01/create-better-t-stack',
    avatar: 'https://avatars.githubusercontent.com/u/45312299',
  },
  {
    name: 'fumadocs',
    url: 'https://github.com/fuma-nama/fumadocs',
    avatar: 'https://avatars.githubusercontent.com/u/76240755',
  },
  {
    name: 'Autumn',
    url: 'https://github.com/useautumn/autumn',
    avatar: 'https://avatars.githubusercontent.com/u/194405912',
  },
  {
    name: 'CompAI',
    url: 'https://github.com/trycompai/comp',
    avatar: 'https://avatars.githubusercontent.com/u/195194844',
  },
  {
    name: 'Analog',
    url: 'https://github.com/analogdotnow/Analog',
    avatar: 'https://avatars.githubusercontent.com/u/212980245',
  },
  {
    name: 'better-auth',
    url: 'https://github.com/better-auth/better-auth',
    avatar: 'https://avatars.githubusercontent.com/u/163827765',
  },
  {
    name: 'ultracite',
    url: 'https://github.com/haydenbleasel/ultracite',
    avatar: 'https://oss.now/logos/ultracite.png',
  },
];
