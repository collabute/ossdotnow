import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function read(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

async function fileExists(path: string) {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

function includes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message);
}

const [
  rootRoute,
  routeBoundaries,
  home,
  roadmap,
  routeGuards,
  login,
  onboarding,
  dashboard,
  dashboardProjects,
  newProject,
  editProject,
  projectsIndex,
  projectDetail,
  adminLayout,
  adminProjects,
  adminProjectDetail,
  adminUsers,
] = await Promise.all([
  read('src/routes/__root.tsx'),
  read('src/components/layout/route-boundaries.tsx'),
  read('src/routes/index.tsx'),
  read('src/routes/roadmap.tsx'),
  read('src/lib/route-guards.ts'),
  read('src/routes/login.tsx'),
  read('src/routes/onboarding.tsx'),
  read('src/routes/dashboard.tsx'),
  read('src/routes/dashboard.projects.tsx'),
  read('src/routes/dashboard.projects.new.tsx'),
  read('src/routes/dashboard.projects.$id.edit.tsx'),
  read('src/routes/projects.index.tsx'),
  read('src/routes/projects.$id.tsx'),
  read('src/routes/admin.tsx'),
  read('src/routes/admin.projects.tsx'),
  read('src/routes/admin.projects.$id.tsx'),
  read('src/routes/admin.users.tsx'),
]);

includes(rootRoute, 'notFoundComponent', 'root route has a not-found boundary');
includes(rootRoute, 'errorComponent', 'root route has an error boundary');
includes(routeBoundaries, 'RouteErrorState', 'shared route error state exists');
includes(routeBoundaries, 'RouteNotFoundState', 'shared route not-found state exists');
includes(home, 'HomeActions', 'home CTAs adapt to auth state');
includes(home, 'Create Account', 'unauthenticated home CTA sends users to account creation');
assert.equal(
  await fileExists('src/routes/early-submission.tsx'),
  false,
  'legacy early submission route has been removed',
);
assert.equal(
  roadmap.toLowerCase().includes('coming soon'),
  false,
  'public roadmap does not use coming soon copy',
);

includes(login, "createFileRoute('/login')", 'login route exists');
includes(login, 'errorComponent', 'login route has an error state');
includes(login, 'reset-password', 'login supports reset-password mode');
includes(login, 'verification-sent', 'login supports verification-sent mode');
includes(login, 'LoginForm', 'login route renders the auth state machine');

includes(onboarding, "createFileRoute('/onboarding')", 'onboarding route exists');
includes(onboarding, 'errorComponent', 'onboarding route has an error state');
includes(onboarding, "'owner'", 'owner account type is offered');
includes(onboarding, "'contributor'", 'contributor account type is offered');
includes(onboarding, "'investor'", 'investor account type is offered');
includes(onboarding, 'updateAccountType', 'onboarding persists account type');

includes(routeGuards, 'requireAuth', 'auth route guard exists');
includes(routeGuards, 'requireOnboarded', 'onboarded route guard exists');
includes(routeGuards, "accountType !== 'owner'", 'owner-only route guard exists');
includes(routeGuards, "redirect({ to: '/login' })", 'unauthenticated users redirect to login');
includes(routeGuards, "redirect({ to: '/onboarding' })", 'missing account type redirects to onboarding');

includes(dashboard, "createFileRoute('/dashboard')", 'dashboard shell exists');
includes(dashboard, 'errorComponent', 'dashboard route has an error state');
includes(dashboard, 'requireOnboarded', 'dashboard requires onboarding');
includes(dashboard, 'ConnectGitHubAlert', 'dashboard prompts for GitHub linking');
includes(dashboard, 'const isOwner', 'dashboard computes owner visibility');
includes(dashboard, '{isOwner &&', 'owner-only dashboard nav is hidden from other account types');

includes(dashboardProjects, "createFileRoute('/dashboard/projects')", 'owner projects route exists');
includes(dashboardProjects, 'errorComponent', 'owner projects route has an error state');
includes(dashboardProjects, 'requireOwnerAccount', 'my projects is owner-only');
includes(dashboardProjects, 'getMyProjects', 'owner projects list loads owned submissions');
includes(dashboardProjects, 'deleteMyProject', 'owner projects support soft delete');
includes(dashboardProjects, 'resubmitMyProject', 'rejected projects can be resubmitted');
includes(dashboardProjects, '/dashboard/projects/new', 'new project route is linked from dashboard');

includes(newProject, "createFileRoute('/dashboard/projects/new')", 'submit project route exists');
includes(newProject, 'errorComponent', 'submit project route has an error state');
includes(newProject, 'requireOwnerAccount', 'submit project is owner-only');
includes(newProject, 'SubmissionForm', 'submit project route uses the live submission flow');
includes(editProject, "createFileRoute('/dashboard/projects/$id/edit')", 'edit project route exists');
includes(editProject, 'updateMyProject', 'edit project route saves through owner mutation');

includes(projectsIndex, "createFileRoute('/projects/')", 'public project discovery route exists');
includes(projectsIndex, 'errorComponent', 'project discovery route has an error state');
includes(projectsIndex, 'validateSearch', 'project discovery validates search params');
includes(projectDetail, "createFileRoute('/projects/$id')", 'public project detail route exists');
includes(projectDetail, 'notFoundComponent', 'project detail route has a not-found state');

includes(adminLayout, "createFileRoute('/admin')", 'admin shell exists');
includes(adminLayout, 'errorComponent', 'admin shell has an error state');
includes(adminLayout, "session.user.role !== 'admin'", 'admin shell rejects non-admin users');
includes(adminLayout, 'notFound()', 'non-admin users do not see admin shell');
includes(adminProjects, "createFileRoute('/admin/projects')", 'admin review queue exists');
includes(adminProjects, 'acceptProject', 'admin can approve projects');
includes(adminProjects, 'rejectProject', 'admin can reject projects');
includes(adminProjectDetail, "createFileRoute('/admin/projects/$id')", 'admin project detail exists');
includes(adminUsers, "createFileRoute('/admin/users')", 'admin user management exists');
includes(adminUsers, 'updateUserRole', 'admin user role changes are exposed');
includes(adminUsers, 'suspendUser', 'admin user suspension is exposed');

console.log('Web smoke checks passed');
