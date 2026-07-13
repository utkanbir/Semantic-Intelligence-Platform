import {
  HubNavCard,
  HubPageLayout,
  HubSection,
  PLATFORM_SECTIONS,
} from "../../components/hub";

export function PlatformHubPage() {
  return (
    <HubPageLayout
      title="Platform"
      headingId="platform-hub-heading"
      lead="Cross-cutting framework capabilities shared across all applications—connectors, governance, and semantic transactions."
    >
      <HubSection
        headingId="platform-hub-sections"
        title="Platform services"
        description="Browse and manage the shared services that every application relies on."
      >
        {PLATFORM_SECTIONS.map((section) => (
          <HubNavCard key={section.to} {...section} />
        ))}
      </HubSection>
    </HubPageLayout>
  );
}
