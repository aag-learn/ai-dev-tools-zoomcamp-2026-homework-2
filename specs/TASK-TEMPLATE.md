# Task Specification Template

> When the pm subagent grooms a backlog item, it prepends a small
> `issue`/`label` frontmatter block above this content automatically — you
> don't need to add one when filling this out by hand.

Fill in every section below. If a section genuinely doesn't apply, write
`None` rather than deleting it — a missing section should never be
ambiguous between "not applicable" and "forgot to fill in."

## Summary

One or two sentences: what is being built and why.

## Scope

What this change includes, stated concretely enough that someone could
check a box next to each item.

## Out of scope

What this change explicitly excludes. If something is deferred rather than
dropped, name the follow-up task (or note that one needs to be filed).

## Acceptance criteria

Numbered, checkable conditions. Each one should be verifiable by running a
command, checking a specific output, or inspecting a specific file or
behavior — something someone could point at and say yes or no to, not a
subjective judgment call.

1. ...
2. ...

## Edge cases considered

Cases the original request didn't mention but that matter here — the
things the person who filed the request likely didn't think to specify.

## Constraints

Performance, security, compatibility, or style constraints that apply to
this change specifically.

## Open questions

Anything genuinely ambiguous that needs a human decision before
implementation starts. Write `None` if there aren't any — don't leave this
section out just because it's empty.
