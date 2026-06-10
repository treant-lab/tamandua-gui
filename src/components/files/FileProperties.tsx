import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  File,
  Folder,
  FileText,
  FileCode,
  Image,
  Video,
  Music,
  Archive,
  FileWarning,
  Settings,
  Database,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Clock,
  HardDrive,
  User,
  Hash,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';
import type { FileProperties as FilePropertiesType, FileType } from '@/hooks/useFileBrowser';
import { useFileProperties } from '@/hooks/useFileBrowser';
import { copyToClipboard } from '@/lib/utils';
import { useCallback, useState } from 'react';

interface FilePropertiesDialogProps {
  path: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getFileIcon(fileType: FileType, className?: string) {
  const iconClass = cn('w-12 h-12', className);

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

interface PropertyRowProps {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  icon?: React.ReactNode;
}

function PropertyRow({ label, value, copyable, icon }: PropertyRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (typeof value === 'string') {
      await copyToClipboard(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-700/50 last:border-0">
      {icon && <div className="text-gray-500 mt-0.5">{icon}</div>}
      <div className="flex-1 min-w-0">
        <dt className="text-xs text-gray-500 font-medium">{label}</dt>
        <dd className="text-sm text-gray-200 mt-0.5 break-all">
          {value || <span className="text-gray-500">-</span>}
        </dd>
      </div>
      {copyable && typeof value === 'string' && value && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-7 w-7"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          <Copy className={cn('w-3.5 h-3.5', copied && 'text-green-500')} />
        </Button>
      )}
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getFileTypeFromExtension(extension: string | null, isDirectory: boolean): FileType {
  if (isDirectory) return 'folder';
  if (!extension) return 'file';

  const ext = extension.toLowerCase();
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'c', 'cpp', 'h', 'java', 'cs', 'rb', 'php'];
  const docExtensions = ['doc', 'docx', 'pdf', 'txt', 'md', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'];
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'];
  const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'];
  const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
  const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
  const execExtensions = ['exe', 'dll', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'bin'];
  const configExtensions = ['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf', 'cfg'];
  const dataExtensions = ['db', 'sqlite', 'csv', 'sql', 'log', 'dat'];

  if (codeExtensions.includes(ext)) return 'code';
  if (docExtensions.includes(ext)) return 'document';
  if (imageExtensions.includes(ext)) return 'image';
  if (videoExtensions.includes(ext)) return 'video';
  if (audioExtensions.includes(ext)) return 'audio';
  if (archiveExtensions.includes(ext)) return 'archive';
  if (execExtensions.includes(ext)) return 'executable';
  if (configExtensions.includes(ext)) return 'config';
  if (dataExtensions.includes(ext)) return 'data';

  return 'file';
}

export function FilePropertiesDialog({ path, open, onOpenChange }: FilePropertiesDialogProps) {
  const { data: properties, isLoading, error } = useFileProperties(path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-100">Properties</DialogTitle>
          <DialogDescription className="text-gray-400">
            File and folder information
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
            <p className="text-gray-400">Failed to load properties</p>
            <p className="text-sm text-gray-500 mt-1">{error.message}</p>
          </div>
        ) : properties ? (
          <FilePropertiesContent properties={properties} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FilePropertiesContent({ properties }: { properties: FilePropertiesType }) {
  const fileType = getFileTypeFromExtension(properties.extension, properties.is_directory);

  return (
    <div className="space-y-6">
      {/* Header with icon and name */}
      <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg">
        {getFileIcon(fileType)}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-100 truncate">
            {properties.name}
          </h3>
          <p className="text-sm text-gray-400">
            {properties.is_directory ? 'Folder' : properties.extension?.toUpperCase() || 'File'}
            {!properties.is_directory && ` - ${formatBytes(properties.size_bytes)}`}
          </p>

          {/* Status badges */}
          <div className="flex items-center gap-2 mt-2">
            {properties.is_hidden && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                <EyeOff className="w-3 h-3" /> Hidden
              </span>
            )}
            {properties.is_readonly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-900/50 text-amber-300">
                <Lock className="w-3 h-3" /> Read-only
              </span>
            )}
            {properties.is_system && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-300">
                <Shield className="w-3 h-3" /> System
              </span>
            )}
            {properties.is_signed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-300">
                <ShieldCheck className="w-3 h-3" /> Signed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* General Information */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">General</h4>
        <dl className="bg-gray-800/30 rounded-lg px-4">
          <PropertyRow
            label="Location"
            value={properties.path}
            copyable
            icon={<HardDrive className="w-4 h-4" />}
          />
          {!properties.is_directory && (
            <PropertyRow
              label="Size"
              value={formatBytes(properties.size_bytes)}
              icon={<HardDrive className="w-4 h-4" />}
            />
          )}
          {properties.is_directory && properties.children_count !== null && (
            <PropertyRow
              label="Contains"
              value={`${properties.children_count} items`}
              icon={<Folder className="w-4 h-4" />}
            />
          )}
          <PropertyRow
            label="Owner"
            value={properties.owner}
            icon={<User className="w-4 h-4" />}
          />
          {properties.group && (
            <PropertyRow
              label="Group"
              value={properties.group}
              icon={<User className="w-4 h-4" />}
            />
          )}
          <PropertyRow
            label="Permissions"
            value={properties.permissions}
            icon={<Lock className="w-4 h-4" />}
          />
        </dl>
      </div>

      {/* Timestamps */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">Timestamps</h4>
        <dl className="bg-gray-800/30 rounded-lg px-4">
          <PropertyRow
            label="Created"
            value={formatDate(properties.created_at)}
            icon={<Clock className="w-4 h-4" />}
          />
          <PropertyRow
            label="Modified"
            value={formatDate(properties.modified_at)}
            icon={<Clock className="w-4 h-4" />}
          />
          <PropertyRow
            label="Accessed"
            value={formatDate(properties.accessed_at)}
            icon={<Clock className="w-4 h-4" />}
          />
        </dl>
      </div>

      {/* Digital Signature */}
      {!properties.is_directory && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Digital Signature</h4>
          <dl className="bg-gray-800/30 rounded-lg px-4">
            <PropertyRow
              label="Status"
              value={
                properties.is_signed ? (
                  <span className="inline-flex items-center gap-1 text-green-400">
                    <ShieldCheck className="w-4 h-4" /> Signed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <Shield className="w-4 h-4" /> Not signed
                  </span>
                )
              }
              icon={<Shield className="w-4 h-4" />}
            />
            {properties.signer && (
              <PropertyRow
                label="Signer"
                value={properties.signer}
                copyable
                icon={<User className="w-4 h-4" />}
              />
            )}
          </dl>
        </div>
      )}

      {/* Hashes */}
      {properties.hashes && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2">File Hashes</h4>
          <dl className="bg-gray-800/30 rounded-lg px-4">
            <PropertyRow
              label="MD5"
              value={properties.hashes.md5}
              copyable
              icon={<Hash className="w-4 h-4" />}
            />
            <PropertyRow
              label="SHA-1"
              value={properties.hashes.sha1}
              copyable
              icon={<Hash className="w-4 h-4" />}
            />
            <PropertyRow
              label="SHA-256"
              value={properties.hashes.sha256}
              copyable
              icon={<Hash className="w-4 h-4" />}
            />
          </dl>
        </div>
      )}
    </div>
  );
}
