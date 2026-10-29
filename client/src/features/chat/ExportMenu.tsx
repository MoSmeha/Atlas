import { Button, Menu, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconDownload, IconFileSpreadsheet, IconFileTypeCsv } from '@tabler/icons-react';
import type { ExportFormat, ExportResponse } from '@atlas/shared';
import { useExport } from '../../api/useExport';
import { useCopy } from '../../i18n/useCopy';
import { useLanguage } from '../../i18n/useLanguage';
import { useSession } from '../../state/useSession';
import { notifyError } from '../errors/notifyError';
import { type ChatCopy, chatCopy } from './chatCopy';
import { downloadFile } from './downloadFile';

/**
 * "Export" with Excel and CSV: the server saves every row of the result, the browser downloads
 * the file, and a notification says where the saved copy is.
 */
export function ExportMenu({ resultId }: { resultId: string }) {
  const { sessionId } = useSession();
  const { language } = useLanguage();
  const copy = useCopy(chatCopy).export;
  const { mutate, isPending } = useExport();

  const exportAs = (format: ExportFormat) =>
    mutate(
      { sessionId, resultId, format },
      {
        onSuccess: (saved) => {
          downloadFile(saved.url, saved.fileName);
          notifySaved(saved, format, copy);
        },
        onError: (error) => notifyError(error, copy.failed, language),
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
          {copy.button}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconFileSpreadsheet size={16} stroke={1.5} aria-hidden />}
          onClick={() => exportAs('xlsx')}
        >
          {copy.formats.xlsx}
        </Menu.Item>
        <Menu.Item leftSection={<IconFileTypeCsv size={16} stroke={1.5} aria-hidden />} onClick={() => exportAs('csv')}>
          {copy.formats.csv}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function notifySaved(saved: ExportResponse, format: ExportFormat, copy: ChatCopy['export']): void {
  notifications.show({
    title: copy.saved[format],
    message: (
      <Text component="span" fz="sm" c="gray.8" style={{ overflowWrap: 'anywhere' }}>
        {copy.savedTo(saved.path)}
      </Text>
    ),
    autoClose: 8000,
  });
}
