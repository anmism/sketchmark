# Hub And Spoke

Use when

- one central system or actor connects to many satellites
- the main message is coordination, integration, or fan-out
- the center matters more than the order of satellites

Build with

- `diagram layout=absolute` for clean radial placement
- one central `circle` or `box`
- satellites as `box`, `cylinder`, `note`, or `icon`
- direct edges between each satellite and the hub

Prefer

- 4 to 8 satellites
- a larger center node than the surrounding leaves
- short labels so the ring stays readable

Avoid

- chaining satellites together unless the story truly includes a sequence
- mixing several equally important centers in one hub layout

Example

```text
diagram layout=absolute margin=24
circle hub x=220 y=130 width=120 height=120 label="Platform"
box auth x=40 y=70 label="Auth"
box billing x=390 y=70 label="Billing"
cylinder data x=230 y=10 label="Data"
box alerts x=230 y=300 label="Alerts"
box search x=40 y=250 label="Search"
box crm x=390 y=250 label="CRM"
auth --> hub
billing --> hub
data --> hub
hub --> alerts
search --> hub
crm --> hub
end
```
