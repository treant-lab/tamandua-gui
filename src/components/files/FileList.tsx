import { useCallback, useMemo } from 'react';
import { FixedSizeList as List, FixedSizeGrid as Grid } from 'react-window';
import {
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
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import type { FileEntry, FileType, ViewMode, SortField, SortOrder } from '@/hooks/useFileBrowser';

interface FileListProps {
  files: FileEntry[];
  selectedFiles: Set<string>;
  onSelect: (path: string, additive: boolean) => void;
  onNavigate: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, files: FileEntry[]) => void;
  onShowProperties: (path: string) => void;
  viewMode: ViewMode;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  height: number;
  width: number;
  isLoading?: boolean;
}

function getFileIcon(fileType: FileType, className?: string) {
  const iconClass = cn('shrink-0', className);

  switch (fileType) {
    case 'folder':
      return <Folder className={cn(iconClass, 'text-yellow-500')} />;
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  currentOrder: SortOrder;
  onSort: (field: SortField) => void;
  className?: string;
}

function SortHeader({ label, field, currentField, currentOrder, onSort, className }: SortHeaderProps) {
  const isActive = currentField === field;

  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors',
        isActive && 'text-primary-400',
        className
      )}
    >
      <span>{label}</span>
      {isActive && (
        currentOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );
}

// List View Row
interface ListRowProps {
  file: FileEntry;
  isSelected: boolean;
  onSelect: (path: string, additive: boolean) => void;
  onNavigate: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, files: FileEntry[]) => void;
  onShowProperties: (path: string) => void;
  style: React.CSSProperties;
}

function ListRow({
  file,
  isSelected,
  onSelect,
  onNavigate,
  onContextMenu,
  onShowProperties,
  style,
}: ListRowProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      onSelect(file.path, event.ctrlKey || event.metaKey);
    },
    [file.path, onSelect]
  );

  const handleDoubleClick = useCallback(() => {
    if (file.is_directory) {
      onNavigate(file.path);
    } else {
      onShowProperties(file.path);
    }
  }, [file, onNavigate, onShowProperties]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!isSelected) {
        onSelect(file.path, false);
      }
      onContextMenu(event, [file]);
    },
    [file, isSelected, onSelect, onContextMenu]
  );

  const handleCheckboxChange = useCallback(() => {
    onSelect(file.path, true);
  }, [file.path, onSelect]);

  return (
    <div
      style={style}
      className={cn(
        'flex items-center px-4 gap-3 cursor-pointer transition-colors border-b border-gray-700/30',
        isSelected
          ? 'bg-primary-900/40 border-l-2 border-l-primary-500'
          : 'hover:bg-gray-700/50'
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          className="border-gray-500 data-[state=checked]:bg-primary-600"
        />
      </div>

      {/* Icon */}
      {getFileIcon(file.file_type, 'w-5 h-5')}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'truncate text-sm',
            file.is_hidden ? 'text-gray-500' : 'text-gray-200'
          )}
        >
          {file.name}
        </span>
      </div>

      {/* Size */}
      <div className="w-24 text-right text-sm text-gray-400">
        {file.is_directory ? '-' : formatBytes(file.size_bytes)}
      </div>

      {/* Modified */}
      <div className="w-40 text-right text-sm text-gray-400">
        {formatDate(file.modified_at)}
      </div>

      {/* Type */}
      <div className="w-24 text-right text-sm text-gray-500 capitalize">
        {file.is_directory ? 'Folder' : file.extension || 'File'}
      </div>
    </div>
  );
}

// Grid View Cell
interface GridCellProps {
  file: FileEntry;
  isSelected: boolean;
  onSelect: (path: string, additive: boolean) => void;
  onNavigate: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, files: FileEntry[]) => void;
  onShowProperties: (path: string) => void;
  style: React.CSSProperties;
}

function GridCell({
  file,
  isSelected,
  onSelect,
  onNavigate,
  onContextMenu,
  onShowProperties,
  style,
}: GridCellProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      onSelect(file.path, event.ctrlKey || event.metaKey);
    },
    [file.path, onSelect]
  );

  const handleDoubleClick = useCallback(() => {
    if (file.is_directory) {
      onNavigate(file.path);
    } else {
      onShowProperties(file.path);
    }
  }, [file, onNavigate, onShowProperties]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      if (!isSelected) {
        onSelect(file.path, false);
      }
      onContextMenu(event, [file]);
    },
    [file, isSelected, onSelect, onContextMenu]
  );

  const handleCheckboxChange = useCallback(() => {
    onSelect(file.path, true);
  }, [file.path, onSelect]);

  return (
    <div style={style} className="p-2">
      <div
        className={cn(
          'relative flex flex-col items-center p-3 rounded-lg cursor-pointer transition-all',
          isSelected
            ? 'bg-primary-900/40 ring-2 ring-primary-500'
            : 'hover:bg-gray-700/50'
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Checkbox */}
        <div
          className="absolute top-2 left-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            className="border-gray-500 data-[state=checked]:bg-primary-600"
          />
        </div>

        {/* Icon */}
        <div className="mb-2">
          {getFileIcon(file.file_type, 'w-12 h-12')}
        </div>

        {/* Name */}
        <span
          className={cn(
            'text-xs text-center truncate w-full',
            file.is_hidden ? 'text-gray-500' : 'text-gray-200'
          )}
          title={file.name}
        >
          {file.name}
        </span>

        {/* Size for files */}
        {!file.is_directory && (
          <span className="text-xs text-gray-500 mt-1">
            {formatBytes(file.size_bytes)}
          </span>
        )}
      </div>
    </div>
  );
}

export function FileList({
  files,
  selectedFiles,
  onSelect,
  onNavigate,
  onContextMenu,
  onShowProperties,
  viewMode,
  sortField,
  sortOrder,
  onSort,
  height,
  width,
  isLoading,
}: FileListProps) {
  // List view row renderer
  const ListRowRenderer = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const file = files[index];
      return (
        <ListRow
          key={file.path}
          file={file}
          isSelected={selectedFiles.has(file.path)}
          onSelect={onSelect}
          onNavigate={onNavigate}
          onContextMenu={onContextMenu}
          onShowProperties={onShowProperties}
          style={style}
        />
      );
    },
    [files, selectedFiles, onSelect, onNavigate, onContextMenu, onShowProperties]
  );

  // Grid layout calculations
  const gridConfig = useMemo(() => {
    const cellWidth = 120;
    const cellHeight = 130;
    const columnCount = Math.max(1, Math.floor(width / cellWidth));
    const rowCount = Math.ceil(files.length / columnCount);
    return { cellWidth, cellHeight, columnCount, rowCount };
  }, [width, files.length]);

  // Grid view cell renderer
  const GridCellRenderer = useCallback(
    ({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
      const index = rowIndex * gridConfig.columnCount + columnIndex;
      if (index >= files.length) return null;

      const file = files[index];
      return (
        <GridCell
          key={file.path}
          file={file}
          isSelected={selectedFiles.has(file.path)}
          onSelect={onSelect}
          onNavigate={onNavigate}
          onContextMenu={onContextMenu}
          onShowProperties={onShowProperties}
          style={style}
        />
      );
    },
    [files, selectedFiles, onSelect, onNavigate, onContextMenu, onShowProperties, gridConfig.columnCount]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading files...</p>
        </div>
      </div>
    );
  }

  if (!files.length) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <Folder className="w-16 h-16 text-gray-600" />
          <p className="text-sm">This folder is empty</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="flex flex-col h-full">
        {/* Column Headers */}
        <div className="flex items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700 gap-3">
          <div className="w-5" /> {/* Checkbox space */}
          <div className="w-5" /> {/* Icon space */}
          <SortHeader
            label="Name"
            field="name"
            currentField={sortField}
            currentOrder={sortOrder}
            onSort={onSort}
            className="flex-1"
          />
          <SortHeader
            label="Size"
            field="size"
            currentField={sortField}
            currentOrder={sortOrder}
            onSort={onSort}
            className="w-24 justify-end"
          />
          <SortHeader
            label="Modified"
            field="modified"
            currentField={sortField}
            currentOrder={sortOrder}
            onSort={onSort}
            className="w-40 justify-end"
          />
          <SortHeader
            label="Type"
            field="type"
            currentField={sortField}
            currentOrder={sortOrder}
            onSort={onSort}
            className="w-24 justify-end"
          />
        </div>

        {/* File List */}
        <List
          height={height - 36} // Subtract header height
          itemCount={files.length}
          itemSize={40}
          width="100%"
          className="scrollbar-thin"
        >
          {ListRowRenderer}
        </List>
      </div>
    );
  }

  // Grid view
  return (
    <Grid
      height={height}
      width={width}
      columnCount={gridConfig.columnCount}
      columnWidth={gridConfig.cellWidth}
      rowCount={gridConfig.rowCount}
      rowHeight={gridConfig.cellHeight}
      className="scrollbar-thin"
    >
      {GridCellRenderer}
    </Grid>
  );
}
