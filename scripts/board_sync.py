#!/usr/bin/env python3
"""Update SIP MVP Delivery GitHub Project Workflow Status for one issue.

Used by PMO during sprint (per transition) and by .github/workflows/project-board-sync.yml.

Requires: gh CLI authenticated with project scope, or GH_TOKEN / GITHUB_TOKEN in env.

Examples:
  python scripts/board_sync.py --issue 46 --status "In Progress"
  python scripts/board_sync.py --issue 46 --status "In Review" --add-to-project
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time

OWNER = "utkanbir"
PROJECT_NUMBER = 3
REPO = "utkanbir/Semantic-Intelligence-Platform"
VALID_STATUSES = frozenset({"Backlog", "Ready", "In Progress", "In Review", "QA", "Done"})

PROJECT_QUERY = """
query($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      id
      fields(first: 30) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue { number }
          }
        }
      }
    }
  }
}
"""

SET_STATUS_MUTATION = """
mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $project
      itemId: $item
      fieldId: $field
      value: { singleSelectOptionId: $option }
    }
  ) {
    projectV2Item { id }
  }
}
"""


def _run_gh(args: list[str]) -> str:
    result = subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "gh command failed")
    return result.stdout


def _graphql(query: str, **variables: str | int) -> dict:
    args = ["api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        flag = "-F" if isinstance(value, int) else "-f"
        args.extend([flag, f"{key}={value}"])
    raw = _run_gh(args)
    payload = json.loads(raw)
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"]))
    return payload["data"]


def _load_project() -> tuple[str, dict[str, str], dict[int, str], str]:
    data = _graphql(PROJECT_QUERY, login=OWNER, number=PROJECT_NUMBER)
    project = data["user"]["projectV2"]
    project_id = project["id"]

    status_field = next(
        (field for field in project["fields"]["nodes"] if field.get("name") == "Workflow Status"),
        None,
    )
    if not status_field:
        raise RuntimeError("Workflow Status field not found on project")

    status_map = {opt["name"]: opt["id"] for opt in status_field["options"]}
    field_id = status_field["id"]

    item_by_issue: dict[int, str] = {}
    for item in project["items"]["nodes"]:
        content = item.get("content") or {}
        number = content.get("number")
        if number is not None:
            item_by_issue[int(number)] = item["id"]

    return project_id, status_map, item_by_issue, field_id


def _add_issue_to_project(issue_number: int) -> None:
    url = f"https://github.com/{REPO}/issues/{issue_number}"
    _run_gh(
        [
            "project",
            "item-add",
            str(PROJECT_NUMBER),
            "--owner",
            OWNER,
            "--url",
            url,
        ]
    )
    time.sleep(1)


def set_issue_status(*, issue_number: int, status: str, add_to_project: bool = False) -> None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status {status!r}. Must be one of: {sorted(VALID_STATUSES)}")

    project_id, status_map, item_by_issue, field_id = _load_project()
    if status not in status_map:
        raise RuntimeError(f"Status {status!r} not found on board. Options: {sorted(status_map)}")

    if issue_number not in item_by_issue:
        if not add_to_project:
            raise RuntimeError(
                f"Issue #{issue_number} is not on project {PROJECT_NUMBER}. "
                "Use --add-to-project to add it first."
            )
        _add_issue_to_project(issue_number)
        _, _, item_by_issue, _ = _load_project()

    item_id = item_by_issue.get(issue_number)
    if not item_id:
        raise RuntimeError(f"Could not resolve project item for issue #{issue_number}")

    _graphql(
        SET_STATUS_MUTATION,
        project=project_id,
        item=item_id,
        field=field_id,
        option=status_map[status],
    )
    print(f"Issue #{issue_number} -> {status}")


def parse_issue_from_pr_title(title: str) -> int | None:
    match = re.search(r"\[#(\d+)\]", title)
    if match:
        return int(match.group(1))
    match = re.search(r"#(\d+)\b", title)
    return int(match.group(1)) if match else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Set GitHub Project Workflow Status for one issue.")
    parser.add_argument("--issue", type=int, required=True, help="GitHub issue number")
    parser.add_argument("--status", required=True, help="Workflow Status column value")
    parser.add_argument(
        "--add-to-project",
        action="store_true",
        help="Add issue to SIP MVP Delivery if missing",
    )
    args = parser.parse_args()
    try:
        set_issue_status(
            issue_number=args.issue,
            status=args.status,
            add_to_project=args.add_to_project,
        )
    except (RuntimeError, ValueError) as error:
        print(f"board_sync: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
