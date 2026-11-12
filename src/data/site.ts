/**
 * Central identity + contact settings.
 * Everything marked PLACEHOLDER should be updated before launch.
 */
export const site = {
  name: 'Rishi Raj Singh Chauhan',
  shortName: 'Rishi Raj',
  familyName: 'Singh Chauhan',
  initials: 'RRS',
  handle: 'rrschauhan07',
  role: 'Cybersecurity Professional',
  discipline: 'VAPT · Security Research',
  description:
    'Rishi Raj Singh Chauhan is a cybersecurity professional specialising in vulnerability assessment and penetration testing across web applications, mobile applications, and thick clients, with a focus on security research.',
  email: 'rrschauhan20@gmail.com',
  socials: [
    {
      label: 'GitHub',
      href: 'https://github.com/rrschauhan07',
      icon: 'github',
    },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/rrsc20/',
      icon: 'linkedin',
    },
    {
      label: 'X',
      href: 'https://x.com/rrschauhan07',
      icon: 'x',
    },
  ] as Array<{ label: string; href: string; icon: 'github' | 'linkedin' | 'x' }>,
  nav: [
    { label: 'Writeups', href: '/' },
    { label: 'About', href: '/about/' },
  ],
} as const;
