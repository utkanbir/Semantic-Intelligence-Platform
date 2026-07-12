import { render, screen, waitFor } from "@testing-library/react";

import { MemoryRouter } from "react-router-dom";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApplicationResponse } from "../../api/applications";

import { PlatformOverviewPage } from "./PlatformOverviewPage";



const sampleApplications: ApplicationResponse[] = [

  {

    id: "app-1",

    key: "musteri-analitigi",

    name: "Müşteri analitiği",

    status: "active",

    description: null,

    created_at: "2026-07-01T10:00:00Z",

    updated_at: "2026-07-10T10:00:00Z",

    workspace: {

      id: "ws-1",

      application_id: "app-1",

      status: "active",

      postgres_schema: "app_musteri",

      minio_namespace: "app-musteri",

      fuseki_dataset: "app_musteri",

      qdrant_collection: "app_musteri",

      metadata_domain: "app.musteri",

      ontology_namespace: "http://example.org/musteri",

      agent_namespace: "http://example.org/musteri/agents",

      product_registry_namespace: "http://example.org/musteri/products",

      agent_registry_namespace: "http://example.org/musteri/agent-registry",

      created_at: "2026-07-01T10:00:00Z",

      updated_at: "2026-07-10T10:00:00Z",

    },

  },

  {

    id: "app-2",

    key: "urun-katalogu",

    name: "Ürün katalogu (pilot)",

    status: "created",

    description: null,

    created_at: "2026-07-05T10:00:00Z",

    updated_at: "2026-07-05T10:00:00Z",

    workspace: {

      id: "ws-2",

      application_id: "app-2",

      status: "created",

      postgres_schema: "app_urun",

      minio_namespace: "app-urun",

      fuseki_dataset: "app_urun",

      qdrant_collection: "app_urun",

      metadata_domain: "app.urun",

      ontology_namespace: "http://example.org/urun",

      agent_namespace: "http://example.org/urun/agents",

      product_registry_namespace: "http://example.org/urun/products",

      agent_registry_namespace: "http://example.org/urun/agent-registry",

      created_at: "2026-07-05T10:00:00Z",

      updated_at: "2026-07-05T10:00:00Z",

    },

  },

];



vi.mock("../../api/applications", () => ({

  listApplications: vi.fn(),

}));



import { listApplications } from "../../api/applications";



describe("PlatformOverviewPage", () => {

  beforeEach(() => {

    vi.mocked(listApplications).mockReset();

  });



  it("renders s0_home layout with sandbox and application panels", async () => {

    vi.mocked(listApplications).mockResolvedValue(sampleApplications);



    render(

      <MemoryRouter>

        <PlatformOverviewPage />

      </MemoryRouter>,

    );



    expect(

      screen.getByRole("heading", { name: "Semantic Intelligence Platform" }),

    ).toBeInTheDocument();



    await waitFor(() => {

      expect(screen.getByRole("heading", { name: "Sandboxlar" })).toBeInTheDocument();

    });



    expect(screen.getByRole("heading", { name: "Uygulamalar (App)" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Compare dashboard özeti" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "+ Yeni sandbox" })).toHaveAttribute(

      "href",

      "/applications?create=1",

    );

    expect(screen.getByRole("link", { name: "+ Yeni uygulama" })).toHaveAttribute(

      "href",

      "/applications?create=1",

    );

  });



  it("lists recent sandboxes and applications from the API", async () => {

    vi.mocked(listApplications).mockResolvedValue(sampleApplications);



    render(

      <MemoryRouter>

        <PlatformOverviewPage />

      </MemoryRouter>,

    );



    await waitFor(() => {

      expect(screen.getAllByText("Müşteri analitiği").length).toBeGreaterThanOrEqual(2);

    });



    expect(screen.getAllByText("Fuseki / PostgreSQL / Qdrant / MinIO").length).toBeGreaterThanOrEqual(
      1,
    );

    expect(screen.getByText("Sandbox: Müşteri analitiği")).toBeInTheDocument();

    expect(screen.getAllByText("Aktif").length).toBeGreaterThanOrEqual(1);

    expect(screen.getAllByText("Taslak").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Çalışıyor")).toBeInTheDocument();

  });



  it("links sandbox and application rows to application detail routes", async () => {

    vi.mocked(listApplications).mockResolvedValue(sampleApplications);



    render(

      <MemoryRouter>

        <PlatformOverviewPage />

      </MemoryRouter>,

    );



    await waitFor(() => {

      expect(screen.getAllByRole("link", { name: /Müşteri analitiği/i }).length).toBeGreaterThan(

        0,

      );

    });



    const detailLinks = screen

      .getAllByRole("link")

      .filter((link) => link.getAttribute("href") === "/applications/app-1");



    expect(detailLinks.length).toBeGreaterThanOrEqual(2);

  });

});

