# Branch cleanup review — 2026-10-03

Fetched origin with pruning and inspected commit ancestry, full tree identity and
the divergent branch's aggregate changes. Remote deletion and pushes require the
user's confirmation. The approved deletion was subsequently completed as recorded below.

| Branch | Behind origin/dev | Ahead | Decision |
| --- | ---: | ---: | --- |
| dev | 0 | 0 | Keep as the primary development branch and GitHub default. |
| release | 2 | 0 | Keep for release preparation. Its two missing commits are README/release-note documentation; no immediate merge is necessary. |
| docs/readme-en-vi | 58 | 0 | Safe deletion candidate: all commits are ancestors of dev. |
| copilot/fix-build-windows-job | 10 | 1 | Safe deletion candidate: ea03c77 is an empty Initial plan commit; its tree equals its parent's tree. |
| fix/stability-vietnamese | 57 | 32 | Safe deletion candidate: its entire tree exactly matches 5f58f4e, which is an ancestor of dev. Its changes were integrated under a different commit history. |

`git cherry` marks all 32 Vietnamese-branch commits as unique because the
individual patches differ from the combined commit. That alone would be an
incorrect reason to merge or preserve it forever. The decisive check was an empty
`git diff origin/fix/stability-vietnamese 5f58f4e`, followed by successful
`git merge-base --is-ancestor 5f58f4e origin/dev`.

Remote codex/fix-windows-runtime and feat/android-mvp were already absent when
this review fetched origin. Fetch removed only stale remote-tracking refs.
The local codex/fix-windows-runtime branch still contains the ten stability and
dependency follow-up commits beyond dev, plus this review's documentation commit.
Keep it until those changes are integrated and verified on hosted CI.

A verified `git bundle create --all` backup is stored outside the checkout in
`C:/Users/Lynx/Documents/ChatGPT/R3PLAY-branch-backups/`. It preserves all current
local and fetched remote refs, including the original divergent history, and can
be cloned or fetched to recover deleted branches. It does not include uncommitted
UI edits or untracked files. Those working-tree files have not been modified.

## Proposed operation

After explicit confirmation, delete exactly these remote branches, using leases
against the reviewed tips so concurrent changes are not removed:

- docs/readme-en-vi at e2359a6
- copilot/fix-build-windows-job at ea03c77
- fix/stability-vietnamese at cabd834

Keep dev and release. No force-push of commit history, bulk merge or version bump.
Integrating the local stability branch is a separate operation from deleting old
branches, and should preserve the existing logical commits and run hosted checks.

Ongoing workflow: use dev for development, short-lived branches for individual
changes, release only when preparing a release, and matching version tags for the
Windows publishing workflow. Remove feature branches after their content has been
integrated, using ancestry or tree/patch comparisons rather than names alone.

## Approved cleanup completed

The user confirmed deletion on 2026-10-03. An atomic push deleted exactly the
three reviewed branches, with explicit force-with-lease checks against their full
reviewed commit IDs. GitHub accepted all three deletions. A subsequent fetch and
`git ls-remote --heads origin` confirmed only dev and release remain remotely,
unchanged at 52bc0ee and 2db3303 respectively.

No local stability commits were pushed, and no tag or Release was created.
The working-tree UI edits and untracked files remain untouched. Verified recovery
backup: C:/Users/Lynx/Documents/ChatGPT/R3PLAY-branch-backups/R3PLAY-before-branch-cleanup-20261003-102318.bundle.
