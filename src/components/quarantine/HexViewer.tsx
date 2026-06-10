import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Copy, CheckCircle } from 'lucide-react';
import { copyToClipboard } from '../../lib/utils';

interface HexViewerProps {
  fileId: string;
  filename: string;
  onClose: () => void;
  onLoadHex: (fileId: string, offset: number, length: number) => Promise<{ hex: string; ascii: string }>;
}

const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 16;
const BYTES_PER_PAGE = BYTES_PER_ROW * ROWS_PER_PAGE;

export function HexViewer({ fileId, filename, onClose, onLoadHex }: HexViewerProps) {
  const [offset, setOffset] = useState(0);
  const [hexData, setHexData] = useState<{ hex: string; ascii: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedOffset, setCopiedOffset] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [offset]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await onLoadHex(fileId, offset, BYTES_PER_PAGE);
      setHexData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hex data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - BYTES_PER_PAGE));
  };

  const handleNextPage = () => {
    setOffset(offset + BYTES_PER_PAGE);
  };

  const handleCopyRow = async (rowIndex: number) => {
    if (!hexData) return;

    const rowOffset = rowIndex * BYTES_PER_ROW * 2;
    const hexRow = hexData.hex.slice(rowOffset, rowOffset + BYTES_PER_ROW * 2);
    const asciiRow = hexData.ascii.slice(rowIndex * BYTES_PER_ROW, (rowIndex + 1) * BYTES_PER_ROW);

    await copyToClipboard(`${hexRow} | ${asciiRow}`);
    setCopiedOffset(rowIndex);
    setTimeout(() => setCopiedOffset(null), 2000);
  };

  const formatHexRow = (hex: string, rowIndex: number): string[] => {
    const startIndex = rowIndex * BYTES_PER_ROW * 2;
    const rowHex = hex.slice(startIndex, startIndex + BYTES_PER_ROW * 2);
    const bytes: string[] = [];

    for (let i = 0; i < rowHex.length; i += 2) {
      bytes.push(rowHex.slice(i, i + 2));
    }

    // Pad to full row
    while (bytes.length < BYTES_PER_ROW) {
      bytes.push('  ');
    }

    return bytes;
  };

  const formatAsciiRow = (ascii: string, rowIndex: number): string => {
    const startIndex = rowIndex * BYTES_PER_ROW;
    const rowAscii = ascii.slice(startIndex, startIndex + BYTES_PER_ROW);

    // Replace non-printable characters with dots
    return rowAscii
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 && code <= 126 ? char : '.';
      })
      .join('')
      .padEnd(BYTES_PER_ROW, ' ');
  };

  const rowCount = hexData ? Math.ceil(hexData.hex.length / (BYTES_PER_ROW * 2)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold">Hex Viewer (Read-Only)</h2>
            <p className="text-sm text-gray-400">{filename}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400">
              {error}
            </div>
          ) : hexData ? (
            <div className="overflow-x-auto font-mono text-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left pb-2 pr-4 w-24">Offset</th>
                    <th className="text-left pb-2 px-2" colSpan={BYTES_PER_ROW}>
                      <div className="flex justify-between">
                        {Array.from({ length: BYTES_PER_ROW }, (_, i) => (
                          <span key={i} className="w-6 text-center">
                            {i.toString(16).toUpperCase().padStart(2, '0')}
                          </span>
                        ))}
                      </div>
                    </th>
                    <th className="text-left pb-2 pl-4">ASCII</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }, (_, rowIndex) => {
                    const rowOffset = offset + rowIndex * BYTES_PER_ROW;
                    const hexBytes = formatHexRow(hexData.hex, rowIndex);
                    const asciiRow = formatAsciiRow(hexData.ascii, rowIndex);

                    return (
                      <tr
                        key={rowIndex}
                        className="hover:bg-gray-750 border-b border-gray-750"
                      >
                        <td className="py-1 pr-4 text-gray-500">
                          {rowOffset.toString(16).toUpperCase().padStart(8, '0')}
                        </td>
                        <td className="py-1 px-2" colSpan={BYTES_PER_ROW}>
                          <div className="flex space-x-1">
                            {hexBytes.map((byte, byteIndex) => (
                              <span
                                key={byteIndex}
                                className={`w-6 text-center ${
                                  byte === '00'
                                    ? 'text-gray-600'
                                    : byte === '  '
                                    ? ''
                                    : 'text-green-400'
                                }`}
                              >
                                {byte}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-1 pl-4 text-yellow-400 whitespace-pre">
                          {asciiRow}
                        </td>
                        <td className="py-1 pl-2">
                          <button
                            onClick={() => handleCopyRow(rowIndex)}
                            className="p-1 hover:bg-gray-600 rounded transition-colors"
                            title="Copy row"
                          >
                            {copiedOffset === rowIndex ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Offset: 0x{offset.toString(16).toUpperCase().padStart(8, '0')}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevPage}
              disabled={offset === 0}
              className="btn-secondary flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hexData || hexData.hex.length < BYTES_PER_PAGE * 2}
              className="btn-secondary flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
