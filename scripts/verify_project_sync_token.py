#!/usr/bin/env python3
"""Verify PROJECT_SYNC_TOKEN can read/write SIP MVP Delivery board (Project #3).

Run locally or in CI before board_sync:
  GH_TOKEN=... python scripts/verify_project_sync_token.py

Exit 0 when token can query user projectV2 and resolve issue node IDs for writes;
exit 1 with actionable message otherwise.
"""

from __future__ import annotations

import json
import subprocess
import sys

OWNER = "utkanbir"
PROJECT_NUMBER = 3
REPO = "utkanbir/Semantic-Intelligence-Platform"

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

ISSUE_NODE_QUERY = """
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      id
    }
  }
}
"""

_REPO_OWNER, _REPO_NAME = REPO.split("/", 1)


def _gh_graphql(query: str, **variables: str | int) -> dict:
    args = ["gh", "api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        flag = "-F" if isinstance(value, int) else "-f"
        args.extend([flag, f"{key}={value}"])
    result = subprocess.run(args, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "gh graphql failed")
    payload = json.loads(result.stdout)
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"]))
    return payload["data"]


def main() -> int:
    try:
        data = _gh_graphql(QUERY, login=OWNER, number=PROJECT_NUMBER)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        _print_help()
        return 1

    project = data.get("user", {}).get("projectV2")
    if not project:
        print("Project not found or not accessible.", file=sys.stderr)
        _print_help()
        return 1

    print(f"OK: token can access project #{PROJECT_NUMBER} ({project['title']})")

    # Write path uses repository.issue.id — read-only project query can pass while
    # `gh project item-add` fails with misleading "unknown owner type" (cli/cli#8885).
    try:
        issue_data = _gh_graphql(
            ISSUE_NODE_QUERY,
            owner=_REPO_OWNER,
            name=_REPO_NAME,
            number=1,
        )
        issue_id = issue_data.get("repository", {}).get("issue", {}).get("id")
        if not issue_id:
            raise RuntimeError("Could not resolve issue node id for write-path verification")
    except RuntimeError as error:
        print(f"Write-path check failed: {error}", file=sys.stderr)
        _print_help()
        return 1

    print("OK: token can resolve issue node IDs (board_sync write path)")
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
