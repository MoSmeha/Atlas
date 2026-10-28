/** Text the agent loop sends the model. Short and direct so that small models follow it too. */
export const agentMessages = {
  nudge: (submitTool: string) => `Call ${submitTool} with your final answer.`,
  lastRound: (submitTool: string) =>
    `This was the last round of tool calls. You must answer now: call ${submitTool} with your final answer, ` +
    'and if the evidence is incomplete, say what is missing.',
  invalidJson: (detail: string) => `The arguments were not valid JSON: ${detail}`,
  invalidArguments: (details: string) => `Invalid arguments: ${details}; fix them and call again.`,
  repeated: (tool: string) => `You already called ${tool} with these arguments; reuse the earlier result.`,
  unknownTool: (name: string, known: string[]) => `There is no tool named ${name}. Use one of: ${known.join(', ')}.`,
  toolFailed: (message: string) => `The tool failed: ${message}`,
  truncated: (shown: number, total: number) =>
    `[Output truncated: this is the first ${shown} of ${total} characters. Narrow the request, for example ` +
    'fewer pages, one document, fewer columns, a WHERE filter or a LIMIT, and call again.]',
};
