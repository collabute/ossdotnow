import 'server-only';

import { earlySubmissionRouter } from './routers/early-submissions';
import { notificationsRouter } from './routers/notifications';
import { createTRPCContext, createTRPCRouter } from './trpc';
import { endorsementsRouter } from './routers/endorsements';
import { earlyAccessRouter } from './routers/early-access';
import { submissionRouter } from './routers/submissions';
import { repositoryRouter } from './routers/repository';
import { categoriesRouter } from './routers/categories';
import { projectsRouter } from './routers/projects';
import { launchesRouter } from './routers/launches';
import { profileRouter } from './routers/profile';
import { usersRouter } from './routers/users';
import { adminRouter } from './routers/admin';
import { userRouter } from './routers/user';

export type * from './driver/types';

export const appRouter = createTRPCRouter({
  earlyAccess: earlyAccessRouter,
  user: userRouter,
  users: usersRouter,
  projects: projectsRouter,
  categories: categoriesRouter,
  earlySubmission: earlySubmissionRouter,
  submission: submissionRouter,
  repository: repositoryRouter,
  admin: adminRouter,
  profile: profileRouter,
  launches: launchesRouter,
  notifications: notificationsRouter,
  endorsements: endorsementsRouter,
});

export type AppRouter = typeof appRouter;

export const createContext = createTRPCContext;

export type { DebugPermissionsResult } from './routers/projects';
