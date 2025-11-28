import type { SVGProps } from 'react';
import Image from 'next/image';

export function AppLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v5" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M2 12h6" />
      <path d="m5 9 3 3-3 3" />
    </svg>
  );
}

export function NewsletterBanner() {
  return (
    <Image
      src="https://jumpahead.ai/The-Daily-Get-Ahead-Header.png"
      alt="The Daily Get Ahead Banner"
      width={1200}
      height={200}
      className="w-full h-auto"
      priority
    />
  );
}
