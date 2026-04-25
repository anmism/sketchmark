# Tiers And Lanes

Use when

- the diagram has layers such as client, service, and data
- responsibilities belong in horizontal bands or stacked sections
- the story is about boundaries and handoffs across layers

Build with

- root `diagram layout=column`
- one stacked `bare` container with `layout=column`
- a visible `group` per lane or tier
- `layout=row` inside each lane so peer items align naturally

Prefer

- one label per lane instead of repeating the same role on every node
- consistent gaps and padding so the bands read as a system
- edges that mostly move between adjacent lanes

Avoid

- turning every lane into a separate freeform scene
- packing too many tiny nodes into one band

Example

```text
diagram layout=column gap=20 margin=32
text header label="Platform Stack" width=240 font-size=24
box web label="Web App"
box mobile label="Mobile App"
box api label="API"
box worker label="Worker"
cylinder db label="Postgres"
cylinder cache label="Redis"
group clients label="Clients" layout=row gap=20 padding=18 items=[web,mobile]
group services label="Services" layout=row gap=20 padding=18 items=[api,worker]
group data label="Data" layout=row gap=20 padding=18 items=[db,cache]
bare stack layout=column gap=18 items=[clients,services,data]
web --> api
mobile --> api
api --> worker
api --> db
worker --> cache
end
```
