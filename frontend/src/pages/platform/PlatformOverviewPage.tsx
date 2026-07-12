import {
  APPLICATIONS_HUB_ENTRY,
  HubNavCard,
  HubPageLayout,
  HubSection,
  PLATFORM_HUB_ENTRY,
  PLATFORM_SECTIONS,
} from "../../components/hub";

export function PlatformOverviewPage() {
  return (
    <HubPageLayout
      title="Home"
      lead="Semantic Intelligence Platform — manage shared platform capabilities or open an application workspace to run discovery, blueprints, and agents."
    >
      <HubSection
        headingId="home-platform-section"
        title="Platform capabilities"
        description="Framework services that span every application—connectors, governance, semantic transactions, and audit trace."
      >
        <HubNavCard {...PLATFORM_HUB_ENTRY} />
        {PLATFORM_SECTIONS.map((section) => (
          <HubNavCard key={section.to} {...section} />
        ))}
      </HubSection>

      <HubSection
        headingId="home-applications-section"
        title="Applications & sandboxes"
        description="Work inside isolated application workspaces or spin up sandboxes for experimentation."
      >
        <HubNavCard {...APPLICATIONS_HUB_ENTRY} />
      </HubSection>
    </HubPageLayout>
  );
}
