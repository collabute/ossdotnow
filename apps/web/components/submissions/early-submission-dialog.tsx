'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Button } from '@workspace/ui/components/button';
import SubmissionForm from './submission-form';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function EarlySubmissionDialog() {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    toast.success('Project submitted successfully! We\'ll review it and get back to you soon.');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 rounded-none">
          <span>Early Submission</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-none"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Early Submission</DialogTitle>
          <DialogDescription>Submit your open source project for early access.</DialogDescription>
        </DialogHeader>
        <SubmissionForm earlySubmission={true} onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  );
}
