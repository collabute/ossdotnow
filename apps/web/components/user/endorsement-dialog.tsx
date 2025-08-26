'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Textarea } from '@workspace/ui/components/textarea';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { Award, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTRPC } from '@/hooks/use-trpc';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const endorsementSchema = z.object({
  type: z.enum(['project', 'work', 'general']),
  content: z
    .string()
    .min(10, 'Endorsement must be at least 10 characters')
    .max(1000, 'Endorsement must be less than 1000 characters'),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  workDetails: z
    .object({
      company: z.string().optional(),
      role: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
    .optional(),
});

type EndorsementFormData = z.infer<typeof endorsementSchema>;

interface EndorsementDialogProps {
  userId: string;
  userName: string;
}

export function EndorsementDialog({ userId, userName }: EndorsementDialogProps) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();

  const { data: sharedProjects } = useQuery({
    ...trpc.endorsements.getUserSharedProjects.queryOptions({ targetUserId: userId }),
    enabled: open,
  });

  const form = useForm<EndorsementFormData>({
    resolver: zodResolver(endorsementSchema),
    defaultValues: {
      type: 'general',
      content: '',
    },
  });

  // Watch form values with state to force re-renders
  const [formValues, setFormValues] = useState({
    type: form.getValues('type'),
    projectId: form.getValues('projectId'),
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      setFormValues({
        type: value.type || 'general',
        projectId: value.projectId,
      });
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const { mutate: createEndorsement, isPending } = useMutation(
    trpc.endorsements.create.mutationOptions({
      onSuccess: () => {
        toast.success('Endorsement added successfully!');
        setOpen(false);
        form.reset();
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to add endorsement');
      },
    }),
  );

  const onSubmit = (data: EndorsementFormData) => {
    const submitData = {
      endorsedUserId: userId,
      type: data.type,
      content: data.content,
      projectId: data.projectId === 'other' ? undefined : data.projectId,
      projectName: data.projectId === 'other' ? data.projectName : undefined,
      workDetails: data.workDetails,
    };

    createEndorsement(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-none border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <Award className="mr-2 h-4 w-4" />
          Endorse
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-none">
        <DialogHeader>
          <DialogTitle>Endorse {userName}</DialogTitle>
          <DialogDescription>
            Share your experience working with {userName}. This endorsement will be visible on their
            profile.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endorsement Type</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full rounded-none">
                        <SelectValue placeholder="Select endorsement type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="general" className="rounded-none">
                          General Endorsement
                        </SelectItem>
                        <SelectItem value="project" className="rounded-none">
                          Project Collaboration
                        </SelectItem>
                        <SelectItem value="work" className="rounded-none">
                          Work Relationship
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>Choose the context of your endorsement</FormDescription>
                </FormItem>
              )}
            />

            {formValues.type === 'project' && (
              <>
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Related Project</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="w-full rounded-none">
                            <SelectValue placeholder="Select a project or choose 'Other'" />
                          </SelectTrigger>
                          <SelectContent className="rounded-none">
                            {sharedProjects && sharedProjects.length > 0 ? (
                              <>
                                {sharedProjects.map((project) => (
                                  <SelectItem
                                    key={project.id}
                                    value={project.id}
                                    className="rounded-none"
                                  >
                                    <div className="flex items-center gap-2">
                                      {project.logoUrl && (
                                        <img
                                          src={project.logoUrl}
                                          alt={project.name}
                                          className="h-4 w-4 rounded"
                                        />
                                      )}
                                      {project.name}
                                    </div>
                                  </SelectItem>
                                ))}
                                <SelectItem value="other" className="rounded-none">
                                  Other (Enter manually)
                                </SelectItem>
                              </>
                            ) : (
                              <SelectItem value="other" className="rounded-none">
                                Other (Enter manually)
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>Select the project you collaborated on</FormDescription>
                    </FormItem>
                  )}
                />
                {formValues.projectId === 'other' && (
                  <FormField
                    control={form.control}
                    name="projectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter the project name"
                            className="rounded-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the name of the project you collaborated on
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            {formValues.type === 'work' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="workDetails.company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name" className="rounded-none" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="workDetails.role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl>
                          <Input placeholder="Their role" className="rounded-none" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="workDetails.startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="month" className="rounded-none" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="workDetails.endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="month" className="rounded-none" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endorsement</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={`Write your endorsement for ${userName}...`}
                      className="min-h-[150px] resize-none rounded-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Share specific examples of their work, skills, or qualities
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="rounded-none"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="rounded-none">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Endorsement
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
