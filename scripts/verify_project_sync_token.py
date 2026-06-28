#!/usr/bin/env python3
"""Verify PROJECT_SYNC_TOKEN can read/write SIP MVP Delivery board (Project #3).

Run locally or in CI before board_sync:
  GH_TOKEN=... python scripts/verify_project_sync_token.py

Exit 0 when token can query user projectV2; exit 1 with actionable message otherwise.
"""

from __future__ import annotations

import json
import subprocess
import sys

OWNER = "utkanbir"
PROJECT_NUMBER = 3

QUERY = """
query($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      id
      title
    }
  }
}
"""


def main() -> int:
    result = subprocess.run(
        [
            "gh",
            "api",
            "graphql",
            "-f",
            f"query={QUERY}",
            "-f",
            f"login={OWNER}",
            "-F",
            f"number={PROJECT_NUMBER}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or result.stdout.strip(), file=sys.stderr)
        _print_help()
        return 1

    payload = json.loads(result.stdout)
    if payload.get("errors"):
        print(json.dumps(payload["errors"], indent=2), file=sys.stderr)
        _print_help()
        return 1

    project = payload.get("data", {}).get("user", {}).get("projectV2")
    if not project:
        print("Project not found or not accessible.", file=sys.stderr)
        _print_help()
        return 1

    print(f"OK: token can access project #{PROJECT_NUMBER} ({project['title']})")
    return 0


def _print_help() -> None:
    print(
        "\nFix PROJECT_SYNC_TOKEN:\n"
        "  Use a Classic PAT (recommended), not fine-grained, with scopes:\n"
        "    repo, read:project, project\n"
        "  Resource owner must be your user account (utkanbir) for user Project #3.\n"
        "  Update secret: gh secret set PROJECT_SYNC_TOKEN -R utkanbir/Semantic-Intelligence-Platform\n"
        "  See docs/project/SIP_DEVELOPMENT_PLAYBOOK.md section 8 (Live board visibility).\n",
        file=sys.stderr,
    )


if __name__ == "__main__":
    sys.exit(main())
