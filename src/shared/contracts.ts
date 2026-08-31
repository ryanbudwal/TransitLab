import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const entityCode = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, underscores, or hyphens.");

export const algorithmSchema = z.enum(["DIJKSTRA", "ASTAR"]);
export const preferenceSchema = z.enum([
  "FASTEST",
  "FEWEST_TRANSFERS",
  "ACCESSIBLE",
]);

export const disruptionsSchema = z
  .object({
    closedStationIds: z.array(id).max(100).default([]),
    suspendedLineIds: z.array(id).max(30).default([]),
    lineDelays: z.record(id, z.number().int().min(0).max(120)).default({}),
  })
  .strict();

const routeRequestObject = z
  .object({
    networkId: id,
    originStationId: id,
    destinationStationId: id,
    algorithm: algorithmSchema.default("ASTAR"),
    preference: preferenceSchema.default("FASTEST"),
    transferPenaltyMinutes: z.number().int().min(0).max(30).optional(),
    disruptions: disruptionsSchema.default({
      closedStationIds: [],
      suspendedLineIds: [],
      lineDelays: {},
    }),
  })
  .strict();

export const routeRequestSchema = routeRequestObject.superRefine(
  (value, context) => {
    if (value.originStationId === value.destinationStationId) {
      context.addIssue({
        code: "custom",
        path: ["destinationStationId"],
        message:
          "Origin and destination must be different for an API route calculation.",
      });
    }
  },
);

const scenarioInputObject = z
  .object({
    networkId: id,
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).default(""),
    originStationId: id,
    destinationStationId: id,
    algorithm: algorithmSchema,
    preference: preferenceSchema,
    transferPenaltyMinutes: z.number().int().min(0).max(30),
    disruptions: disruptionsSchema,
  })
  .strict();

export const scenarioInputSchema = scenarioInputObject.refine(
  (value) => value.originStationId !== value.destinationStationId,
  {
    path: ["destinationStationId"],
    message: "Origin and destination must be different.",
  },
);

export const scenarioPatchSchema = scenarioInputObject
  .omit({ networkId: true })
  .partial()
  .refine(
    (value) =>
      !value.originStationId ||
      !value.destinationStationId ||
      value.originStationId !== value.destinationStationId,
    {
      path: ["destinationStationId"],
      message: "Origin and destination must be different.",
    },
  );

export const savedRouteInputSchema = routeRequestObject
  .extend({ name: z.string().trim().min(2).max(80), scenarioId: id.optional() })
  .refine((value) => value.originStationId !== value.destinationStationId, {
    path: ["destinationStationId"],
    message: "Origin and destination must be different.",
  });

const importLineSchema = z
  .object({
    code: entityCode,
    name: z.string().trim().min(1).max(80),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color such as #2a9d8f."),
  })
  .strict();

const importStationSchema = z
  .object({
    code: entityCode,
    name: z.string().trim().min(1).max(100),
    x: z.number().finite().min(-10000).max(10000),
    y: z.number().finite().min(-10000).max(10000),
    accessible: z.boolean(),
  })
  .strict();

const importConnectionSchema = z
  .object({
    from: entityCode,
    to: entityCode,
    line: entityCode,
    travelMinutes: z.number().int().min(1).max(240),
    bidirectional: z.boolean(),
    accessible: z.boolean(),
  })
  .strict();

export const networkImportSchema = z
  .object({
    schemaVersion: z.literal(1),
    network: z
      .object({
        name: z.string().trim().min(2).max(100),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Use a lowercase kebab-case slug.",
          ),
        description: z.string().trim().min(1).max(500),
        transferPenaltyMinutes: z.number().int().min(0).max(30),
      })
      .strict(),
    lines: z.array(importLineSchema).min(1).max(30),
    stations: z.array(importStationSchema).min(2).max(500),
    connections: z.array(importConnectionSchema).min(1).max(2000),
  })
  .strict()
  .superRefine((value, context) => {
    const stationCodes = new Set<string>();
    value.stations.forEach((station, index) => {
      if (stationCodes.has(station.code))
        context.addIssue({
          code: "custom",
          path: ["stations", index, "code"],
          message: `Duplicate station code ${station.code}.`,
        });
      stationCodes.add(station.code);
    });
    const lineCodes = new Set<string>();
    value.lines.forEach((line, index) => {
      if (lineCodes.has(line.code))
        context.addIssue({
          code: "custom",
          path: ["lines", index, "code"],
          message: `Duplicate line code ${line.code}.`,
        });
      lineCodes.add(line.code);
    });
    const connections = new Set<string>();
    value.connections.forEach((connection, index) => {
      if (!stationCodes.has(connection.from))
        context.addIssue({
          code: "custom",
          path: ["connections", index, "from"],
          message: `Unknown station code ${connection.from}.`,
        });
      if (!stationCodes.has(connection.to))
        context.addIssue({
          code: "custom",
          path: ["connections", index, "to"],
          message: `Unknown station code ${connection.to}.`,
        });
      if (!lineCodes.has(connection.line))
        context.addIssue({
          code: "custom",
          path: ["connections", index, "line"],
          message: `Unknown line code ${connection.line}.`,
        });
      if (connection.from === connection.to)
        context.addIssue({
          code: "custom",
          path: ["connections", index],
          message: "Connections cannot be self-loops.",
        });
      const key = `${connection.from}|${connection.to}|${connection.line}`;
      const reverseKey = `${connection.to}|${connection.from}|${connection.line}`;
      if (
        connections.has(key) ||
        (connection.bidirectional && connections.has(reverseKey))
      ) {
        context.addIssue({
          code: "custom",
          path: ["connections", index],
          message: "Duplicate connection for the same stations and line.",
        });
      }
      connections.add(key);
    });
  });

export type RouteRequestInput = z.infer<typeof routeRequestSchema>;
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
export type ScenarioPatch = z.infer<typeof scenarioPatchSchema>;
export type SavedRouteInput = z.infer<typeof savedRouteInputSchema>;
export type NetworkImportInput = z.infer<typeof networkImportSchema>;
