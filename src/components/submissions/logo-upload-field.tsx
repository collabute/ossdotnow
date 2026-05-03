'use client';

import { ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { UploadDropzone } from '@/lib/uploadthing';
import { Button } from '@/components/ui/button';

type UploadedLogoFile = {
  url?: string;
  ufsUrl?: string;
  serverData?: {
    url?: string;
  };
};

interface LogoUploadFieldProps {
  value?: string | null;
  disabled?: boolean;
  onChange: (url: string) => void;
}

function getUploadedUrl(file: UploadedLogoFile | undefined) {
  return file?.serverData?.url ?? file?.ufsUrl ?? file?.url;
}

export function LogoUploadField({ value, disabled, onChange }: LogoUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div className="space-y-3">
      <div className="border-border/70 bg-background/40 flex items-center gap-3 border p-3">
        {value ? (
          <img
            src={value}
            alt="Project logo preview"
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="border-border flex h-14 w-14 items-center justify-center rounded-full border">
            <ImageIcon className="text-muted-foreground h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Current logo</p>
          <p className="text-muted-foreground text-sm leading-5">
            PNG, JPG, or WebP up to 4MB. GitHub avatar is used as fallback.
          </p>
        </div>
        {isUploading && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-none"
            onClick={() => onChange('')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {disabled ? null : (
        <UploadDropzone
          endpoint="project-logos"
          appearance={{
            container:
              'border-border/70 bg-background/30 min-h-44 rounded-none border border-dashed p-4',
            uploadIcon: 'text-muted-foreground h-8 w-8',
            label: 'text-muted-foreground text-sm font-medium',
            allowedContent: 'text-muted-foreground text-xs',
            button:
              'h-9 rounded-none bg-primary px-4 text-sm font-medium text-primary-foreground',
          }}
          content={{
            label: 'Choose a logo or drop it here',
            allowedContent: 'PNG, JPG, or WebP up to 4MB',
            button: 'Choose file',
          }}
          onUploadBegin={() => setIsUploading(true)}
          onClientUploadComplete={(res) => {
            setIsUploading(false);
            const [file] = (res ?? []) as UploadedLogoFile[];
            const uploadedUrl = getUploadedUrl(file);

            if (!uploadedUrl) {
              toast.error('Logo upload finished without a file URL.');
              return;
            }

            onChange(uploadedUrl);
            toast.success('Logo uploaded');
          }}
          onUploadError={(error: Error) => {
            setIsUploading(false);
            toast.error(error.message || 'Logo upload failed');
          }}
        />
      )}
    </div>
  );
}
