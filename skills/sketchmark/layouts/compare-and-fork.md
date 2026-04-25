# Compare And Fork

Use when

- the viewer should compare two options or states side by side
- a single decision splits into two or three tracks
- symmetry or contrast is part of the message

Build with

- root `diagram layout=column` if you need a shared starting point above the split
- one `bare` container with `layout=row` for the compared tracks
- matching `group` structures inside each side when doing before and after
- a `diamond` above the branches when the split is caused by a decision

Prefer

- mirrored spacing between tracks
- no more than three branches in the main fork
- clear labels on each branch or column

Avoid

- uneven branches that make one side feel accidental
- using compare layout for a simple linear story

Example

```text
diagram layout=column gap=24 margin=32
text header label="Release Paths" width=220 font-size=24
diamond gate label="Urgent?"
box fast label="Fast Lane"
box safe label="Review Lane"
cylinder log label="Audit Log"
bare branches layout=row gap=44 items=[fast,safe]
gate --> fast label="yes"
gate --> safe label="no"
fast --> log
safe --> log
end
```
