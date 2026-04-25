# Grid And Matrix

Use when

- the diagram is mostly a set of peers
- comparison matters more than sequence
- the viewer should scan by rows, columns, or repeated cards

Build with

- root `diagram layout=column`
- one `bare` or `group` container with `layout=grid`
- `columns` chosen from the number of items and desired density
- repeated leaf primitives with consistent width and height

Prefer

- 2 to 4 columns
- short labels and consistent shapes
- a heading or legend above the grid instead of inside every card

Avoid

- using a grid when one item is clearly more important than the others
- forcing connector-heavy diagrams into a matrix

Example

```text
diagram layout=column gap=24 margin=32
text header label="Service Catalog" width=260 font-size=24
box web label="Web"
box api label="API"
box worker label="Worker"
cylinder pg label="Postgres"
cylinder redis label="Redis"
box search label="Search"
bare catalog layout=grid columns=3 gap=20 items=[web,api,worker,pg,redis,search]
end
```
