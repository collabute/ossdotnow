'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { FolderOpen, LayoutDashboard, ListChecks, Users } from 'lucide-react';
import { NavUser } from '@/components/ui/nav-user';
import { NavMain } from '@/components/ui/nav-main';
import Icons from '@/components/ui/icons';
import Link from '@/components/ui/link';

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null | undefined | undefined;
  };
}) {
  const data = {
    navMain: [
      // {
      //   title: 'Dashboard',
      //   url: '/admin',
      //   icon: LayoutDashboard,
      //   isActive: true,
      // },
      {
        title: 'User Management',
        url: '#',
        icon: Users,
        items: [
          {
            title: 'All Users',
            url: '/admin/users',
          },
          // {
          //   title: 'Roles & Permissions',
          //   url: '/admin/users/roles',
          // },
          // {
          //   title: 'User Activity',
          //   url: '/admin/users/activity',
          // },
        ],
      },
      {
        title: 'Projects',
        url: '#',
        icon: FolderOpen,
        items: [
          {
            title: 'All Projects',
            url: '/admin/projects?approvalStatus=all',
          },
        ],
      },
      {
        title: 'Archived Waitlist',
        url: '#',
        icon: ListChecks,
        items: [
          {
            title: 'History',
            url: '/admin/waitlist',
          },
          // {
          //   title: 'Analytics',
          //   url: '/admin/waitlist/analytics',
          // },
        ],
      },
      // {
      //   title: 'Analytics',
      //   url: '/admin/analytics',
      //   icon: BarChart3,
      // },
      // {
      //   title: 'Security',
      //   url: '/admin/security',
      //   icon: Shield,
      // },
      // {
      //   title: 'Settings',
      //   url: '/admin/settings',
      //   icon: Settings,
      // },
    ],
  };

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          <Icons.logo className="size-6" />
          <span className="text-lg font-medium">oss.now admin</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Dashboard" asChild>
                <Link href="/admin" className="flex w-full items-center gap-2">
                  <LayoutDashboard className="size-4" />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user.name ?? '',
            email: user.email ?? '',
            avatar: user.image ?? '',
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
