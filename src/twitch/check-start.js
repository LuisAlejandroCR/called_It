import { checkConfiguration } from './check.js';
const result = await checkConfiguration(process.env);
console.log(result.message);
if (!result.ok) process.exitCode = 1;
