import { Button, Menu, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconDownload, IconFileSpreadsheet, IconFileTypeCsv } from '@tabler/icons-react';
import type { ExportFormat, ExportResponse } from '@atlas/shared';
import { useExport } from '../../api/useExport';
import { useSession } from '../../state/useSession';
import { notifyError } from '../errors/notifyError';
import { downloadFile } from './downloadFile';

const savedTitle: Record<ExportFormat, string> = {
  xlsx: 'Excel file saved',
  csv: 'CSV file saved',
};

/**
 * "Export" with Excel and CSV: the server saves every row of the result, the browser downloads
 * the file, and a notification says where the saved copy is.
 */
export function ExportMenu({ resultId }: { resultId: string }) {
  const { sessionId } = useSession();
  const { mutate, isPending } = useExport();

  const exportAs = (format: ExportFormat) =>
    mutate(
      { sessionId, resultId, format },
      {
        onSuccess: (saved) => {
          downloadFile(saved.url, saved.fileName);
          notifySaved(saved, format);
        },
        onError: (error) => notifyError(error, 'Atlas could not export the table'),
      },
    );

  return (
    <Menu position="bottom-end" width={180}>
      <Menu.Target>
        <Button
          variant="default"
          size="xs"
          loading={isPending}
          leftSection={<IconDownload size={14} stroke={1.75} aria-hidden />}
          rightSection={<IconChevronDown size={14} stroke={1.75} aria-hidden />}
        >
          Export
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconFileSpreadsheet size={16} stroke={1.5} aria-hidden />}
          onClick={() => exportAs('xlsx')}
        >
          Excel (.xlsx)
        </Menu.Item>
        <Menu.Item leftSection={<IconFileTypeCsv size={16} stroke={1.5} aria-hidden />} onClick={() => exportAs('csv')}>
          CSV
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function notifySaved(saved: ExportResponse, format: ExportFormat): void {
  notifications.show({
    title: savedTitle[format],
    message: (
      <Text component="span" fz="sm" c="gray.8" style={{ overflowWrap: 'anywhere' }}>
        Saved to {saved.path}
      </Text>
    ),
    autoClose: 8000,
  });
}
