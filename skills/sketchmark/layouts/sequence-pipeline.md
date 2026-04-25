# Sequence And Pipeline

Use when

- the viewer should read left to right or top to bottom
- stages are ordered and usually few enough to scan in one pass
- the main idea is movement, handoff, or progression

Build with

- root `diagram layout=column` if you want a heading or legend above the flow
- one `bare` or `group` container with `layout=row` for the main stages
- leaf primitives such as `box`, `diamond`, `cylinder`, and `text`
- mostly horizontal edges between neighbors

Prefer

- 3 to 7 main stages
- one decision node at a time
- storage or external systems at the ends or just below the main row

Avoid

- mixing satellites and stages in the same primary row
- switching to `layout=absolute` unless the path geometry itself matters

Example

```text
diagram layout=column gap=24 margin=32
text header label="Order Flow" width=220 font-size=24
box browse label="Browse"
diamond stock label="In stock?"
box pay label="Checkout"
cylinder db label="Inventory"
bare stages layout=row gap=32 items=[browse,stock,pay,db]
browse --> stock
stock --> pay label="yes"
stock --> db label="lookup"
pay --> db label="reserve"
end
```
