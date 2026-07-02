interface VersionedEntity {
  id: string;
  version_number: number;
  previous_version_id: string | null;
}

export function formatVersionChain<T extends VersionedEntity>(
  entity: T,
  entities: T[],
): string {
  if (!entity.previous_version_id) {
    return String(entity.version_number);
  }

  const parent = entities.find((item) => item.id === entity.previous_version_id);
  if (parent) {
    return `${entity.version_number} ← ${parent.version_number}`;
  }

  return `${entity.version_number} (fork)`;
}
