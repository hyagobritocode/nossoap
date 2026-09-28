import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectLink } from "../src/link.js";

test("não abre endereços internos nem outros protocolos", async () => {
  await assert.rejects(inspectLink("http://127.0.0.1:8080/admin"), /interno/);
  await assert.rejects(inspectLink("http://192.168.0.1/"), /interno/);
  await assert.rejects(inspectLink("http://[::1]/"), /interno/);
  await assert.rejects(inspectLink("file:///etc/passwd"), /http/);
});
