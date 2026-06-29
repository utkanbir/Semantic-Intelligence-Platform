#!/usr/bin/env python3
"""Verify SIP MVP Delivery board state for sprint close.

Run before closing a sprint milestone:

  python scripts/verify_sprint_board.py --sprint 8

Exit 0 when every sprint issue is on the project and has the expected Workflow Status.
Exit 1 otherwise (sprint-close blocker).

Update scripts/sprint_board_expectations.json when creating a new sprint milestone.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

MANIFEST_PATH = Path(__file__).resolve().parent / "sprint_board_expectations.json"
OWNER = "utkanbir"
PROJECT_NUMBER = 3

PROJECT_ITEMS_QUERY = """
query($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      items(first: 100) {
        nodes {
          content {
            ... on Issue { number }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField { name }
                }
              }
            }
          }
        }
      }
    }
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
    payload = json.loads(_run_gh(args))
    if payload.get("errors"):
        raise RuntimeError(json.dumps(payload["errors"]))
    return payload["data"]


def _load_manifest() -> dict:
    with MANIFEST_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def _workflow_status_by_issue() -> dict[int, str | None]:
    data = _graphql(PROJECT_ITEMS_QUERY, login=OWNER, number=PROJECT_NUMBER)
    items = data["user"]["projectV2"]["items"]["nodes"]
    result: dict[int, str | None] = {}
    for item in items:
        content = item.get("content") or {}
        number = content.get("number")
        if number is None:
            continue
        workflow_status: str | None = None
        for field_value in item.get("fieldValues", {}).get("nodes", []):
            field = field_value.get("field") or {}
            if field.get("name") == "Workflow Status":
                workflow_status = field_value.get("name")
                break
        result[int(number)] = workflow_status
    return result


def verify_sprint(sprint: str) -> list[str]:
    manifest = _load_manifest()
    sprint_key = str(sprint)
    expectations = manifest.get("sprints", {}).get(sprint_key)
    if expectations is None:
        raise KeyError(f"No board expectations for sprint {sprint_key} in {MANIFEST_PATH.name}")

    label = expectations.get("label", sprint_key)
    issue_numbers = [int(n) for n in expectations["issues"]]
    expected_status = expectations.get(
        "expected_status", manifest.get("default_expected_status", "Done")
    )

    print(
        f"Verifying Sprint {sprint_key} ({label}) board: "
        f"{len(issue_numbers)} issues -> {expected_status!r} ..."
    )

    try:
        status_by_issue = _workflow_status_by_issue()
    except RuntimeError as error:
        return [str(error)]

    errors: list[str] = []
    for issue_number in issue_numbers:
        if issue_number not in status_by_issue:
            errors.append(
                f"Issue #{issue_number} is not on SIP MVP Delivery project #{PROJECT_NUMBER}. "
                f"Run: powershell -File scripts/set-board-status.ps1 "
                f"-IssueNumber {issue_number} -Status \"{expected_status}\" -AddToProject"
            )
            continue
        actual = status_by_issue[issue_number]
        if actual is None:
            errors.append(
                f"Issue #{issue_number} has no Workflow Status on the board. "
                f"Run: powershell -File scripts/set-board-status.ps1 "
                f"-IssueNumber {issue_number} -Status \"{expected_status}\""
            )
        elif actual != expected_status:
            errors.append(
                f"Issue #{issue_number} Workflow Status is {actual!r}, expected {expected_status!r}."
            )

    if not errors:
        print(f"OK: all {len(issue_numbers)} sprint issues are {expected_status} on project board.")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify GitHub Project board for sprint close")
    parser.add_argument("--sprint", required=True, help="Sprint number")
    args = parser.parse_args()

    try:
        errors = verify_sprint(args.sprint)
    except KeyError as error:
        print(str(error), file=sys.stderr)
        return 1

    if errors:
        print("Sprint board verification FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        print(
            "\nRepair drift: powershell -File scripts/fix-project-board.ps1",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
