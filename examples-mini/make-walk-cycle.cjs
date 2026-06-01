const fps = 30;
const duration = 2;

function line(id, x1, y1, x2, y2, stroke = "#222222", strokeWidth = 6) {
  return {
    id,
    type: "path",
    d: `M ${x1} ${y1} L ${x2} ${y2}`,
    stroke,
    strokeWidth,
    strokeCap: "round",
    strokeJoin: "round",
    fill: "none"
  };
}

function circle(id, cx, cy, r, stroke = "#222222", strokeWidth = 6) {
  return {
    id,
    type: "path",
    d: `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`,
    stroke,
    strokeWidth,
    fill: "none"
  };
}

function limb(id, x, y, upperLen, lowerLen, upperAngle, lowerAngle, stroke = "#222222", strokeWidth = 6) {
  return {
    id,
    type: "group",
    x,
    y,
    children: [
      {
        id: `${id}.bone`,
        type: "group",
        x: 0,
        y: 0,
        origin: [0, 0],
        timeline: {
          tracks: {
            rotation: {
              keyframes: [
                { time: 0, value: upperAngle },
                { time: 0.5, value: -upperAngle },
                { time: 1, value: upperAngle },
                { time: 1.5, value: -upperAngle },
                { time: 2, value: upperAngle }
              ]
            }
          }
        },
        children: [
          line(`${id}.upper.line`, 0, 0, 0, upperLen, stroke, strokeWidth),
          {
            id: `${id}.lower`,
            type: "group",
            x: 0,
            y: upperLen,
            origin: [0, 0],
            timeline: {
              tracks: {
                rotation: {
                  keyframes: [
                    { time: 0, value: lowerAngle },
                    { time: 0.5, value: -lowerAngle },
                    { time: 1, value: lowerAngle },
                    { time: 1.5, value: -lowerAngle },
                    { time: 2, value: lowerAngle }
                  ]
                }
              }
            },
            children: [line(`${id}.lower.line`, 0, 0, 0, lowerLen, stroke, strokeWidth)]
          }
        ]
      }
    ]
  };
}

const doc = {
  version: 1,
  canvas: {
    width: 960,
    height: 540,
    duration,
    fps,
    background: "#f7f3ea"
  },
  elements: [
    {
      id: "ground",
      type: "path",
      d: "M 160 420 L 800 420",
      stroke: "#d4c8b8",
      strokeWidth: 8,
      strokeCap: "round",
      fill: "none"
    },
    {
      id: "stickman",
      type: "group",
      x: 240,
      y: 0,
      timeline: {
        tracks: {
          position: {
            keyframes: [
              { time: 0, value: [240, 0] },
              { time: 0.5, value: [360, 0] },
              { time: 1, value: [480, 0] },
              { time: 1.5, value: [600, 0] },
              { time: 2, value: [720, 0] }
            ]
          }
        }
      },
      children: [
        {
          id: "stickman.body",
          type: "group",
          x: 0,
          y: 0,
          origin: [0, 0],
          timeline: {
            tracks: {
              y: {
                keyframes: [
                  { time: 0, value: 0 },
                  { time: 0.25, value: -4 },
                  { time: 0.5, value: 0 },
                  { time: 0.75, value: -4 },
                  { time: 1, value: 0 },
                  { time: 1.25, value: -4 },
                  { time: 1.5, value: 0 },
                  { time: 1.75, value: -4 },
                  { time: 2, value: 0 }
                ]
              }
            }
          },
          children: [
            circle("stickman.head", 0, 280, 22),
            line("stickman.neck", 0, 302, 0, 312, "#222222", 6),
            line("stickman.spine", 0, 312, 0, 360, "#222222", 6),
            limb("stickman.armFront", 2, 316, 28, 22, 24, -12, "#222222", 6),
            limb("stickman.armBack", -2, 316, 28, 22, -24, 12, "#222222", 6),
            limb("stickman.legFront", 2, 360, 34, 26, -20, 14, "#222222", 6),
            limb("stickman.legBack", -2, 360, 34, 26, 20, -14, "#222222", 6)
          ]
        }
      ]
    }
  ]
};

module.exports = doc;
