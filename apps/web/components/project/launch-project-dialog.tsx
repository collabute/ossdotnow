'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form';
import { AlertCircle, CalendarIcon, ExternalLink, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Calendar } from '@workspace/ui/components/calendar';
import { Switch } from '@workspace/ui/components/switch';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { MarkdownTextarea } from './markdown-textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '@workspace/ui/lib/utils';
import { useState, useEffect } from 'react';
import { useTRPC } from '@/hooks/use-trpc';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { z } from 'zod/v4';

const launchSchema = z
  .object({
    tagline: z
      .string()
      .min(10, 'Tagline must be at least 10 characters')
      .max(100, 'Tagline must be less than 100 characters'),
    detailedDescription: z
      .string()
      .min(25, 'Description must be at least 25 characters')
      .max(1000, 'Description must be less than 1000 characters'),
    scheduleEnabled: z.boolean(),
    launchDate: z.date().optional(),
    launchTime: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduleEnabled && !data.launchDate) {
        return false;
      }
      return true;
    },
    {
      message: 'Launch date is required when scheduling is enabled',
      path: ['launchDate'],
    },
  );

type LaunchFormData = z.infer<typeof launchSchema>;

interface LaunchProjectDialogProps {
  projectId: string;
  projectName: string;
  isRepoPrivate?: boolean;
  gitRepoUrl?: string;
  gitHost?: string;
}

export function LaunchProjectDialog({
  projectId,
  projectName,
  isRepoPrivate,
  gitRepoUrl,
  gitHost,
}: LaunchProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [privateRepoDialogOpen, setPrivateRepoDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  );

  const [currentDate, setCurrentDate] = useState(
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  );
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: existingLaunch } = useQuery({
    ...trpc.launches.getLaunchByProjectId.queryOptions({ projectId }),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      );
      const newDate = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (newDate !== currentDate) {
        setCurrentDate(newDate);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentDate]);

  const form = useForm<LaunchFormData>({
    resolver: zodResolver(launchSchema),
    defaultValues: {
      tagline: '',
      detailedDescription: '',
      launchDate: undefined,
      launchTime: currentTime,
      scheduleEnabled: false,
    },
  });

  const refreshRepoStatusMutation = useMutation(
    trpc.projects.refreshRepoStatus.mutationOptions({
      onSuccess: (data) => {
        // Always invalidate queries to ensure fresh data
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getProject.queryKey({ id: projectId }),
        });

        // Also invalidate repository data cache
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'repository',
        });

        if (data.statusChanged && !data.isNowPrivate) {
          toast.success('Repository is now public! You can launch your project.');
          setPrivateRepoDialogOpen(false);
          // Force a page refresh to ensure UI updates with new data
          setTimeout(() => window.location.reload(), 1000);
        } else if (data.statusChanged && data.isNowPrivate) {
          toast.info('Repository is now private.');
        } else if (!data.statusChanged && data.isNowPrivate) {
          toast.info('Repository is still private. Please make it public to launch.');
        } else if (!data.statusChanged && !data.isNowPrivate) {
          toast.success('Repository is already public! You can launch your project.');
          setPrivateRepoDialogOpen(false);
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to refresh repository status');
      },
    }),
  );

  const launchMutation = useMutation(
    trpc.launches.launchProject.mutationOptions({
      onSuccess: () => {
        const isScheduled = form.getValues('scheduleEnabled');
        if (isScheduled) {
          toast.success(
            'Project launch scheduled successfully! It will automatically go live at the scheduled time.',
          );
        } else {
          toast.success('Project launched successfully!');
        }
        setOpen(false);
        form.reset();
        queryClient.invalidateQueries({
          queryKey: trpc.launches.getTodayLaunches.queryKey({ limit: 50 }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.launches.getAllLaunches.queryKey({ limit: 50 }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.launches.getLaunchByProjectId.queryKey({ projectId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.launches.getUserScheduledLaunches.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to launch project');
      },
    }),
  );

  const onSubmit = (data: LaunchFormData) => {
    let finalLaunchDate: Date;
    let finalLaunchTime: string | undefined;

    if (data.scheduleEnabled && data.launchDate) {
      finalLaunchDate = new Date(data.launchDate);
      finalLaunchTime = data.launchTime;

      if (finalLaunchTime) {
        const timeParts = finalLaunchTime.split(':');
        const hours = parseInt(timeParts[0] || '0', 10);
        const minutes = parseInt(timeParts[1] || '0', 10);
        const testDate = new Date(finalLaunchDate);
        testDate.setHours(hours, minutes, 0, 0);

        if (testDate.getTime() <= Date.now()) {
          toast.error('Scheduled launch time must be in the future');
          return;
        }
      }
    } else {
      finalLaunchDate = new Date();
      finalLaunchTime = undefined;
    }

    const submitData = {
      projectId,
      tagline: data.tagline,
      detailedDescription: data.detailedDescription,
      launchDate: finalLaunchDate,
      launchTime: finalLaunchTime,
      isScheduled: data.scheduleEnabled,
    };

    launchMutation.mutate(submitData);
  };

  const getRepoSettingsUrl = () => {
    if (!gitRepoUrl || !gitHost) return '';

    try {
      // Handle different URL formats
      let repoPath = '';

      if (gitRepoUrl.includes('github.com') || gitRepoUrl.includes('gitlab.com')) {
        const url = new URL(gitRepoUrl);
        repoPath = url.pathname;
      } else {
        // Handle formats like "owner/repo" or "owner/repo.git"
        repoPath = `/${gitRepoUrl}`;
      }

      const pathParts = repoPath.split('/').filter(Boolean);

      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        const repo = pathParts[1]?.replace(/\.git$/, '') || '';

        if (gitHost === 'github') {
          return `https://github.com/${owner}/${repo}/settings`;
        } else if (gitHost === 'gitlab') {
          return `https://gitlab.com/${owner}/${repo}/-/settings/general`;
        }
      }
    } catch (error) {
      console.error(error);
      // Failed to parse repository URL

      // Fallback: try to extract owner/repo from the URL string
      const match = gitRepoUrl.match(
        /(?:github\.com|gitlab\.com)[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
      );
      if (match) {
        const [, owner, repo] = match;
        if (gitHost === 'github') {
          return `https://github.com/${owner}/${repo}/settings`;
        } else if (gitHost === 'gitlab') {
          return `https://gitlab.com/${owner}/${repo}/-/settings/general`;
        }
      }
    }

    // Final fallback - return the original repo URL
    return gitRepoUrl.replace(/\.git$/, '');
  };

  const handleRefreshStatus = () => {
    refreshRepoStatusMutation.mutate({ projectId });
  };

  // Private Repository Dialog
  const PrivateRepoDialog = () => (
    <Dialog open={privateRepoDialogOpen} onOpenChange={setPrivateRepoDialogOpen}>
      <DialogContent
        className="rounded-none sm:max-w-[500px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Repository is Private
          </DialogTitle>
          <DialogDescription>
            Your repository needs to be public to launch your project on our platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-none border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <h4 className="mb-2 font-medium text-yellow-800 dark:text-yellow-200">
              Why does my repository need to be public?
            </h4>
            <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
              <li>• Community members can discover and contribute to your project</li>
              <li>• Ensures transparency and builds trust with users</li>
              <li>• Allows proper validation of your project&apos;s authenticity</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">How to make your repository public:</h4>
            <ol className="text-muted-foreground space-y-1 text-sm">
              <li>1. Go to your repository settings</li>
              <li>2. Scroll down to the &quot;Danger Zone&quot; section</li>
              <li>3. Click &quot;Change visibility&quot; and select &quot;Public&quot;</li>
              <li>4. Come back here and click &quot;Check Status&quot; to retry</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPrivateRepoDialogOpen(false)}
            className="rounded-none"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleRefreshStatus}
            disabled={refreshRepoStatusMutation.isPending}
            className="rounded-none"
          >
            {refreshRepoStatusMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin rounded-none" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4 rounded-none" />
                Check Status
              </>
            )}
          </Button>
          <Button
            onClick={() => window.open(getRepoSettingsUrl(), '_blank')}
            className="gap-2 rounded-none"
          >
            <ExternalLink className="h-4 w-4" />
            Repository Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (existingLaunch && !isRepoPrivate) {
    return (
      <Button
        className="gap-2 rounded-none border-neutral-700 bg-neutral-800 text-cyan-500 hover:text-cyan-400"
        size="sm"
        variant="outline"
        onClick={() => window.open(`/launches/${projectId}`, '_blank')}
      >
        <Rocket className="h-4 w-4" />
        View Launch
      </Button>
    );
  }

  return (
    <>
      {isRepoPrivate ? (
        <>
          <Button
            className="gap-2 rounded-none"
            size="sm"
            onClick={() => setPrivateRepoDialogOpen(true)}
            variant="outline"
          >
            <Rocket className="h-4 w-4" />
            Launch Project
          </Button>
          <PrivateRepoDialog />
        </>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-none" size="sm">
              <Rocket className="h-4 w-4" />
              Launch Project
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-h-[80vh] overflow-y-auto rounded-none sm:max-w-[600px]"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Launch {projectName}</DialogTitle>
              <DialogDescription>
                Launch your project to get it featured on the launches page. Make sure to craft a
                compelling tagline that describes what makes your project unique.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="tagline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tagline</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="A short, catchy description of your project"
                          {...field}
                          className="rounded-none"
                        />
                      </FormControl>
                      <FormDescription>
                        This will be the first thing people see about your project
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="detailedDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detailed Description</FormLabel>
                      <FormControl>
                        <MarkdownTextarea
                          placeholder="Tell us more about your project, what problem it solves, key features, etc."
                          className="min-h-[120px] rounded-none"
                          {...field}
                          required
                        />
                      </FormControl>
                      <FormDescription>
                        Provide more context about your project for interested users
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduleEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-none border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Schedule Launch</FormLabel>
                        <FormDescription>
                          Choose a specific date and time for your launch, or launch immediately
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (checked) {
                              if (!form.getValues('launchDate')) {
                                form.setValue('launchDate', new Date());
                              }
                              if (!form.getValues('launchTime')) {
                                const futureTime = new Date();
                                futureTime.setMinutes(futureTime.getMinutes() + 5);
                                const timeString = futureTime.toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                });
                                form.setValue('launchTime', timeString);
                              }
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('scheduleEnabled') && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="launchDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Launch Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn(
                                    'bg-input/30 rounded-none pl-3 text-left font-normal',
                                    'hover:bg-input/30',
                                    !field.value && 'text-muted-foreground',
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'PPP')
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto rounded-none p-0" align="start">
                              <Calendar
                                buttonVariant="outline"
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                defaultMonth={new Date(currentDate)}
                                disabled={(date) => {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const maxDate = new Date();
                                  maxDate.setDate(maxDate.getDate() + 40);
                                  return date < today || date > maxDate;
                                }}
                                captionLayout="dropdown"
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="launchTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Launch Time</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              id="time-picker"
                              value={field.value || ''}
                              min={
                                form.watch('launchDate')?.toDateString() ===
                                new Date().toDateString()
                                  ? (() => {
                                      const now = new Date();
                                      now.setMinutes(now.getMinutes() + 5);
                                      return now.toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                      });
                                    })()
                                  : undefined
                              }
                              onChange={(e) => field.onChange(e.target.value)}
                              className="bg-background appearance-none rounded-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="rounded-none"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={launchMutation.isPending}
                    className="rounded-none"
                  >
                    {launchMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin rounded-none" />
                        {form.watch('scheduleEnabled') ? 'Scheduling...' : 'Launching...'}
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-4 w-4 rounded-none" />
                        {form.watch('scheduleEnabled') ? 'Schedule Launch' : 'Launch Now'}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
