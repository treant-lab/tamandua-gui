import { useCallback, useState, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Image,
  Video,
  Music,
  Archive,
  FileWarning,
  Settings,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import type { FileEntry, FileType } from '@/hooks/useFileBrowser';
import { useFileList } from '@/hooks/useFileBrowser';

interface TreeNode extends FileEntry {
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  children: TreeNode[];
}

interface FileTreeProps {
  rootPath: string;
  selectedFiles: Set<string>;
  onSelect: (path: string, additive: boolean) => void;
  onNavigate: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, files: FileEntry[]) => void;
  showHidden?: boolean;
  height: number;
}

function getFileIcon(fileType: FileType, isExpanded: boolean = false, className?: string) {
  const iconClass = cn('w-4 h-4 shrink-0', className);

  switch (fileType) {
    case 'folder':
      return isExpanded
        ? <FolderOpen className={cn(iconClass, 'text-yellow-500')} />
        : <Folder className={cn(iconClass, 'text-yellow-500')} />;
    case 'document':
      return <FileText className={cn(iconClass, 'text-blue-400')} />;
    case 'code':
      return <FileCode className={cn(iconClass, 'text-green-400')} />;
    case 'image':
      return <Image className={cn(iconClass, 'text-purple-400')} />;
    case 'video':
      return <Video className={cn(iconClass, 'text-pink-400')} />;
    case 'audio':
      return <Music className={cn(iconClass, 'text-orange-400')} />;
    case 'archive':
      return <Archive className={cn(iconClass, 'text-amber-400')} />;
    case 'executable':
      return <FileWarning className={cn(iconClass, 'text-red-400')} />;
    case 'config':
      return <Settings className={cn(iconClass, 'text-cyan-400')} />;
    case 'data':
      return <Database className={cn(iconClass, 'text-indigo-400')} />;
    default:
      return <File className={cn(iconClass, 'text-gray-400')} />;
  }
}

// Recursive component for a single tree node
interface TreeNodeRowProps {
  node: TreeNode;
  selectedFiles: Set<string>;
  expandedPaths: Set<string>;
  onSelect: (path: string, additive: boolean) => void;
  onToggleExpand: (path: string) => void;
  onNavigate: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, files: FileEntry[]) => void;
  style?: React.CSSProperties;
}

function TreeNodeRow({
  node,
  selectedFiles,
  expandedPaths,
  onSelect,
  onToggleExpand,
  onNavigate,
  onContextMenu,
  style,
}: TreeNodeRowProps) {
  const isSelected = selectedFiles.has(node.path);
  const isExpanded = expandedPaths.has(node.path);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onSelect(node.path, event.ctrlKey || event.metaKey);
    },
    [node.path, onSelect]
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (node.is_directory) {
        onNavigate(node.path);
      }
    },
    [node.is_directory, node.path, onNavigate]
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!isSelected) {
        onSelect(node.path, false);
      }
      onContextMenu(event, [node]);
    },
    [node, isSelected, onSelect, onContextMenu]
  );

  const handleExpandClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (node.is_directory) {
        onToggleExpand(node.path);
      }
    },
    [node.is_directory, node.path, onToggleExpand]
  );

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      onSelect(node.path, true);
    },
    [node.path, onSelect]
  );

  return (
    <div
      style={style}
      className={cn(
        'flex items-center px-2 py-1 cursor-pointer transition-colors border-b border-gray-700/30',
        isSelected
          ? 'bg-primary-900/40 border-l-2 border-l-primary-500'
          : 'hover:bg-gray-700/50'
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Indentation */}
      <div style={{ width: node.depth * 16 }} className="shrink-0" />

      {/* Expand/Collapse Toggle */}
      <button
        onClick={handleExpandClick}
        className={cn(
          'w-5 h-5 flex items-center justify-center shrink-0 mr-1',
          node.is_directory ? 'text-gray-400 hover:text-white' : 'text-transparent pointer-events-none'
        )}
        tabIndex={-1}
      >
        {node.is_directory && (
          isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Checkbox */}
      <div className="mr-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          className="border-gray-500 data-[state=checked]:bg-primary-600"
        />
      </div>

      {/* Icon */}
      <div className="mr-2 shrink-0">
        {getFileIcon(node.file_type, isExpanded)}
      </div>

      {/* Name */}
      <span
        className={cn(
          'flex-1 truncate text-sm',
          node.is_hidden ? 'text-gray-500' : 'text-gray-200'
        )}
      >
        {node.name}
      </span>

      {/* Loading indicator */}
      {node.isLoading && (
        <div className="ml-2 shrink-0">
          <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

export function FileTree({
  rootPath,
  selectedFiles,
  onSelect,
  onNavigate,
  onContextMenu,
  showHidden = false,
  height,
}: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([rootPath]));

  const { data: rootData, isLoading: rootLoading } = useFileList(rootPath, { showHidden });

  // Build flat list of visible nodes
  const flattenedNodes = useMemo(() => {
    if (!rootData?.entries) return [];

    const nodes: TreeNode[] = [];

    function addNodes(entries: FileEntry[], depth: number) {
      for (const entry of entries) {
        const isExpanded = expandedPaths.has(entry.path);
        nodes.push({
          ...entry,
          depth,
          isExpanded,
          isLoading: false,
          children: [],
        });
      }
    }

    addNodes(rootData.entries, 0);
    return nodes;
  }, [rootData?.entries, expandedPaths]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const node = flattenedNodes[index];
      return (
        <TreeNodeRow
          key={node.path}
          node={node}
          selectedFiles={selectedFiles}
          expandedPaths={expandedPaths}
          onSelect={onSelect}
          onToggleExpand={toggleExpand}
          onNavigate={onNavigate}
          onContextMenu={onContextMenu}
          style={style}
        />
      );
    },
    [flattenedNodes, selectedFiles, expandedPaths, onSelect, toggleExpand, onNavigate, onContextMenu]
  );

  if (rootLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading files...</p>
        </div>
      </div>
    );
  }

  if (!flattenedNodes.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <Folder className="w-12 h-12 text-gray-600" />
          <p className="text-sm">This folder is empty</p>
        </div>
      </div>
    );
  }

  return (
    <List
      height={height}
      itemCount={flattenedNodes.length}
      itemSize={32}
      width="100%"
      className="scrollbar-thin"
    >
      {Row}
    </List>
  );
}
