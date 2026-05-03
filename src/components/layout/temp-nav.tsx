import { Button } from '@/components/ui/button';
import Icons from '@/components/ui/icons';
import Link from '@/components/ui/link';

export function TempNav() {
  return (
    <>
      <Link href="/roadmap" event="roadmap_nav_click" className="mr-2 hover:bg-neutral-900">
        roadmap
      </Link>
      <Button variant="ghost" size="icon" className="rounded-none" asChild>
        <Link
          href="https://l.oss.now/discord/"
          target="_blank"
          rel="noopener noreferrer"
          event="discord_nav_click"
        >
          <Icons.discord className="size-4 fill-white sm:size-5" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" className="rounded-none" asChild>
        <Link
          href="https://l.oss.now/gh/"
          target="_blank"
          rel="noopener noreferrer"
          event="github_nav_click"
        >
          <Icons.github className="size-4 fill-white sm:size-5" />
        </Link>
      </Button>
      <Button variant="ghost" size="icon" className="rounded-none" asChild>
        <Link
          href="https://l.oss.now/x/"
          target="_blank"
          rel="noopener noreferrer"
          event="twitter_nav_click"
        >
          <Icons.twitter className="size-4 fill-white sm:size-5" />
        </Link>
      </Button>
    </>
  );
}

export default TempNav;
