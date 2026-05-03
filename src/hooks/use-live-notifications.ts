'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { RouterOutputs } from '@/lib/api-types';
import { useTRPC } from '@/hooks/use-trpc';

type MyProject = RouterOutputs['projects']['getMyProjects'][number];
type InterestInboxItem = RouterOutputs['projects']['getMyProjectInterestInbox'][number];
type InterestHistoryItem = RouterOutputs['projects']['getMyProjectInterestHistory'][number];

export type LiveNotificationKind =
  | 'project_submitted'
  | 'project_approved'
  | 'project_rejected'
  | 'interest_received'
  | 'interest_sent';

export type LiveNotificationTone = 'info' | 'success' | 'warning' | 'danger';

export type LiveNotification = {
  id: string;
  kind: LiveNotificationKind;
  tone: LiveNotificationTone;
  title: string;
  description: string;
  href: string;
  sourceLabel: string;
  createdAt: Date;
  isRead: boolean;
};

const readStoragePrefix = 'ossdotnow.notifications.read.v1';

export function useLiveNotifications({ enabled = true }: { enabled?: boolean } = {}) {
  const trpc = useTRPC();
  const me = useQuery({
    ...trpc.user.me.queryOptions(),
    enabled,
  });
  const isOwner = me.data?.accountType === 'owner';
  const isContributorOrInvestor =
    me.data?.accountType === 'contributor' || me.data?.accountType === 'investor';

  const myProjects = useQuery({
    ...trpc.projects.getMyProjects.queryOptions(),
    enabled: enabled && isOwner,
  });
  const interestInbox = useQuery({
    ...trpc.projects.getMyProjectInterestInbox.queryOptions(),
    enabled: enabled && isOwner,
  });
  const interestHistory = useQuery({
    ...trpc.projects.getMyProjectInterestHistory.queryOptions(),
    enabled: enabled && isContributorOrInvestor,
  });

  const storageKey = me.data?.id ? `${readStoragePrefix}.${me.data.id}` : null;
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setReadIds(new Set());
      return;
    }

    try {
      const storedIds = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
      setReadIds(new Set(Array.isArray(storedIds) ? storedIds.filter(isString) : []));
    } catch {
      setReadIds(new Set());
    }
  }, [storageKey]);

  const persistReadIds = useCallback(
    (nextReadIds: Set<string>) => {
      setReadIds(new Set(nextReadIds));

      if (!storageKey || typeof window === 'undefined') return;

      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(nextReadIds)));
    },
    [storageKey],
  );

  const sourceNotifications = useMemo(() => {
    const notifications: Array<Omit<LiveNotification, 'isRead'>> = [];

    if (isOwner) {
      for (const project of myProjects.data ?? []) {
        notifications.push(buildProjectNotification(project));
      }

      for (const item of interestInbox.data ?? []) {
        notifications.push(buildInterestReceivedNotification(item));
      }
    }

    if (isContributorOrInvestor) {
      for (const item of interestHistory.data ?? []) {
        notifications.push(buildInterestSentNotification(item));
      }
    }

    return notifications
      .filter((notification): notification is Omit<LiveNotification, 'isRead'> =>
        Boolean(notification),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [
    interestHistory.data,
    interestInbox.data,
    isContributorOrInvestor,
    isOwner,
    myProjects.data,
  ]);

  const notifications = useMemo<LiveNotification[]>(
    () =>
      sourceNotifications.map((notification) => ({
        ...notification,
        isRead: readIds.has(notification.id),
      })),
    [readIds, sourceNotifications],
  );

  const markRead = useCallback(
    (id: string) => {
      const nextReadIds = new Set(readIds);
      nextReadIds.add(id);
      persistReadIds(nextReadIds);
    },
    [persistReadIds, readIds],
  );

  const markUnread = useCallback(
    (id: string) => {
      const nextReadIds = new Set(readIds);
      nextReadIds.delete(id);
      persistReadIds(nextReadIds);
    },
    [persistReadIds, readIds],
  );

  const markAllRead = useCallback(() => {
    persistReadIds(new Set(sourceNotifications.map((notification) => notification.id)));
  }, [persistReadIds, sourceNotifications]);

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.isRead).length,
    readCount: notifications.filter((notification) => notification.isRead).length,
    isLoading:
      me.isLoading ||
      (isOwner && (myProjects.isLoading || interestInbox.isLoading)) ||
      (isContributorOrInvestor && interestHistory.isLoading),
    markRead,
    markUnread,
    markAllRead,
  };
}

function buildProjectNotification(project: MyProject): Omit<LiveNotification, 'isRead'> {
  const status = project.approvalStatus;
  const reviewedDate = toDate(project.reviewedAt ?? project.updatedAt ?? project.createdAt);
  const submittedDate = toDate(project.updatedAt ?? project.createdAt);

  if (status === 'approved') {
    return {
      id: notificationId('project', project.id, 'approved', reviewedDate),
      kind: 'project_approved',
      tone: 'success',
      title: 'Project approved',
      description: `${project.name} is approved and visible in public discovery.`,
      href: `/projects/${project.id}`,
      sourceLabel: project.name,
      createdAt: reviewedDate,
    };
  }

  if (status === 'rejected') {
    return {
      id: notificationId('project', project.id, 'rejected', reviewedDate),
      kind: 'project_rejected',
      tone: 'danger',
      title: 'Project rejected',
      description: project.rejectionReason
        ? `${project.name} needs changes: ${project.rejectionReason}`
        : `${project.name} needs changes before it can go public.`,
      href: '/dashboard/projects',
      sourceLabel: project.name,
      createdAt: reviewedDate,
    };
  }

  return {
    id: notificationId('project', project.id, 'pending', submittedDate),
    kind: 'project_submitted',
    tone: 'info',
    title: 'Project submitted',
    description: `${project.name} is pending admin review.`,
    href: '/dashboard/projects',
    sourceLabel: project.name,
    createdAt: submittedDate,
  };
}

function buildInterestReceivedNotification(
  item: InterestInboxItem,
): Omit<LiveNotification, 'isRead'> {
  const createdAt = toDate(item.interest.updatedAt ?? item.interest.createdAt);
  const isInvestor = item.interest.type === 'investment';
  const isContact = item.interest.type === 'contact';
  const actor = item.user.name || item.user.email;

  return {
    id: notificationId('interest', item.interest.id, item.interest.type, createdAt),
    kind: 'interest_received',
    tone: isInvestor ? 'success' : 'warning',
    title: isInvestor
      ? 'New investor interest'
      : isContact
        ? 'New maintainer contact'
        : 'New contributor interest',
    description: `${actor} sent ${interestTypeLabel(item.interest.type)} for ${item.project.name}.`,
    href: '/dashboard',
    sourceLabel: item.project.name,
    createdAt,
  };
}

function buildInterestSentNotification(
  item: InterestHistoryItem,
): Omit<LiveNotification, 'isRead'> {
  const createdAt = toDate(item.interest.updatedAt ?? item.interest.createdAt);
  const isInvestor = item.interest.type === 'investment';

  return {
    id: notificationId('interest-sent', item.interest.id, item.interest.type, createdAt),
    kind: 'interest_sent',
    tone: isInvestor ? 'success' : 'info',
    title: isInvestor ? 'Investor interest sent' : 'Contributor interest sent',
    description: `You sent ${interestTypeLabel(item.interest.type)} for ${item.project.name}.`,
    href: `/projects/${item.project.id}`,
    sourceLabel: item.project.name,
    createdAt,
  };
}

function interestTypeLabel(type: 'contribution' | 'investment' | 'contact') {
  if (type === 'investment') return 'investor interest';
  if (type === 'contact') return 'a maintainer contact request';
  return 'contributor interest';
}

function notificationId(prefix: string, id: string, variant: string, date: Date) {
  return `${prefix}:${id}:${variant}:${date.toISOString()}`;
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return new Date();

  return value instanceof Date ? value : new Date(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
