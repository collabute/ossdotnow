import { Button } from '@workspace/ui/components/button';
import Icons from '@workspace/ui/components/icons';
import Link from '@workspace/ui/components/link';

export function TempNav() {
  return (
    <>
      <Link
        href="/roadmap"
        event="roadmap_nav_click"
        className="px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white"
      >
        roadmap
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-none text-neutral-400 hover:text-white"
        render={(props) => (
          <Link
            href="https://l.oss.now/discord/"
            target="_blank"
            rel="noopener noreferrer"
            event="discord_nav_click"
            {...props}
          >
            <Icons.discord className="size-4 fill-white sm:size-5" />
          </Link>
        )}
      />
      <Button
        variant="ghost"
        size="icon"
        className="rounded-none"
        render={(props) => (
          <Link
            href="https://l.oss.now/discord/"
            target="_blank"
            rel="noopener noreferrer"
            event="discord_nav_click"
            {...props}
          >
            <Icons.discord className="size-4 fill-white sm:size-5" />
          </Link>
        )}
      />
      <Button
        variant="ghost"
        size="icon"
        className="rounded-none"
        render={(props) => (
          <Link
            href="https://l.oss.now/gh/"
            target="_blank"
            rel="noopener noreferrer"
            event="github_nav_click"
            {...props}
          >
            <Icons.github className="size-4 sm:size-5" />
          </Link>
        )}
      />
      <Button
        variant="ghost"
        size="icon"
        className="rounded-none text-neutral-400 hover:text-white"
        render={(props) => (
          <Link
            href="https://l.oss.now/x/"
            target="_blank"
            rel="noopener noreferrer"
            event="twitter_nav_click"
            {...props}
          >
            <Icons.twitter className="size-4 sm:size-5" />
          </Link>
        )}
      />
    </>
  );
}

export default TempNav;
