# Cycle And Loop

Use when

- the process repeats
- feedback returns to an earlier stage
- the diagram should feel continuous instead of terminal

Build with

- `diagram layout=absolute`
- 4 to 6 nodes placed around an empty center
- circular or square-loop edge routing
- an optional center `text` node for the loop name

Prefer

- short labels
- even spacing around the ring
- one clear reading direction

Avoid

- large paragraphs inside the cycle nodes
- too many nodes, which turns the ring into clutter

Example

```text
diagram layout=absolute margin=20
circle plan x=220 y=20 label="Plan"
circle build x=400 y=160 label="Build"
circle measure x=220 y=300 label="Measure"
circle learn x=40 y=160 label="Learn"
text center label="Feedback Loop" x=180 y=155 width=160 height=40 font-size=18
plan --> build
build --> measure
measure --> learn
learn --> plan
end
```
