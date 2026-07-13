import type { HubNavCardProps } from "./HubNavCard";

type HubNavItem = Pick<
  HubNavCardProps,
  "to" | "eyebrow" | "title" | "description" | "actionLabel" | "variant"
>;

export const PLATFORM_HUB_ENTRY: HubNavItem = {
  to: "/platform",
  eyebrow: "Platform",
  title: "Platform hub",
  description:
    "Cross-cutting framework capabilities shared across all applications—connectors, governance, and semantic transactions.",
  actionLabel: "Open platform hub",
  variant: "featured",
};

export const APPLICATIONS_HUB_ENTRY: HubNavItem = {
  to: "/applications",
  eyebrow: "Applications",
  title: "Applications & sandboxes",
  description:
    "Isolated workspaces for discovery, blueprints, products, agents, and sandbox experimentation.",
  actionLabel: "Browse applications",
  variant: "featured",
};

export const PLATFORM_SECTIONS: readonly HubNavItem[] = [
  {
    to: "/connectors",
    eyebrow: "Connectors",
    title: "Connectors",
    description: "Manage infrastructure and semantic connectors shared across applications.",
    actionLabel: "View and provision connectors",
  },
  {
    to: "/governance",
    eyebrow: "Governance",
    title: "Governance",
    description: "Define and track policies that govern platform data and operations.",
    actionLabel: "Browse governance policies",
  },
  {
    to: "/semantic-transactions",
    eyebrow: "Semantic Transactions",
    title: "Semantic Transactions",
    description:
      "Review semantic lineage — how meaning evolved for ontologies, products, and agents.",
    actionLabel: "Browse semantic transactions",
  },
  {
    to: "/audit-trace",
    eyebrow: "Audit Trace",
    title: "Audit Trace",
    description: "Explore operational and platform trace records, including connector events.",
    actionLabel: "Browse audit trace records",
  },
] as const;
