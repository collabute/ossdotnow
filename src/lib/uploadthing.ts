import { generateUploadDropzone } from '@uploadthing/react';

import { env } from './env';

type OurFileRouter = any;

export const UploadDropzone = generateUploadDropzone<OurFileRouter>({
  url: `${env.VITE_API_BASE_URL}/api/uploadthing`,
}) as ReturnType<
  typeof generateUploadDropzone<OurFileRouter>
>;
