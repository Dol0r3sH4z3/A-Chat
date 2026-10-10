export type VirtualNode = DirectoryNode | FileNode;
interface DirectoryNode {
  children: Record<string, VirtualNode>;
  name: string;
  type: "directory";
}

interface FileNode {
  content?: string;
  fileKind: "program" | "text";
  name: string;
  type: "file";
}
