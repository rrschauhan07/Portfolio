export interface ProjectCard {
  title: string;
  description: string;
  tags: string[];
}

export const projects: ProjectCard[] = [
  {
    title: 'Bug bounty findings',
    description: 'Live-program findings, from early recon to a validated report.',
    tags: ['Recon', 'Web', 'API'],
  },
  {
    title: 'Lab walkthroughs',
    description: 'Controlled exercises that turn an edge case into a repeatable technique.',
    tags: ['Web', 'Mobile', 'Thick client'],
  },
  {
    title: 'CVE breakdowns',
    description: 'Disclosed vulnerabilities taken apart from root cause to remediation.',
    tags: ['Root cause', 'Impact', 'Fix'],
  },
];
