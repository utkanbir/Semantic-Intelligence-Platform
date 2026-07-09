#!/usr/bin/env python3
"""Verify sip-dev frontend/backend rollout matches sprint-close expectations.

Run before closing a sprint milestone:

  python scripts/verify_sprint_deploy.py --sprint 31

Exit 0 when the dev overlay and live sip-dev deployments match the expected
frontend/backend images for the sprint and rollout is complete.

Update scripts/sprint_deploy_expectations.json for every enforced sprint.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

MANIFEST_PATH = Path(__file__).resolve().parent / "sprint_deploy_expectations.json"
REPO_ROOT = MANIFEST_PATH.parent.parent


def _run_command(args: list[str]) -> str:
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=False)
    except FileNotFoundError as error:
        raise RuntimeError(f"Command not found: {args[0]}") from error

    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip() or "command failed"
        raise RuntimeError(f"{' '.join(args)} failed: {stderr}")
    return result.stdout.strip()


def _load_manifest() -> dict:
    with MANIFEST_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def _image_repo(image: str) -> str:
    image_without_digest = image.split("@", 1)[0]
    last_slash = image_without_digest.rfind("/")
    last_colon = image_without_digest.rfind(":")
    if last_colon > last_slash:
        return image_without_digest[:last_colon]
    return image_without_digest


def _parse_overlay_images(kustomization_path: Path) -> dict[str, str]:
    if not kustomization_path.exists():
        raise RuntimeError(f"Overlay kustomization not found: {kustomization_path}")

    items: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    in_images = False

    for raw_line in kustomization_path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()

        if not in_images:
            if stripped == "images:":
                in_images = True
            continue

        if not stripped or stripped.startswith("#"):
            continue

        if not raw_line.startswith("  "):
            break

        if stripped.startswith("- "):
            if current:
                items.append(current)
            current = {}
            stripped = stripped[2:].strip()
            if not stripped:
                continue

        if ":" not in stripped:
            continue

        key, value = stripped.split(":", 1)
        if current is None:
            current = {}
        current[key.strip()] = value.strip()

    if current:
        items.append(current)

    images: dict[str, str] = {}
    for item in items:
        new_name = item.get("newName") or _image_repo(item.get("name", ""))
        new_tag = item.get("newTag")
        if new_name and new_tag:
            images[new_name] = f"{new_name}:{new_tag}"
    return images


def _get_cluster_image(*, namespace: str, deployment: str, container: str) -> str:
    jsonpath = f"jsonpath={{.spec.template.spec.containers[?(@.name==\"{container}\")].image}}"
    image = _run_command(
        ["kubectl", "-n", namespace, "get", "deployment", deployment, "-o", jsonpath]
    )
    if not image:
        raise RuntimeError(
            f"Deployment/{deployment} container {container!r} did not return an image."
        )
    return image


def _verify_rollout(*, namespace: str, deployment: str, timeout_seconds: int) -> None:
    _run_command(
        [
            "kubectl",
            "-n",
            namespace,
            "rollout",
            "status",
            f"deployment/{deployment}",
            f"--timeout={timeout_seconds}s",
        ]
    )


def verify_sprint(
    sprint: str,
    *,
    namespace: str | None = None,
    overlay_kustomization: str | None = None,
    timeout_seconds: int | None = None,
) -> list[str]:
    manifest = _load_manifest()
    sprint_key = str(sprint)
    enforce_from_sprint = int(manifest.get("enforce_from_sprint", 0))
    expectations = manifest.get("sprints", {}).get(sprint_key)

    if expectations is None:
        if int(sprint_key) < enforce_from_sprint:
            print(
                f"Skipping deploy verification for Sprint {sprint_key}: "
                f"gate is enforced starting at Sprint {enforce_from_sprint}."
            )
            return []
        raise KeyError(
            f"No deploy expectations for sprint {sprint_key} in {MANIFEST_PATH.name}"
        )

    namespace = namespace or manifest.get("default_namespace", "sip-dev")
    timeout_seconds = int(
        timeout_seconds or manifest.get("default_rollout_timeout_seconds", 180)
    )
    overlay_kustomization = overlay_kustomization or manifest.get(
        "default_overlay_kustomization",
        "infra/kubernetes/overlays/dev/kustomization.yaml",
    )
    overlay_path = Path(overlay_kustomization)
    if not overlay_path.is_absolute():
        overlay_path = REPO_ROOT / overlay_path

    deployments = expectations.get("deployments", [])
    if not deployments:
        raise RuntimeError(
            f"Sprint {sprint_key} deploy expectations must include at least one deployment."
        )

    label = expectations.get("label", sprint_key)
    print(
        f"Verifying Sprint {sprint_key} ({label}) deploy state in namespace {namespace} ..."
    )

    try:
        overlay_images = _parse_overlay_images(overlay_path)
    except RuntimeError as error:
        return [str(error)]

    errors: list[str] = []

    for deployment_expectation in deployments:
        deployment_name = deployment_expectation["name"]
        container_name = deployment_expectation["container"]
        expected_image = deployment_expectation["image"]
        expected_repo = _image_repo(expected_image)

        overlay_image = overlay_images.get(expected_repo)
        if overlay_image is None:
            errors.append(
                f"Dev overlay does not pin {expected_repo!r} in {overlay_path}."
            )
        elif overlay_image != expected_image:
            errors.append(
                f"Dev overlay image mismatch for deployment/{deployment_name}: "
                f"overlay={overlay_image!r}, expected={expected_image!r}. "
                f"Update {overlay_path.relative_to(REPO_ROOT)} before sprint close."
            )

        try:
            cluster_image = _get_cluster_image(
                namespace=namespace,
                deployment=deployment_name,
                container=container_name,
            )
        except RuntimeError as error:
            errors.append(str(error))
            continue

        if cluster_image != expected_image:
            errors.append(
                f"Cluster image mismatch for deployment/{deployment_name} container "
                f"{container_name!r}: cluster={cluster_image!r}, expected={expected_image!r}. "
                f"Rebuild/publish the expected image, apply the dev overlay, and wait for rollout."
            )

        try:
            _verify_rollout(
                namespace=namespace,
                deployment=deployment_name,
                timeout_seconds=timeout_seconds,
            )
        except RuntimeError as error:
            errors.append(str(error))
            continue

        if cluster_image == expected_image:
            print(
                f"OK: deployment/{deployment_name} container {container_name!r} "
                f"rolled out with {expected_image}"
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify sip-dev deployment state for sprint close")
    parser.add_argument("--sprint", required=True, help="Sprint number")
    parser.add_argument("--namespace", default=None)
    parser.add_argument("--overlay-kustomization", default=None)
    parser.add_argument("--timeout-seconds", type=int, default=None)
    args = parser.parse_args()

    try:
        errors = verify_sprint(
            args.sprint,
            namespace=args.namespace,
            overlay_kustomization=args.overlay_kustomization,
            timeout_seconds=args.timeout_seconds,
        )
    except (KeyError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        return 1

    if errors:
        print("Sprint deploy verification FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
