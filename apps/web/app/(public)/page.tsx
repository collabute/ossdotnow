import Icons from '@workspace/ui/components/icons';
import Link from '@workspace/ui/components/link';
import Image from 'next/image';

export default function Page() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] overflow-hidden p-6 md:min-h-[calc(100vh-80px)]">
      <Image
        src="/home-background.png"
        alt=""
        aria-hidden="true"
        width={960}
        height={860}
        className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-full w-full object-cover object-right-bottom opacity-70 mix-blend-screen"
      />

      <div className="relative z-10 mx-auto flex w-full flex-col items-center justify-center gap-12 overflow-hidden text-center">
        <div className="z-10 flex w-full max-w-2xl flex-col items-center gap-8">
          <h1 className="z-10 flex flex-wrap items-center justify-center gap-2 text-2xl font-medium tracking-[-0.04em] sm:gap-3 sm:text-4xl md:text-5xl">
            <Icons.logo className="size-6 flex-shrink-0 sm:size-8 md:size-10" />
            <span>has been <span style={{ color: '#C69DF8' }}>acquired</span> by</span>
            <Link
              href="https://collabute.com"
              target="_blank"
              className="flex items-center gap-2 transition-opacity hover:opacity-80 sm:gap-3"
              event="clicked_collabute_logo"
            >
              <Image
                src="/collabute-logo.png"
                alt="Collabute"
                width={48}
                height={48}
                className="size-6 flex-shrink-0 object-contain sm:size-8 md:size-10"
              />
              <span>Collabute</span>
            </Link>
          </h1>

          <p className="z-10 mx-auto max-w-lg text-balance text-center text-[#9f9f9f] sm:text-lg">
            We&apos;re excited to merge with Collabute to continue our mission of connecting open
            source project owners with contributors.
          </p>

          <Link
            href="https://collabute.com/blog/collabute-oss-now"
            target="_blank"
            className="text-sm font-medium text-white underline-offset-4 transition-colors hover:text-[#9f9f9f] hover:underline"
            event="clicked_announcement_link"
          >
            Read announcement →
          </Link>
        </div>
      </div>
    </div>
  );
}
