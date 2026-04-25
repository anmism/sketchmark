# Absolute Canvas

Use when

- spatial placement carries meaning
- the diagram is a map, freeform network, cluster map, or topology
- an official plugin requires `diagram layout=absolute`

Build with

- root `diagram layout=absolute`
- local clusters as `group ... layout=absolute`
- leaf primitives placed with `x` and `y` only after the cluster boxes are decided
- edges after the clusters and nodes already sit in stable positions

Prefer

- cluster-first composition
- `margin=0` only when you need precise authored coordinates
- small label offsets instead of large coordinate rewrites

Avoid

- using absolute placement for ordinary pipelines or layer stacks
- positioning every node one by one before deciding the cluster skeleton

Example

```text
diagram layout=absolute margin=0
box browser x=40 y=140 label="Browser"
box worker x=720 y=140 label="Worker"
group edge label="Edge" layout=absolute x=200 y=70 padding=18 items=[cdn,gateway]
box cdn x=20 y=20 label="CDN"
box gateway x=20 y=110 label="Gateway"
group core label="Core" layout=absolute x=470 y=70 padding=18 items=[service,db]
box service x=20 y=20 label="Service"
cylinder db x=20 y=110 label="Postgres"
browser --> gateway label="HTTPS"
gateway --> service
service --> db
service --> worker
end
```
