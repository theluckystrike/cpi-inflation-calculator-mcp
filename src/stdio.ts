#!/usr/bin/env node
// Local stdio entry: npx -y github:theluckystrike/cpi-inflation-calculator-mcp
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./tools.js";
import { setBlsKey } from "./live.js";

setBlsKey(process.env.BLS_API_KEY);

const server = createServer();
await server.connect(new StdioServerTransport());
