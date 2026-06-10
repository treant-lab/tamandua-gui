import { useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Shield,
  ShieldOff,
  Info,
  FolderOpen,
  Copy,
  Clipboard,
  Trash2,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileEntry } from '@/hooks/useFileBrowser';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface FileContextMenuProps {
  position: ContextMenuPosition;
  selectedFiles: FileEntry[];
  onClose: () => void;
  onScan: () => void;
  onQuarantine: () => void;
  onAddToExclusions: () => void;
  onShowProperties: () => void;
  onOpen?: () => void;
  onCopyPath?: () => void;
  onRefresh?: () => void;
}

interface MenuItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
}

function MenuItem({ icon: Icon, label, onClick, disabled, destructive, shortcut }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2 text-sm text-left transition-colors',
        disabled
          ? 'text-gray-500 cursor-not-allowed'
          : destructive
            ? 'text-red-400 hover:bg-red-500/10'
            : 'text-gray-200 hover:bg-gray-700',
        'focus:outline-none focus:bg-gray-700'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-gray-500 ml-4">{shortcut}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-gray-700" />;
}

export function FileContextMenu({
  position,
  selectedFiles,
  onClose,
  onScan,
  onQuarantine,
  onAddToExclusions,
  onShowProperties,
  onOpen,
  onCopyPath,
  onRefresh,
}: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickOutside, handleKeyDown]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${position.x - rect.width}px`;
      }

      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${position.y - rect.height}px`;
      }
    }
  }, [position]);

  const isSingleFile = selectedFiles.length === 1;
  const hasSelection = selectedFiles.length > 0;
  const isFolder = isSingleFile && selectedFiles[0].is_directory;
  const hasFiles = selectedFiles.some(f => !f.is_directory);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-56 py-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: position.x,
        top: position.y,
      }}
      role="menu"
      aria-orientation="vertical"
    >
      {isSingleFile && isFolder && onOpen && (
        <>
          <MenuItem
            icon={FolderOpen}
            label="Open"
            onClick={() => {
              onOpen();
              onClose();
            }}
          />
          <MenuDivider />
        </>
      )}

      <MenuItem
        icon={Search}
        label={hasSelection ? `Scan ${selectedFiles.length} item${selectedFiles.length > 1 ? 's' : ''}` : 'Scan'}
        onClick={() => {
          onScan();
          onClose();
        }}
        disabled={!hasSelection}
      />

      {hasFiles && (
        <MenuItem
          icon={Shield}
          label={`Quarantine${selectedFiles.length > 1 ? ` (${selectedFiles.filter(f => !f.is_directory).length})` : ''}`}
          onClick={() => {
            onQuarantine();
            onClose();
          }}
          destructive
        />
      )}

      <MenuDivider />

      <MenuItem
        icon={ShieldOff}
        label="Add to Exclusions"
        onClick={() => {
          onAddToExclusions();
          onClose();
        }}
        disabled={!hasSelection}
      />

      {onCopyPath && (
        <>
          <MenuDivider />
          <MenuItem
            icon={Copy}
            label="Copy Path"
            onClick={() => {
              onCopyPath();
              onClose();
            }}
            disabled={!isSingleFile}
            shortcut="Ctrl+C"
          />
        </>
      )}

      {onRefresh && (
        <>
          <MenuDivider />
          <MenuItem
            icon={RefreshCw}
            label="Refresh"
            onClick={() => {
              onRefresh();
              onClose();
            }}
            shortcut="F5"
          />
        </>
      )}

      <MenuDivider />

      <MenuItem
        icon={Info}
        label="Properties"
        onClick={() => {
          onShowProperties();
          onClose();
        }}
        disabled={!isSingleFile}
        shortcut="Alt+Enter"
      />
    </div>
  );
}

// Hook to manage context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    files: FileEntry[];
  } | null>(null);

  const openContextMenu = useCallback(
    (event: React.MouseEvent, files: FileEntry[]) => {
      event.preventDefault();
      setContextMenu({
        position: { x: event.clientX, y: event.clientY },
        files,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
  };
}

// Need to import useState for the hook
import { useState } from 'react';
