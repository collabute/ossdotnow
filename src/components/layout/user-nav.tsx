'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import Link from '@/components/ui/link';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/use-trpc';
import { useNavigate } from '@tanstack/react-router';

export default function NavUser() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: '/login' });
  };

  const { data: user, isLoading } = useQuery(trpc.user.me.queryOptions());

  return isLoading ? (
    <Skeleton className="h-8 w-8 rounded-none" />
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="ml-2 h-8 w-8 rounded-none">
          <AvatarImage src={user?.image || ''} alt={user?.name} />
          <AvatarFallback className="rounded-none">CN</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-none"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-none">
              <AvatarImage src={user?.image || ''} alt={user?.name} />
              <AvatarFallback className="rounded-none">CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user?.name}</span>
              <span className="truncate text-xs">{user?.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user?.role === 'admin' && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <LayoutDashboard />
                Admin Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={signOut}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
