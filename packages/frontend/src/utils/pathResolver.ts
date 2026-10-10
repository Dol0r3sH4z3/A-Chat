import type { VirtualNode } from "@/types/virtualFs.ts";

export function buildTreeString(node: VirtualNode, prefix = "", isRoot = true): string {
  if (node.type !== "directory") return "";

  const entries = Object.values(node.children);
  let result = isRoot ? "/\n" : "";

  //eslint-disable-next-line unicorn/no-for-each
  entries.forEach((child, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? " ".repeat(4) : "│   ";

    result += `${prefix}${connector}${child.name}${child.type === "directory" ? "/" : ""}\n`;

    if (child.type === "directory") {
      result += buildTreeString(child, prefix + childPrefix, false);
    }
  });

  return result;
}

export function getNodeAtPath(root: VirtualNode, segments: string[]): undefined | VirtualNode {
  let current: VirtualNode = root;

  for (const segment of segments) {
    if (current.type !== "directory") return undefined;
    const next = current.children[segment];
    if (!next) return undefined;
    current = next;
  }

  return current;
}

export function pathToString(segments: string[]): string {
  return "/" + segments.join("/");
}

export function removeNodeAtPath(root: VirtualNode, segments: string[]): VirtualNode {
  if (segments.length === 0 || root.type !== "directory") return root;

  const [head, ...rest] = segments;
  if (head === undefined) return root;
  const child = root.children[head];
  if (!child) return root;

  if (rest.length === 0) {
    //eslint-disable-next-line sonarjs/no-unused-vars
    const { [head]: _removed, ...remainingChildren } = root.children;
    return { ...root, children: remainingChildren };
  }

  return {
    ...root,
    children: {
      ...root.children,
      [head]: removeNodeAtPath(child, rest),
    },
  };
}

export function resolvePath(cwd: string[], input: string): string[] {
  const isAbsolute = input.startsWith("/");
  const base = isAbsolute ? [] : [...cwd];

  const parts = input.split("/").filter((part) => part !== "" && part !== ".");

  for (const part of parts) {
    if (part === "..") {
      base.pop();
    } else {
      base.push(part);
    }
  }

  return base;
}
