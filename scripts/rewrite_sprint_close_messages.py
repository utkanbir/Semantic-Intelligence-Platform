"""Rewrite sprint-close commit subjects to end_of_sprint_N prefix (git filter-branch msg-filter)."""

from __future__ import annotations

import os
import sys

# Original full SHAs on develop before rewrite (Sprint 0–12 close commits).
SPRINT_CLOSE_SUBJECTS: dict[str, str] = {
    "462d07c353daac52e514dddf6d9899228ed04d67": (
        "end_of_sprint_0: Sprint 0 retro and architecture health report (#27)"
    ),
    "ccede1249e03cec2c33a5ca9d2ab01d382d11b53": (
        "end_of_sprint_1: Sprint 1 close — retro, health report, ADR deferral"
    ),
    "de5a5e26c4d1067cdca87fbbf988e694c69d0830": (
        "end_of_sprint_2: Sprint 2 close — retro, health report, auto-close policy"
    ),
    "40f7a95bcd45f7920639649704cf82500dc46e93": (
        "end_of_sprint_3: Sprint 3 close — retro, architecture health report, board reconciliation"
    ),
    "251253abe75bd89a87d31d2e6188238e52bd9ba0": (
        "end_of_sprint_4: Sprint 4 close — retro, architecture health, board reconcile script"
    ),
    "7e044f64b7a9e0dddb17b35a09f3403986e48574": (
        "end_of_sprint_5: Sprint 5 close — retro, architecture health, board reconcile script"
    ),
    "bf3ad9563f3d9343f3b91e6ad4c094d282922214": (
        "end_of_sprint_6: Sprint 6 close — retro, architecture health, board reconcile, DB schema reporting"
    ),
    "892ad94d9e1f51349d1124a2096a004d08eb0b4e": (
        "end_of_sprint_7: Sprint 7 close — retro, architecture health, board reconcile"
    ),
    "fb3bb8bed472e42c699dacdf720c135efd3fb5b8": (
        "end_of_sprint_8: Close Sprint 8 with retro, architecture health report, and board reconcile"
    ),
    "50fb16d7a7af7fb156a05e4a6907b1164ab9b176": (
        "end_of_sprint_9: Close Sprint 9 with retro, health report, and board script batch"
    ),
    "8272dd35ff62baf919cd37283f76e729fd2a300a": (
        "end_of_sprint_10: Close Sprint 10 with retro, health report, and README status"
    ),
    "4140952d8a3e4955c5097b7e76934340b5f93f36": (
        "end_of_sprint_11: Close Sprint 11 with retro, health report, and README status"
    ),
    "15a2df2cb3ccfc3c9ba7feaa53c9ed663d11e2f8": (
        "end_of_sprint_12: Close Sprint 12 with release checklist, retro, and health report"
    ),
}


def main() -> None:
    commit = os.environ.get("GIT_COMMIT", "")
    original = sys.stdin.read()
    replacement = SPRINT_CLOSE_SUBJECTS.get(commit)
    if replacement is None:
        sys.stdout.write(original)
        return

    # Preserve multi-paragraph bodies (e.g. trailers) while replacing the subject line.
    if "\n\n" in original:
        _, rest = original.split("\n\n", 1)
        sys.stdout.write(f"{replacement}\n\n{rest}")
    else:
        first_line, _, rest = original.partition("\n")
        if rest:
            sys.stdout.write(f"{replacement}\n{rest}")
        else:
            sys.stdout.write(replacement)


if __name__ == "__main__":
    main()
