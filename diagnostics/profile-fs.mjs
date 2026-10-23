import * as fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
let observations = {};
export const resetProfile = () => { observations = {}; };
export const readProfile = () => structuredClone(observations);
const measured = (name) => async (...args) => {
 const start = performance.now();
 try { return await fs[name](...args); }
 finally { (observations[name] ??= []).push(performance.now() - start); }
};
export const appendFile = measured("appendFile");
export const chmod = measured("chmod");
export const mkdir = measured("mkdir");
export const stat = measured("stat");
