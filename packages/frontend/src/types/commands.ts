import { z } from "zod";

export const CommandSchema = z.enum(["rm", "bash", "ls", "sh", "cat", "wipe", "help", "pwd", "tree", "cd", "clear"]);
export type Command = z.infer<typeof CommandSchema>;
