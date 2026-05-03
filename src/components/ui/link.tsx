'use client';

import { Link as RouterLink } from '@tanstack/react-router';
import { track as vercelTrack } from '@vercel/analytics/react';
import { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

type Props = ComponentPropsWithoutRef<'a'> &
  {
    href: string;
    event?: string;
    eventObject?: Record<string, any>;
  };

export default function Link({
  className,
  href,
  children,
  event,
  eventObject,
  onClick,
  ...props
}: Props) {
  const handleClick: Props['onClick'] = (e) => {
    if (event) {
      vercelTrack(event, eventObject);
    }
    if (onClick) {
      onClick(e);
    }
  };

  if (/^(https?:|mailto:|tel:|#)/.test(href) || props.target) {
    return (
      <a href={href} className={cn(className)} {...props} onClick={handleClick}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink
      to={href}
      className={cn(className)}
      {...props}
      onClick={handleClick}
    >
      {children}
    </RouterLink>
  );
}
